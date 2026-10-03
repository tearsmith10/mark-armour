/**
 * Agent — the orchestrator that owns the lifecycle:
 *
 *   TASK → CONTEXT → PLAN → [APPROVE] → EXECUTE → VERIFY → FIX → REVIEW → REPORT
 *
 * It wires together the subsystems (context, planner, executor, verifier,
 * memory, reporter) and enforces the global guards: action budget, repair
 * budget, workspace safety (via the tool registry), and always-persist
 * run records.
 */

import { createProvider } from '../llm/provider.js'
import { createRegistry } from '../tools/index.js'
import { buildContext } from './context/index.js'
import { createPlan } from './planner/index.js'
import { executePlan, runSingleAction } from './executor/index.js'
import { runValidation, verifyAndRepair } from './verifier/index.js'
import { Memory } from './memory/index.js'
import { buildReport } from './report/index.js'
import { redact, truncate } from '../utils/text.js'

/** @typedef {import('../config/index.js').Settings} Settings */
/** @typedef {import('../logging/logger.js').Logger} Logger */
/** @typedef {import('../utils/result.js').Result} Result */

export class Agent {
  /**
   * @param {{ settings: Settings, logger: Logger }} args
   */
  constructor({ settings, logger }) {
    this.settings = settings
    this.logger = logger.child({ mod: 'agent' })
    this.llm = createProvider(settings.llm)
    this.ctx = {
      workspaceRoot: settings.workspaceRoot,
      logger,
      settings,
    }
    this.registry = createRegistry(this.ctx)
    /** @type {(name: string, args: any) => Promise<Result>} */
    this.runTool = (name, args) => this.registry.execute(name, args)
  }

  /**
   * Execute one task end-to-end.
   * @param {{ task: string, dryRun?: boolean, allowUnsafe?: boolean,
   *           confirmPlan?: (plan: import('../utils/types.js').Plan) => Promise<boolean> }} args
   * @returns {Promise<{ record: import('../utils/types.js').RunRecord, report: string,
   *                     runFile: string|null, rejected?: boolean }>}
   */
  async run({ task, dryRun = false, allowUnsafe = false, confirmPlan }) {
    const { settings } = this
    if (allowUnsafe) settings.agent.allowUnsafe = true
    const memory = new Memory({ task, workspaceRoot: settings.workspaceRoot, dryRun })
    const started = Date.now()
    this.logger.info('run:start', {
      id: memory.record.id,
      provider: settings.llm.provider,
      model: settings.llm.model,
      workspace: settings.workspaceRoot,
      dryRun,
    })

    try {
      // ---- CONTEXT ------------------------------------------------------
      this.logger.info('stage:context', { task: truncate(task, 80) })
      const context = await buildContext({ task, settings, logger: this.logger })
      memory.setContext(context.text)

      // ---- PLAN ---------------------------------------------------------
      this.logger.info('stage:plan')
      const plan = await createPlan({
        task,
        context: context.text,
        llm: this.llm,
        tools: this.registry.list(),
        logger: this.logger,
      })
      memory.setPlan(plan)
      this.logger.info('run:plan', { origin: plan.origin, steps: plan.steps.length })

      if (dryRun) {
        memory.finish('dry-run')
        const report = await buildReport({
          record: memory.toJSON(),
          llm: this.llm,
          tools: this.registry.list(),
          logger: this.logger,
        })
        memory.setReport(report)
        const runFile = await this.persist(memory)
        this.logger.info('run:finished', { status: 'dry-run', ms: Date.now() - started })
        return { record: memory.toJSON(), report, runFile }
      }

      // ---- APPROVAL (optional interactive gate) --------------------------
      if (confirmPlan) {
        const approved = await confirmPlan(plan)
        if (!approved) {
          memory.setSummary('Plan rejected at the approval prompt — nothing was executed.')
          memory.finish('dry-run')
          const rejectedReport = await buildReport({
            record: memory.toJSON(),
            llm: this.llm,
            tools: this.registry.list(),
            logger: this.logger,
          })
          memory.setReport(rejectedReport)
          const rejectedFile = await this.persist(memory)
          this.logger.info('run:rejected', { ms: Date.now() - started })
          return { record: memory.toJSON(), report: rejectedReport, runFile: rejectedFile, rejected: true }
        }
        this.logger.info('run:approved', { steps: plan.steps.length })
      }

      // ---- EXECUTE ------------------------------------------------------
      this.logger.info('stage:execute')
      const exec = await executePlan({
        task,
        context: context.text,
        plan,
        llm: this.llm,
        tools: this.registry.list(),
        runTool: this.runTool,
        memory,
        settings,
        logger: this.logger,
      })
      this.logger.info('run:executed', { actions: exec.actions, done: exec.done })

      // ---- VERIFY (+ FIX loop) -----------------------------------------
      this.logger.info('stage:verify', { maxRepairs: settings.agent.maxRepairs })
      let verification = await runValidation({ settings, logger: this.logger })
      memory.setVerification(verification)

      if (!verification.passed) {
        if (settings.agent.maxRepairs > 0) {
          verification = await verifyAndRepair({
            task,
            context: context.text,
            llm: this.llm,
            tools: this.registry.list(),
            runTool: this.runTool,
            memory,
            settings,
            logger: this.logger,
            verification,
          })
        }
        memory.setVerification(verification)
      }

      // ---- REVIEW (own changes) ----------------------------------------
      this.logger.info('stage:review')
      const review = await this.review(memory)
      memory.setReview(review)

      // ---- STATUS (decided before the report so it describes the run) --
      // success  = the executor finished AND validation is green
      // partial  = validation is green but autonomy stopped early (LLM error
      //            or action budget) — honest "inspected, not fully executed"
      // failed   = validation is red
      const status = verification.passed
        ? exec.done
          ? 'success'
          : 'partial'
        : 'failed'
      memory.finish(/** @type {any} */ (status))

      // ---- REPORT -------------------------------------------------------
      this.logger.info('stage:report')
      const report = await buildReport({
        record: memory.toJSON(),
        llm: this.llm,
        tools: this.registry.list(),
        logger: this.logger,
      })
      memory.setReport(report)

      const runFile = await this.persist(memory)
      this.logger.info('run:finished', {
        status: memory.record.status,
        ms: Date.now() - started,
        verification: verification.passed ? 'passed' : 'failed',
        errors: memory.record.errors.length,
      })
      return { record: memory.toJSON(), report, runFile }
    } catch (e) {
      const message = e instanceof Error ? (e.stack ?? e.message) : String(e)
      this.logger.error('run:crashed', { error: message })
      memory.recordError(`Fatal: ${message}`)
      memory.finish('failed')
      const report = [
        `# ❌ Agent report — ${memory.record.id}`,
        '',
        `**Task:** ${redact(task)}`,
        '**Status:** failed',
        `**Error:** ${redact(truncate(message, 900))}`,
      ].join('\n')
      memory.setReport(report)
      const runFile = await this.persist(memory)
      return { record: memory.toJSON(), report, runFile }
    }
  }

  /**
   * REVIEW — inspect our own edits before reporting (diff when git exists,
   * else a comparison against the action log's write/edit calls).
   * @param {Memory} memory
   * @returns {Promise<import('../utils/types.js').ReviewResult>}
   */
  async review(memory) {
    const writes = memory.record.actions
      .filter((a) => (a.tool === 'write_file' || a.tool === 'edit_file') && a.ok)
      .map((a) => String(a.input?.path ?? '(unknown)'))

    const status = await this.runTool('git_status', {})
    if (status.ok) {
      const diff = await this.runTool('git_diff', { stat: true })
      return {
        changed: writes.length ? [...new Set(writes)] : [],
        added: [],
        removed: [],
        gitAvailable: true,
        ...(diff.ok && diff.data !== '(no differences)' ? { diffStat: String(diff.data) } : {}),
      }
    }

    // git unavailable → report file writes from the action log instead.
    this.logger.warn('review:no-git', { reason: truncate(String(status.error), 160) })
    return {
      changed: [...new Set(writes)],
      added: [],
      removed: [],
      gitAvailable: false,
    }
  }

  /**
   * @param {Memory} memory
   * @returns {Promise<string|null>}
   */
  async persist(memory) {
    try {
      return await memory.save()
    } catch (e) {
      this.logger.error('memory:save-failed', { error: e instanceof Error ? e.message : String(e) })
      return null
    }
  }
}
