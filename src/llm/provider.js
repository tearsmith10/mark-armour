/**
 * LLM provider interface.
 *
 * Contract (see `LLMProvider` in src/utils/types.js):
 *   { id, model, complete(messages, opts?) -> Promise<string> }
 *
 * The agent only ever calls `complete()` with a plain chat-message array, so
 * providers are swappable through configuration (`AGENT_LLM_PROVIDER`).
 */

import { PROVIDERS } from './models.js'
import { ollamaAdapter } from './adapters/ollama.js'
import { openaiAdapter } from './adapters/openai.js'
import { anthropicAdapter } from './adapters/anthropic.js'
import { mockAdapter } from './adapters/mock.js'

/** @typedef {import('../utils/types.js').LLMProvider} LLMProvider */
/** @typedef {import('../config/index.js').Settings} Settings */

/**
 * Construct the configured provider adapter.
 * @param {Settings['llm']} llm
 * @returns {LLMProvider}
 */
export function createProvider(llm) {
  if (!(llm.provider in PROVIDERS)) {
    throw new Error(`Unknown LLM provider "${llm.provider}"`)
  }
  switch (llm.provider) {
    case 'ollama':
      return ollamaAdapter({ baseUrl: llm.baseUrl, model: llm.model, timeoutMs: llm.timeoutMs })
    case 'openai':
      return openaiAdapter({
        baseUrl: llm.baseUrl,
        model: llm.model,
        apiKey: llm.apiKey,
        timeoutMs: llm.timeoutMs,
        temperature: llm.temperature,
      })
    case 'anthropic':
      return anthropicAdapter({
        baseUrl: llm.baseUrl,
        model: llm.model,
        apiKey: llm.apiKey,
        timeoutMs: llm.timeoutMs,
        temperature: llm.temperature,
      })
    case 'mock':
      return mockAdapter({ script: llm.mockScript })
    default:
      throw new Error(`Unhandled provider "${llm.provider}"`)
  }
}

/**
 * A short, human-readable status line printed by the CLI before a run.
 * @param {Settings['llm']} llm
 * @returns {string}
 */
export function describeProvider(llm) {
  const info = PROVIDERS[llm.provider]
  const keyNote = info.envKey
    ? llm.apiKey
      ? `${info.envKey} ✓`
      : `${info.envKey} ✗ (missing)`
    : 'no key required'
  return `${info.label} · model=${llm.model} · ${keyNote}`
}
