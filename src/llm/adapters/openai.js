import { httpJson } from './http.js'

/** @typedef {import('../../utils/types.js').ChatMessage} ChatMessage */
/** @typedef {import('../../utils/types.js').LLMProvider} LLMProvider */

/**
 * OpenAI adapter (Chat Completions). Also works against any OpenAI-compatible
 * gateway via `OPENAI_BASE_URL` (vLLM, LM Studio, OpenRouter, …).
 *
 * @param {{ baseUrl: string, model: string, apiKey: string|null, timeoutMs?: number, temperature?: number }} opts
 * @returns {LLMProvider}
 */
export function openaiAdapter(opts) {
  const baseUrl = (opts.baseUrl || 'https://api.openai.com/v1').replace(/\/$/, '')
  if (!opts.apiKey) {
    throw new Error('OPENAI_API_KEY is not set — export it (or use AGENT_LLM_PROVIDER=ollama).')
  }
  return {
    id: 'openai',
    model: opts.model,
    /**
     * @param {ChatMessage[]} messages
     * @param {{ timeoutMs?: number, temperature?: number }} [call]
     */
    async complete(messages, call = {}) {
      const data = await httpJson(`${baseUrl}/chat/completions`, {
        headers: { Authorization: `Bearer ${opts.apiKey}` },
        body: {
          model: opts.model,
          messages,
          temperature: call.temperature ?? opts.temperature ?? 0.2,
          stream: false,
        },
        timeoutMs: call.timeoutMs ?? opts.timeoutMs ?? 120_000,
      })
      const content = data?.choices?.[0]?.message?.content
      if (typeof content !== 'string' || !content.trim()) {
        throw new Error(`OpenAI returned no content (${JSON.stringify(data).slice(0, 200)})`)
      }
      return content.trim()
    },
  }
}
