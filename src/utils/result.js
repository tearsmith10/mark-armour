/**
 * Structured result helpers.
 *
 * Every tool and most subsystems return a `Result` instead of throwing, so the
 * agent can inspect failures, feed them back to the LLM and self-correct
 * without crashing the whole run.
 *
 * @typedef {{ ok: true, data: any, error: null, meta: Record<string, any> }} OkResult
 * @typedef {{ ok: false, data: any, error: string, meta: Record<string, any> }} ErrResult
 * @typedef {OkResult | ErrResult} Result
 */

/**
 * @param {any} [data]
 * @param {Record<string, any>} [meta]
 * @returns {OkResult}
 */
export function ok(data, meta) {
  return { ok: true, data: data ?? null, error: null, meta: meta ?? {} }
}

/**
 * @param {unknown} error
 * @param {Record<string, any>} [meta]
 * @param {any} [data]
 * @returns {ErrResult}
 */
export function err(error, meta, data) {
  const message =
    typeof error === 'string'
      ? error
      : error instanceof Error
        ? error.message
        : JSON.stringify(error)
  return { ok: false, data: data ?? null, error: message, meta: meta ?? {} }
}

/** @param {Result} r @returns {r is OkResult} */
export function isOk(r) {
  return r?.ok === true
}

/** @param {Result} r @returns {r is ErrResult} */
export function isErr(r) {
  return r?.ok === false
}
