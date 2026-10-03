/**
 * Planner — turns (task + context) into an explicit execution plan.
 *
 * The LLM proposes the plan as JSON; it is validated here before anything is
 * executed. If the LLM is unavailable or returns garbage, we fall back to a
 * deterministic heuristic plan so the run still does something *safe and
 * useful* (inspect → verify → report) instead of failing blind.
 */

import { safeJsonParse, truncate } from '../../utils/text.js'
import { buildPromptMessages } from '../prompts.js'

/** @typedef {import('../../utils/types.js').LLMProvider} LLMProvider */
/** @typedef {import('../../utils/types.js').Plan} Plan */
/** @typedef {import('../../utils/types.js').PlanStep} PlanStep */
/** @typedef {import('../../utils/types.js').Tool} Tool */
/** @typedef {import('../../logging/logger.js').Logger} Logger */

const MAX_STEPS = 12

/**
 * @param {{ task: string, context: string, llm: LLMProvider, tools: Tool[], logger: Logger }} args
 * @returns {Promise<Plan>}
 */
export async function createPlan({ task, context, llm, tools, logger }) {
  const log = logger.child({ stage: 'planner' })

  try {
    const messages = buildPromptMessages({
      stage: 'PLANNER',
      task,
      context,
      tools,
    })
    const raw = await llm.complete(messages, { temperature: 0.1 })
    const parsed = safeJsonParse(raw)
    const steps = extractSteps(parsed)

    if (steps.length === 0) {
      log.warn('planner:no-valid-steps', { raw: truncate(raw, 400) })
      return heuristicPlan(task)
    }

    const known = new Set(tools.map((t) => t.name))
    const cleaned = steps.slice(0, MAX_STEPS).map((s) => ({
      goal: s.goal,
      tool: s.tool && known.has(s.tool) ? s.tool : null,
      args: s.args && typeof s.args === 'object' ? s.args : {},
    }))

    log.info('plan:created', { steps: cleaned.length, toolSteps: cleaned.filter((s) => s.tool).length })
    return { strategy: typeof parsed?.strategy === 'string' ? parsed.strategy : 'inspect, patch, verify', steps: cleaned, origin: 'llm' }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    log.warn('planner:llm-failed', { error: message })
    return heuristicPlan(task, message)
  }
}

/**
 * Accept only well-formed steps from model output.
 * @param {any} parsed
 * @returns {PlanStep[]}
 */
function extractSteps(parsed) {
  if (!parsed || typeof parsed !== 'object') return []
  const rawSteps = Array.isArray(parsed.steps)
    ? parsed.steps
    : Array.isArray(parsed.plan)
      ? parsed.plan
      : []
  /** @type {PlanStep[]} */
  const steps = []
  for (const s of rawSteps) {
    if (!s || typeof s !== 'object') continue
    const goal = typeof s.goal === 'string' ? s.goal : typeof s.action === 'string' ? s.action : null
    if (!goal) continue
    steps.push({
      goal,
      tool: typeof s.tool === 'string' ? s.tool : null,
      args: s.args && typeof s.args === 'object' ? s.args : {},
    })
  }
  return steps
}

/**
 * Deterministic fallback plan — used when no LLM is reachable, when the model
 * returns unparseable output, or in `--offline`.
 *
 * @param {string} task
 * @param {string} [reason]
 * @returns {Plan}
 */
export function heuristicPlan(task, reason) {
  const steps = [
    { goal: 'Orient: list the workspace and read package.json', tool: 'list_files', args: { path: '.', maxDepth: 2 } },
    { goal: 'Locate code mentioned in the task via search', tool: 'search_files', args: { query: firstKeyword(task) } },
    { goal: 'Run validation to establish a baseline', tool: 'run_tests', args: {} },
    { goal: 'Report findings (no blind edits without a model)', tool: null, args: {} },
  ]
  return {
    strategy: reason
      ? `heuristic fallback (LLM unavailable: ${truncate(reason, 120)})`
      : 'heuristic: inspect, baseline, report',
    steps,
    origin: 'heuristic',
  }
}

/**
 * @param {string} task
 * @returns {string}
 */
function firstKeyword(task) {
  const words = String(task)
    .split(/[^a-zA-Z0-9_]+/)
    .filter((w) => w.length > 3)
  return words[0] ?? 'TODO'
}
