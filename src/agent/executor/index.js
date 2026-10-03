/**
 * Executor — walks the plan, calling tools one action at a time.
 *
 * Loop discipline (self-correction lives here and in the verifier):
 *   plan step → LLM picks ONE tool → tool result (ok or structured error)
 *     → error  → LLM sees the error and picks a corrective action
 *     → ok     → continue to the next decision
 *   Guards: maxActionsPerStep, maxSteps, wall-clock-free (step counts only).
 *
 * Every action lands in memory for the final report and audit trail.
 */

import { buildPromptMessages } from '../prompts.js'
import { safeJsonParse, redact, truncate } from '../../utils/text.js'

/** @typedef {import('../../utils/types.js').LLMProvider} LLMProvider */
/** @typedef {import('../../utils/types.js').Plan} Plan */
/** @typedef {import('../../utils/types.js').Tool} Tool */
/** @typedef {import('../../utils/types.js').ActionRecord} ActionRecord */
/** @typedef {import('../../utils/result.js').Result} Result */
/** @typedef {import('../memory/index.js').Memory} Memory */
/** @typedef {import('../../config/index.js').Settings} Settings */
/** @typedef {import('../../logging/logger.js').Logger} Logger */

/**
 * @param {Object} args
 * @param {string} args.task
 * @param {string} args.context
 * @param {Plan} args.plan
 * @param {LLMProvider} args.llm
 * @param {Tool[]} args.tools
 * @param {(name: string, args: any) => Promise<Result>} args.runTool
 * @param {Memory} args.memory
 * @param {Settings} args.settings
 * @param {Logger} args.logger
 * @returns {Promise<{ done: boolean, lastValidation: Result|null, actions: number }>}
 */
export async function executePlan({
  task,
  context,
  plan,
  llm,
  tools,
  runTool,
  memory,
  settings,
  logger,
}) {
  const log = logger.child({ stage: 'executor' })
  /** @type {Result|null} */
  let lastValidation = null
  let actions = 0
  let stepsDone = 0
  const maxSteps = settings.agent.maxSteps

  /** Consecutive identical tool calls tolerated before we call it a loop. */
  const maxIdentical = 3
  let lastSignature = ''
  let identicalRun = 0

  /** True once a write_file/edit_file call actually succeeded this run. */
  let mutatedOk = false
  /** True when the plan itself was supposed to change files. */
  const planMutating = plan.steps.some((s) => s.tool === 'write_file' || s.tool === 'edit_file')

  /** @type {string[]} */
  const failureNotes = []

  /**
   * Stopping because the model is stuck is not automatically a failure. When
   * every planned step ran, project validation is green, and (if the plan was
   * meant to change files) a mutation succeeded, finishing is the honest
   * outcome — the model's silence about a completed, verified task should not
   * send the user off to review green work. Anything less stays `partial`.
   * @param {'loop'|'budget'} stopKind
   * @param {string} stopDetail what stopped the run (already recorded as an error)
   * @returns {boolean} true when the executor may finish on its own
   */
  const tryAutoFinish = (stopKind, stopDetail) => {
    const planComplete = stepsDone >= plan.steps.length
    const validated = Boolean(lastValidation?.ok)
    const mutated = mutatedOk || !planMutating
    if (!(planComplete && validated && mutated)) return false
    const note =
      `Auto-finish (${stopKind}): ${stopDetail} — every planned step executed, ` +
      `validation passed${mutatedOk ? ' and a file mutation succeeded' : ''}, ` +
      `so the executor is finishing instead of reporting partial.`
    log.warn('executor:auto-finish', { stopKind, actions })
    memory.recordError(note)
    memory.setSummary(`auto-finished: plan complete, validation green (${stopKind} stop)`)
    return true
  }

  while (actions < maxSteps) {
    // 1. Run any planned tool steps that are next in line.
    const step = plan.steps[stepsDone]
    if (step && step.tool) {
      stepsDone++
      const result = await runTool(step.tool, step.args ?? {})
      actions++
      trackAction(memory, { tool: step.tool, args: step.args ?? {}, result, note: `plan: ${step.goal}` })
      if (step.tool === 'run_tests') lastValidation = result
      if (result.ok && (step.tool === 'write_file' || step.tool === 'edit_file')) mutatedOk = true
      if (!result.ok) failureNotes.push(`step "${step.goal}" failed: ${result.error}`)
      continue
    }
    if (step && !step.tool) {
      // Reasoning-only step: mark it handled and move on.
      stepsDone++
      memory.recordAction(actionEntry('plan-note', step.goal, true))
      continue
    }

    // 2. Past the written plan → ask the model for the next action.
    const extra = buildExtra(memory, lastValidation, failureNotes)
    const messages = buildPromptMessages({ stage: 'EXECUTOR', task, context, tools, extra })
    let reply
    try {
      reply = await llm.complete(messages, { temperature: settings.llm.temperature })
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      log.error('llm:error', { error: message })
      memory.recordError(`LLM call failed during execution: ${message}`)
      return { done: false, lastValidation, actions }
    }

    const decision = parseDecision(reply)
    if (!decision) {
      memory.recordAction(actionEntry('llm-unparseable', truncate(reply, 300), false))
      failureNotes.push('model reply was not valid action JSON')
      actions++
      continue
    }
    if (decision.kind === 'done') {
      memory.setSummary(decision.summary ?? 'done')
      log.info('executor:done', { actions })
      return { done: true, lastValidation, actions }
    }

    // 3. Loop guard: a model that keeps re-issuing the same call (common with
    //    small local models) must not burn the whole action budget.
    const signature = `${decision.tool}:${JSON.stringify(decision.args ?? {})}`
    if (signature === lastSignature) {
      identicalRun++
      if (identicalRun >= maxIdentical) {
        const detail =
          `${identicalRun + 1} identical consecutive ${decision.tool} calls with no new ` +
          `information — stopping to stay in control. Check whether the task is already complete.`
        log.warn('executor:loop-detected', { tool: decision.tool, repeats: identicalRun + 1 })
        memory.recordError(`Loop detected: ${detail}`)
        if (tryAutoFinish('loop', `loop detected: ${detail}`)) {
          return { done: true, lastValidation, actions }
        }
        return { done: false, lastValidation, actions }
      }
    } else {
      lastSignature = signature
      identicalRun = 0
    }

    // 4. Execute the chosen tool.
    const result = await runTool(decision.tool, decision.args)
    actions++
    trackAction(memory, {
      tool: decision.tool,
      args: decision.args,
      result,
      note: decision.reasoning,
    })
    if (decision.tool === 'run_tests') lastValidation = result
    if (result.ok && (decision.tool === 'write_file' || decision.tool === 'edit_file')) mutatedOk = true
    if (!result.ok) failureNotes.push(`${decision.tool} failed: ${result.error}`)
  }

  const budgetDetail = `action budget exhausted (${maxSteps} steps)`
  log.warn('executor:step-budget', { actions, maxSteps })
  memory.recordError(`Action budget exhausted (${maxSteps} steps) — stopping to stay in control.`)
  if (tryAutoFinish('budget', budgetDetail)) {
    return { done: true, lastValidation, actions }
  }
  return { done: false, lastValidation, actions }
}

/**
 * Run a single explicit tool call (used for one-shot / scripted actions).
 * @param {{ tool: string, args: any, runTool: (n: string, a: any) => Promise<Result>, memory: Memory, note?: string }} args
 * @returns {Promise<Result>}
 */
export async function runSingleAction({ tool, args, runTool, memory, note }) {
  const result = await runTool(tool, args)
  trackAction(memory, { tool, args, result, note })
  return result
}

/**
 * @param {Memory} memory
 * @param {{ tool: string, args: any, result: Result, note?: string }} args
 */
function trackAction(memory, { tool, args, result, note }) {
  memory.recordAction({
    action: note ? `${note} → ${tool}` : tool,
    tool,
    input: sanitizeArgs(args),
    ok: result.ok,
    ...(result.ok ? {} : { error: truncate(String(result.error), 600) }),
    output: truncate(redact(stringify(result.data)), 900),
    ...(result.ok ? snapshotOf(tool, result) : {}),
    ts: Date.now(),
  })
  if (!result.ok) memory.recordError(`${tool}: ${result.error}`)
}

/**
 * Persist the previous-version snapshot of a file mutation so the run can be
 * undone. Snapshots live in the run record only (never sent to the model).
 * @param {string} tool
 * @param {Result} result
 * @returns {{ snapshot?: import('../../utils/types.js').FileSnapshot }}
 */
function snapshotOf(tool, result) {
  if (tool !== 'write_file' && tool !== 'edit_file') return {}
  const meta = result.meta ?? {}
  if (!('before' in meta || 'existed' in meta)) return {}
  const snapshot = /** @type {import('../../utils/types.js').FileSnapshot} */ ({
    before: typeof meta.before === 'string' ? meta.before : null,
    existed: meta.existed !== false,
  })
  if (meta.snapshotSkipped === true) snapshot.skipped = true
  if (typeof meta.afterHash === 'string') snapshot.afterHash = meta.afterHash
  return { snapshot }
}

/**
 * @param {string} action
 * @param {string} detail
 * @param {boolean} ok
 * @returns {ActionRecord}
 */
function actionEntry(action, detail, ok) {
  return { action: `${action}: ${detail}`, ok, ts: Date.now() }
}

/**
 * A parsed model decision. Discriminated on `kind` so consumers can narrow.
 * @typedef {{ kind: 'tool', tool: string, args: any, reasoning?: string }
 *          | { kind: 'done', summary?: string }} Decision
 */

/**
 * @param {string} reply
 * @returns {Decision|null}
 */
export function parseDecision(reply) {
  const parsed = safeJsonParse(reply)
  if (!parsed || typeof parsed !== 'object') return null
  if (parsed.done === true) {
    return { kind: 'done', summary: typeof parsed.summary === 'string' ? parsed.summary : undefined }
  }
  if (typeof parsed.tool === 'string' && parsed.tool) {
    return {
      kind: 'tool',
      tool: parsed.tool,
      args: parsed.args && typeof parsed.args === 'object' ? parsed.args : {},
      reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : undefined,
    }
  }
  return null
}

/**
 * Compact action history + latest validation for the next prompt.
 * @param {Memory} memory
 * @param {Result|null} lastValidation
 * @param {string[]} failureNotes
 * @returns {string}
 */
function buildExtra(memory, lastValidation, failureNotes) {
  const recent = memory.record.actions.slice(-8)
  const lines = [
    'ACTION LOG (most recent last):',
    ...recent.map(
      (a) =>
        `- ${a.action} → ${a.ok ? 'OK' : `FAIL: ${a.error ?? 'error'}`}${a.output ? ` | ${truncate(a.output, 300)}` : ''}`,
    ),
    '',
    failureNotes.length ? `OPEN FAILURES:\n${failureNotes.slice(-5).map((f) => `- ${f}`).join('\n')}` : '',
    lastValidation
      ? `LATEST VALIDATION: ${lastValidation.ok ? 'PASSED' : 'FAILED'} — ${truncate(String(validationDetail(lastValidation)), 800)}`
      : 'LATEST VALIDATION: not run yet',
  ]
  return lines.filter(Boolean).join('\n')
}

/**
 * Best-effort human-readable payload of a validation result.
 * @param {Result} r
 * @returns {unknown}
 */
function validationDetail(r) {
  if (r.ok) return r.data ?? ''
  if (r.data !== null && r.data !== undefined && r.data !== '') return r.data
  return r.error ?? ''
}

/**
 * @param {any} args
 * @returns {Record<string, any>}
 */
function sanitizeArgs(args) {
  if (!args || typeof args !== 'object') return {}
  /** @type {Record<string, any>} */
  const out = {}
  for (const [k, v] of Object.entries(args)) {
    out[k] = typeof v === 'string' ? truncate(v, 300) : v
  }
  return out
}

/**
 * @param {any} v
 * @returns {string}
 */
function stringify(v) {
  if (v === null || v === undefined) return ''
  return typeof v === 'string' ? v : JSON.stringify(v, null, 2)
}
