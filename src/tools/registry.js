/**
 * Tool registry — the single extension point of the agent.
 *
 * Tools register themselves with { name, description, inputSchema, execute }.
 * The agent core only knows `registry.list()` and `registry.execute()`, so new
 * capabilities can be added (or removed) without touching planner/executor.
 *
 * Execution guarantees:
 *  - unknown tool            -> structured error (not a throw)
 *  - thrown exception        -> caught and converted to a structured error
 *  - output is truncated     -> bounded so a huge file cannot blow the context
 *  - every call is logged    -> audit trail for the run record
 */

/** @typedef {import('../utils/types.js').Tool} Tool */
/** @typedef {import('../utils/types.js').ToolContext} ToolContext */
/** @typedef {import('../utils/result.js').Result} Result */
/** @typedef {import('../logging/logger.js').Logger} Logger */

const MAX_OUTPUT_CHARS = 8000

export class ToolRegistry {
  /**
   * @param {ToolContext} ctx
   */
  constructor(ctx) {
    /** @type {Map<string, Tool>} */
    this.tools = new Map()
    this.ctx = ctx
    /** @type {Logger} */
    this.logger = ctx.logger.child({ mod: 'tools' })
  }

  /**
   * Register a tool. Throws on duplicate names / malformed definitions so
   * programming errors surface immediately at startup, not mid-run.
   * @param {Tool} tool
   * @returns {this}
   */
  register(tool) {
    if (!tool || typeof tool.name !== 'string' || !tool.name) {
      throw new Error('Tool must have a non-empty name')
    }
    if (typeof tool.execute !== 'function') {
      throw new Error(`Tool "${tool.name}" is missing an execute() function`)
    }
    if (!tool.description) {
      throw new Error(`Tool "${tool.name}" is missing a description`)
    }
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool "${tool.name}" is already registered`)
    }
    this.tools.set(tool.name, tool)
    return this
  }

  /**
   * @param {string} name
   * @returns {Tool|undefined}
   */
  get(name) {
    return this.tools.get(name)
  }

  /** @returns {Tool[]} */
  list() {
    return [...this.tools.values()]
  }

  /**
   * Compact tool descriptions for the LLM system prompt.
   * @returns {{ name: string, description: string, input: any, dangerous?: boolean }[]}
   */
  manifest() {
    return this.list().map((t) => ({
      name: t.name,
      description: t.description,
      input: t.inputSchema,
      ...(t.dangerous ? { dangerous: true } : {}),
    }))
  }

  /**
   * Execute a tool by name with structured error handling.
   * @param {string} name
   * @param {any} args
   * @returns {Promise<Result>}
   */
  async execute(name, args) {
    const started = Date.now()
    const tool = this.tools.get(name)
    if (!tool) {
      const known = this.list()
        .map((t) => t.name)
        .join(', ')
      this.logger.warn('unknown tool', { name })
      return {
        ok: false,
        data: null,
        error: `Unknown tool "${name}". Available: ${known}`,
        meta: {},
      }
    }
    this.logger.info('tool:start', { name, args: briefArgs(args) })
    try {
      const result = await tool.execute(args ?? {}, this.ctx)
      const normalized = normalizeResult(result)
      this.logger.info('tool:done', {
        name,
        ok: normalized.ok,
        ms: Date.now() - started,
        ...(normalized.ok ? {} : { error: normalized.error }),
      })
      return normalized
    } catch (e) {
      const message = e instanceof Error ? `${e.message}` : JSON.stringify(e)
      this.logger.error('tool:threw', { name, error: message })
      return { ok: false, data: null, error: message, meta: { thrown: true } }
    }
  }
}

/**
 * Force a Result shape and cap the payload size.
 * @param {any} result
 * @returns {Result}
 */
function normalizeResult(result) {
  if (result && typeof result === 'object' && 'ok' in result) {
    if (result.ok) {
      /** @type {import('../utils/result.js').OkResult} */
      const out = {
        ok: true,
        data: result.data ?? null,
        error: null,
        meta: result.meta ?? {},
      }
      if (typeof out.data === 'string' && out.data.length > MAX_OUTPUT_CHARS) {
        out.data = `${out.data.slice(0, MAX_OUTPUT_CHARS)}\n… [truncated ${out.data.length - MAX_OUTPUT_CHARS} chars]`
        out.meta = { ...out.meta, truncated: true }
      }
      return out
    }
    /** @type {import('../utils/result.js').ErrResult} */
    const out = {
      ok: false,
      data: result.data ?? null,
      error: String(result.error ?? 'unknown error'),
      meta: result.meta ?? {},
    }
    return out
  }
  // A tool returning raw data is treated as success.
  const data =
    typeof result === 'string' ? result : JSON.stringify(result ?? null, null, 2)
  return {
    ok: true,
    data: data.length > MAX_OUTPUT_CHARS ? `${data.slice(0, MAX_OUTPUT_CHARS)}\n… [truncated]` : data,
    error: null,
    meta: {},
  }
}

/**
 * @param {any} args
 * @returns {Record<string, any>}
 */
function briefArgs(args) {
  if (!args || typeof args !== 'object') return {}
  /** @type {Record<string, any>} */
  const out = {}
  for (const [k, v] of Object.entries(args)) {
    const s = typeof v === 'string' ? v : JSON.stringify(v)
    out[k] = s && s.length > 120 ? `${s.slice(0, 117)}…` : v
  }
  return out
}
