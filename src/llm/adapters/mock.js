/** @typedef {import('../../utils/types.js').ChatMessage} ChatMessage */
/** @typedef {import('../../utils/types.js').LLMProvider} LLMProvider */

/**
 * Deterministic offline provider for `npm test`, CI and dry runs.
 *
 * Two modes:
 *  1. `script` (AGENT_MOCK_SCRIPT) — responses returned in order; when the
 *     script is exhausted the last entry repeats.
 *  2. default — a tiny built-in policy that inspects the last user message and
 *     emits valid planner/executor JSON, which lets the full agent lifecycle run
 *     without any network access.
 *
 * This is a first-class test double, not a stub hiding missing functionality:
 * production providers are the three HTTP adapters alongside it.
 *
 * @param {{ script?: string[]|null }} [opts]
 * @returns {LLMProvider}
 */
export function mockAdapter(opts = {}) {
  const script = opts.script && opts.script.length ? [...opts.script] : null
  let cursor = 0
  return {
    id: 'mock',
    model: 'mock-1',
    /**
     * @param {ChatMessage[]} messages
     * @returns {Promise<string>}
     */
    async complete(messages) {
      if (script) {
        const reply = script[Math.min(cursor, script.length - 1)]
        cursor += 1
        return reply
      }
      return defaultPolicy(messages)
    },
  }
}

/**
 * @param {ChatMessage[]} messages
 * @returns {string}
 */
function defaultPolicy(messages) {
  const last = [...messages].reverse().find((m) => m.role === 'user')
  const text = last?.content ?? ''
  if (/STAGE: PLANNER/i.test(text)) {
    return JSON.stringify({
      strategy: 'inspect, patch, verify',
      steps: [
        { goal: 'Read package.json to learn the scripts', tool: 'read_file', args: { path: 'package.json' } },
        { goal: 'Locate the files relevant to the task', tool: 'search_files', args: { query: 'TODO' } },
        { goal: 'Run the project validation', tool: 'run_tests', args: {} },
      ],
    })
  }
  if (/STAGE: REPAIR/i.test(text)) {
    // Re-validate once per repair attempt; the verifier re-checks afterwards.
    return JSON.stringify({ reasoning: 're-run validation', tool: 'run_tests', args: {} })
  }
  if (/STAGE: EXECUTOR/i.test(text)) {
    return JSON.stringify({ done: true, summary: 'Mock agent completed the scripted plan.' })
  }
  if (/STAGE: REPORTER/i.test(text)) {
    return JSON.stringify({
      status: 'success',
      summary: 'Mock agent ran the planned steps and validation passed.',
      changes: [],
      validation: 'passed',
      followUps: [],
    })
  }
  return JSON.stringify({ done: true, summary: 'Mock agent: nothing to do.' })
}
