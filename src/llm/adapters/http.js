/** @typedef {import('../../utils/types.js').ChatMessage} ChatMessage */
/** @typedef {import('../../utils/types.js').LLMProvider} LLMProvider */

/**
 * Shared fetch wrapper for HTTP-based providers: JSON request, timeout via
 * AbortController, structured error that surfaces the upstream message (the
 * agent feeds that message back for self-correction).
 *
 * @param {string} url
 * @param {{ method?: string, headers?: Record<string,string>, body?: any, timeoutMs?: number }} opts
 * @returns {Promise<any>}
 */
export async function httpJson(url, opts) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 120_000)
  try {
    const res = await fetch(url, {
      method: opts.method ?? 'POST',
      headers: { 'Content-Type': 'application/json', ...(opts.headers ?? {}) },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      signal: controller.signal,
    })
    const text = await res.text()
    let data = null
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      data = { raw: text }
    }
    if (!res.ok) {
      const detail =
        data?.error?.message ??
        data?.error ??
        data?.message ??
        data?.raw ??
        text ??
        `HTTP ${res.status}`
      throw new Error(`${res.status} ${res.statusText}: ${String(detail).slice(0, 800)}`)
    }
    return data
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error(`LLM request timed out after ${opts.timeoutMs ?? 120_000}ms (${url})`)
    }
    if (e instanceof TypeError) {
      // fetch network failure
      throw new Error(`Cannot reach LLM endpoint ${url}: ${e.message}`)
    }
    throw e
  } finally {
    clearTimeout(timeout)
  }
}
