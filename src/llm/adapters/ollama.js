import { httpJson } from './http.js'

/** @typedef {import('../../utils/types.js').ChatMessage} ChatMessage */
/** @typedef {import('../../utils/types.js').LLMProvider} LLMProvider */

/**
 * Ollama adapter — matches the app's existing local-AI usage
 * (`src/lib/ai.js` calls `POST /api/chat` with `{model, messages, stream:false}`).
 *
 * @param {{ baseUrl: string, model: string, timeoutMs?: number }} opts
 * @returns {LLMProvider}
 */
export function ollamaAdapter(opts) {
  const baseUrl = (opts.baseUrl || 'http://localhost:11434').replace(/\/$/, '')
  return {
    id: 'ollama',
    model: opts.model,
    /**
     * @param {ChatMessage[]} messages
     * @param {{ timeoutMs?: number, temperature?: number }} [call]
     */
    async complete(messages, call = {}) {
      const data = await httpJson(`${baseUrl}/api/chat`, {
        body: {
          model: opts.model,
          messages,
          stream: false,
          options: { temperature: call.temperature ?? 0.2 },
        },
        timeoutMs: call.timeoutMs ?? opts.timeoutMs ?? 300_000,
      })
      const content = data?.message?.content
      if (typeof content !== 'string' || !content.trim()) {
        throw new Error(`Ollama returned an empty message (${JSON.stringify(data).slice(0, 200)})`)
      }
      return content.trim()
    },
  }
}
