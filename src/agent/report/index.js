/**
 * Reporter — compiles the final concise report from the run record.
 *
 * Tries the LLM for a natural-language summary, but ALWAYS falls back to a
 * deterministic report built from the record (so a report exists even when the
 * model is down — the report must never be the thing that fails).
 */

import { redact, truncate } from '../../utils/text.js'
import { buildPromptMessages } from '../prompts.js'

/** @typedef {import('../../utils/types.js').RunRecord} RunRecord */
/** @typedef {import('../../utils/types.js').LLMProvider} LLMProvider */
/** @typedef {import('../../utils/types.js').Tool} Tool */
/** @typedef {import('../../logging/logger.js').Logger} Logger */

/**
 * @param {{ record: RunRecord, llm: LLMProvider, tools: Tool[], logger: Logger }} args
 * @returns {Promise<string>}
 */
export async function buildReport({ record, llm, tools, logger }) {
  const log = logger.child({ stage: 'reporter' })
  const facts = factsBlock(record)
  // A dry run executed nothing — never let the model claim otherwise.
  const forcedStatus = record.status === 'dry-run' ? 'dry-run' : null

  try {
    const messages = buildPromptMessages({
      stage: 'REPORTER',
      task: record.task,
      context: record.context ?? '(no context captured)',
      tools,
      extra: facts,
    })
    const raw = await llm.complete(messages, { temperature: 0.2 })
    const parsed = safeParse(raw)
    if (parsed && typeof parsed.summary === 'string') {
      const changes = Array.isArray(parsed.changes) ? parsed.changes.slice(0, 8) : []
      const followUps = Array.isArray(parsed.followUps) ? parsed.followUps.slice(0, 5) : []
      const rejected = String(record.summary ?? '').includes('rejected')
      return render(
        record,
        forcedStatus
          ? rejected
            ? 'Plan shown to the user and rejected — nothing was executed.'
            : 'Plan generated only — nothing was executed.'
          : parsed.summary,
        forcedStatus ? [] : changes,
        forcedStatus ? 'not run (nothing was executed)' : String(parsed.validation ?? ''),
        forcedStatus ? [] : followUps,
        forcedStatus ??
          (parsed.status === 'success' || parsed.status === 'partial' || parsed.status === 'failed'
            ? parsed.status
            : undefined),
      )
    }
    log.warn('reporter:unparseable', { raw: truncate(raw, 200) })
  } catch (e) {
    log.warn('reporter:llm-failed', { error: e instanceof Error ? e.message : String(e) })
  }
  return render(
    record,
    fallbackSummary(record),
    [],
    '',
    [],
    record.status === 'success' ? 'success' : record.status === 'dry-run' ? 'dry-run' : record.status === 'failed' ? 'failed' : 'partial',
  )
}

/**
 * @param {RunRecord} record
 * @returns {string}
 */
function factsBlock(record) {
  const toolCalls = record.actions.filter((a) => a.tool)
  const failedCalls = toolCalls.filter((a) => !a.ok)
  return [
    `Status: ${record.status}`,
    `Actions: ${record.actions.length} total, ${toolCalls.length} tool calls, ${failedCalls.length} failed`,
    `Plan origin: ${record.plan?.origin ?? 'n/a'} (${record.plan?.steps.length ?? 0} steps)`,
    `Validation: ${record.verification ? (record.verification.passed ? 'PASSED' : 'FAILED') : 'not run'}${
      record.verification ? ` via ${record.verification.commands.map((c) => c.command).join(' | ')}` : ''
    }`,
    `Errors recorded: ${record.errors.length}`,
    record.review?.changed?.length
      ? `Changed files: ${record.review.changed.slice(0, 15).join(', ')}${record.review.changed.length > 15 ? ' …' : ''}`
      : 'Changed files: none detected',
    '',
    'ACTION LOG:',
    ...record.actions.map(
      (a) => `- ${a.action} → ${a.ok ? 'OK' : `FAIL: ${truncate(String(a.error ?? ''), 200)}`}`,
    ),
  ].join('\n')
}

/**
 * @param {string} raw
 */
function safeParse(raw) {
  const first = raw.indexOf('{')
  const last = raw.lastIndexOf('}')
  if (first < 0 || last <= first) return null
  try {
    return JSON.parse(raw.slice(first, last + 1))
  } catch {
    return null
  }
}

/**
 * @param {RunRecord} record
 * @returns {string}
 */
function fallbackSummary(record) {
  const calls = record.actions.filter((a) => a.tool).length
  const failed = record.actions.filter((a) => a.tool && !a.ok).length
  const validation = record.verification
    ? record.verification.passed
      ? 'validation passed'
      : 'validation FAILED'
    : 'no validation run'
  return `Executed ${calls} tool call${calls === 1 ? '' : 's'} (${failed} failed); ${validation}.`
}

/**
 * Deterministic, markdown report — the source of truth for humans.
 * @param {RunRecord} record
 * @param {string} summary
 * @param {string[]} changes
 * @param {string} validation
 * @param {string[]} followUps
 * @param {string} [status]
 * @returns {string}
 */
function render(record, summary, changes, validation, followUps, status) {
  const mark = record.status === 'success' ? '✅' : record.status === 'dry-run' ? '🧪' : '❌'
  const changed = changes.length ? changes : (record.review?.changed ?? [])
  const verifyLine =
    validation ||
    (record.verification
      ? `${record.verification.passed ? 'PASSED' : 'FAILED'} — ${record.verification.commands
          .map((c) => `${c.command} (exit ${c.code})`)
          .join(', ')}`
      : 'not run')

  const lines = [
    `# ${mark} Agent report — ${record.id}`,
    '',
    `**Task:** ${redact(record.task)}`,
    `**Status:** ${status ?? record.status}`,
    `**Summary:** ${redact(truncate(summary, 700))}`,
    '',
    `## Validation`,
    `- ${redact(verifyLine)}`,
    '',
    `## Changes`,
    ...(changed.length ? changed.map((c) => `- ${c}`) : ['- none detected']),
    '',
    `## Activity`,
    `- ${record.actions.length} actions, ${record.errors.length} errors, plan: ${record.plan?.origin ?? 'n/a'} (${record.plan?.steps.length ?? 0} steps)`,
    ...(record.errors.length ? ['', '### Errors', ...record.errors.slice(0, 6).map((e) => `- ${redact(e)}`)] : []),
    ...(followUps.length ? ['', '## Follow-ups', ...followUps.map((f) => `- ${f}`)] : []),
    '',
    `Run record: .agent/runs/${record.id}.json`,
  ]
  return lines.join('\n')
}
