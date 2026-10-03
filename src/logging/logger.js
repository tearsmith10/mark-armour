import { appendFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { redact } from '../utils/text.js'

/** @typedef {'debug'|'info'|'warn'|'error'|'silent'} LogLevel */

/** @type {Record<LogLevel, number>} */
const LEVELS = { debug: 10, info: 20, warn: 30, error: 40, silent: 100 }

/**
 * Small leveled logger: writes redacted lines to a sink (console by default)
 * and optionally appends them to a log file. A `sink` can be injected so tests
 * can capture output without touching the filesystem.
 *
 * Note: `Logger` is referenced from `src/utils/types.js` as
 * `import('../logging/logger.js').Logger`.
 */
export class Logger {
  /**
   * @param {{ level?: LogLevel, file?: string|null, sink?: (line: string) => void,
   *           bindings?: Record<string, any> }} [opts]
   */
  constructor(opts = {}) {
    /** @type {number} */
    this.threshold = LEVELS[opts.level ?? 'info'] ?? LEVELS.info
    /** @type {LogLevel} */
    this.level = opts.level ?? 'info'
    /** @type {string|null} */
    this.file = opts.file ?? null
    /** @type {Record<string, any>} */
    this.bindings = opts.bindings ?? {}
    /** @type {(line: string) => void} */
    this.sink =
      opts.sink ??
      ((line) => {
        process.stderr.write(`${line}\n`)
      })
  }

  /**
   * Child logger that carries extra fields on every line.
   * @param {Record<string, any>} bindings
   * @returns {Logger}
   */
  child(bindings) {
    const l = new Logger({
      level: this.level,
      file: this.file,
      sink: this.sink,
      bindings: { ...this.bindings, ...bindings },
    })
    return l
  }

  /**
   * @param {LogLevel} level
   * @param {string} msg
   * @param {Record<string, any>} [meta]
   */
  log(level, msg, meta) {
    const weight = LEVELS[level] ?? LEVELS.info
    if (weight < this.threshold) return
    const fields = { ...this.bindings, ...(meta ?? {}) }
    const suffix = Object.keys(fields).length ? ` ${safeStringify(fields)}` : ''
    const line = redact(`[${new Date().toISOString()}] ${level.toUpperCase()} ${msg}${suffix}`)
    try {
      this.sink(line)
    } catch {
      /* a broken sink must never break the run */
    }
    if (this.file) {
      try {
        mkdirSync(dirname(this.file), { recursive: true })
        appendFileSync(this.file, `${line}\n`)
      } catch {
        /* logging to file is best-effort */
      }
    }
  }

  /** @param {string} msg @param {Record<string, any>} [meta] */
  debug(msg, meta) {
    this.log('debug', msg, meta)
  }

  /** @param {string} msg @param {Record<string, any>} [meta] */
  info(msg, meta) {
    this.log('info', msg, meta)
  }

  /** @param {string} msg @param {Record<string, any>} [meta] */
  warn(msg, meta) {
    this.log('warn', msg, meta)
  }

  /** @param {string} msg @param {Record<string, any>} [meta] */
  error(msg, meta) {
    this.log('error', msg, meta)
  }
}

/**
 * JSON.stringify that never throws on cycles / BigInt.
 * @param {any} v
 * @returns {string}
 */
function safeStringify(v) {
  const seen = new WeakSet()
  try {
    return JSON.stringify(v, (_k, val) => {
      if (typeof val === 'bigint') return String(val)
      if (typeof val === 'object' && val !== null) {
        if (seen.has(val)) return '[circular]'
        seen.add(val)
      }
      return val
    })
  } catch {
    return '[unserializable]'
  }
}
