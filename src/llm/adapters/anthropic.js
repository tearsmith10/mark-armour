import { httpJson } from './http.js'

/** @typedef {import('../../utils/types.js').ChatMessage} ChatMessage */
/** @typedef {import('../../utils/types.js').LLMProvider} LLMProvider */

/**
 * Anthropic Messages adapter. System prompts are split out of the message list
 * per the API contract, so callers can keep sending plain chat arrays.
 *
 * @param {{ baseUrl: string, model: string, apiKey: string|null, timeoutMs?: number, temperature?: number }} opts
 * @returns {LLMProvider}
 */
export function anthropicAdapter(opts) {
  const baseUrl = (opts.baseUrl || 'https://api.anthropic.com').replace(/\/$/, '')
  if (!opts.apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set — export it (or use AGENT_LLM_PROVIDER=ollama).')
  }
  return {
    id: 'anthropic',
    model: opts.model,
    /**
     * @param {ChatMessage[]} messages
     * @param {{ timeoutMs?: number, temperature?: number }} [call]
     */
    async complete(messages, call = {}) {
      const system = messages
        .filter((m) => m.role === 'system')
        .map((m) => m.content)
        .join('\n\n')
      const rest = messages.filter((m) => m.role !== 'system')
      // Anthropic requires alternating user/assistant turns starting with user.
      const normalized = []
      for (const m of rest) {
        const prev = normalized[normalized.length - 1]
        if (prev && prev.role === m.role) {
          prev.content += `\n\n${m.content}`
        } else {
          normalized.push({ role: m.role, content: m.content })
        }
      }
      if (normalized.length === 0 || normalized[0].role !== 'user') {
        normalized.unshift({ role: 'user', content: '(continue)' })
      }
      const data = await httpJson(`${baseUrl}/v1/messages`, {
        headers: {
          'x-api-key': opts.apiKey ?? '',
          'anthropic-version': '2023-06-01',
        },
        body: {
          model: opts.model,
          max_tokens: 4096,
          temperature: call.temperature ?? opts.temperature ?? 0.2,
          ...(system ? { system } : {}),
          messages: normalized,
        },
        timeoutMs: call.timeoutMs ?? opts.timeoutMs ?? 120_000,
      })
      const content = data?.content?.[0]?.text
      if (typeof content !== 'string' || !content.trim()) {
        throw new Error(`Anthropic returned no content (${JSON.stringify(data).slice(0, 200)})`)
      }
      return content.trim()
    },
  }
}
