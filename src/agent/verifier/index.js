/**
 * Verifier — the "does it actually work?" stage plus the controlled
 * self-correction loop.
 *
 *   Modify code → validate → pass? → REVIEW
 *                        └─ fail → diagnose → repair (≤ maxRepairs) → re-validate
 *
 * Hard limits (`AGENT_MAX_REPAIRS`, executor's action budget) guarantee the
 * agent cannot loop forever. Every attempt is recorded in memory.
 */

import { detectTestCommand, nodeCheckAll } from '../../tools/testing/run_tests.js'
import { runShell } from '../../tools/terminal/run_command.js'
import { buildPromptMessages } from '../prompts.js'
import { parseDecision, runSingleAction } from '../executor/index.js'
import { redact, truncate } from '../../utils/text.js'

/** @typedef {import('../../utils/types.js').LLMProvider} LLMProvider */
/** @typedef {import('../../utils/types.js').Tool} Tool */
/** @typedef {import('../../utils/types.js').VerificationResult} VerificationResult */
/** @typedef {import('../../utils/types.js').ActionRecord} ActionRecord */
/** @typedef {import('../memory/index.js').Memory} Memory */
/** @typedef {import('../../config/index.js').Settings} Settings */
/** @typedef {import('../../logging/logger.js').Logger} Logger */
/** @typedef {import('../../utils/result.js').Result} Result */

/**
 * Run the project's validation once.
 * @param {{ settings: Settings, logger: Logger }} args
 * @returns {Promise<VerificationResult>}
 */
export async function runValidation({ settings, logger }) {
  const log = logger.child({ stage: 'verifier' })
  const root = settings.workspaceRoot
  const { command, source } = detectTestCommand(root, settings.agent.verifyCommands)

  if (!command) {
    // No project script: syntax-check the JS sources as a real (minimal) gate.
    log.info('verify:fallback', { source })
    const check = nodeCheckAll(root)
    const passed = check.ok
    log.info('verify:done', { passed, source: 'node --check' })
    return {
      passed,
      skipped: false,
      commands: [
        {
          command: 'node --check (all sources)',
          ok: passed,
          code: passed ? 0 : 1,
          output: redact(truncate(String(passed ? check.data : check.data ?? check.error), 4000)) || '(no output)',
        },
      ],
    }
  }

  log.info('verify:start', { command, source })
  const started = Date.now()
  const result = await runShell(command, {
    cwd: root,
    timeoutMs: settings.agent.commandTimeoutMs,
    allowUnsafe: false,
  })
  const output =
    redact(truncate(`${result.stdout}\n${result.stderr}`.trim() || '(no output)', 6000)) +
    `\n[exit=${result.code ?? 'null'} ms=${Date.now() - started}]`
  const passed = result.code === 0 && !result.timedOut
  log.info('verify:done', { passed, command })

  return {
    passed,
    skipped: false,
    commands: [
      {
        command,
        ok: passed,
        code: result.code,
        output,
        ...(result.timedOut ? { timedOut: true } : {}),
      },
    ],
  }
}

/**
 * The self-correction loop: while validation fails and repairs remain, ask the
 * model to fix the reported failure through tools, then re-validate.
 *
 * @param {Object} args
 * @param {string} args.task
 * @param {string} args.context
 * @param {LLMProvider} args.llm
 * @param {Tool[]} args.tools
 * @param {(name: string, args: any) => Promise<Result>} args.runTool
 * @param {Memory} args.memory
 * @param {Settings} args.settings
 * @param {Logger} args.logger
 * @param {VerificationResult} args.verification
 * @returns {Promise<VerificationResult>} final verification (after repairs or budget exhaustion)
 */
export async function verifyAndRepair({
  task,
  context,
  llm,
  tools,
  runTool,
  memory,
  settings,
  logger,
  verification,
}) {
  const log = logger.child({ stage: 'verifier' })
  let current = verification
  let attempt = 0

  while (!current.passed && attempt < settings.agent.maxRepairs) {
    attempt++
    log.warn('repair:attempt', { attempt, max: settings.agent.maxRepairs })
    memory.recordAction({
      action: `repair:attempt ${attempt} (validation failed)`,
      ok: false,
      error: truncate(current.commands.map((c) => c.output).join('\n'), 500),
      ts: Date.now(),
    })

    const failure = current.commands
      .map((c) => `### ${c.command}\nexit=${c.code}${c.timedOut ? ' (timed out)' : ''}\n${c.output}`)
      .join('\n\n')

    const messages = buildPromptMessages({
      stage: 'REPAIR',
      task,
      context,
      tools,
      extra: `VALIDATION FAILURE (attempt ${attempt}/${settings.agent.maxRepairs}):\n${failure}`,
    })

    // Give the repair loop a bounded number of corrective tool calls per attempt.
    let attemptsLeft = settings.agent.maxActionsPerStep
    let repaired = false
    while (attemptsLeft-- > 0) {
      let reply
      try {
        reply = await llm.complete(messages, { temperature: settings.llm.temperature })
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        log.error('repair:llm-error', { error: message })
        memory.recordError(`Repair aborted, LLM unavailable: ${message}`)
        return current
      }
      const decision = parseDecision(reply)
      if (!decision) {
        memory.recordAction({ action: 'repair:unparseable-reply', ok: false, output: truncate(reply, 300), ts: Date.now() })
        break
      }
      if (decision.kind === 'done') {
        memory.setSummary(decision.summary ?? memory.record.summary ?? 'repaired')
        repaired = true
        break
      }
      await runSingleAction({
        tool: decision.tool,
        args: decision.args,
        runTool,
        memory,
        note: `repair:${attempt}`,
      })
      if (decision.tool === 'run_tests') break // model re-validated itself; re-check below
    }

    if (!repaired) {
      // Loop exits only via budget; verification below reflects reality.
      memory.recordError(`Repair attempt ${attempt} did not reach a verified state`)
    }
    current = await runValidation({ settings, logger })
    memory.setVerification(current)
  }

  if (!current.passed) {
    log.error('verify:exhausted', { attempts: attempt })
    memory.recordError(
      `Validation still failing after ${attempt} repair attempt(s) — stopping per maxRepairs=${settings.agent.maxRepairs}`,
    )
  } else if (attempt > 0) {
    log.info('verify:recovered', { attempts: attempt })
  }
  return current
}
