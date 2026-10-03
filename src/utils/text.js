/** Text helpers shared by the logger, the LLM layer and the agent prompts. */

import { createHash } from 'node:crypto'

/**
 * Stable fingerprint of file content, used to detect that a file was modified
 * after the agent touched it (so `--undo` never clobbers newer work).
 * @param {string} text
 * @returns {string}
 */
export function contentHash(text) {
  return createHash('sha256').update(text).digest('hex')
}

/**
 * Truncate long text, keeping the head and tail (errors often matter at both
 * ends: stack traces start at the top, the summary sits at the bottom).
 * @param {unknown} value
 * @param {number} [max]
 * @returns {string}
 */
export function truncate(value, max = 4000) {
  const s = typeof value === 'string' ? value : JSON.stringify(value ?? '')
  if (s.length <= max) return s
  const head = Math.ceil(max * 0.6)
  const tail = max - head
  return `${s.slice(0, head)}\n… [${s.length - max} chars truncated] …\n${s.slice(-tail)}`
}

/**
 * Parse JSON that a model may have wrapped in ``` fences or prose.
 * Returns `null` when nothing parseable is found (never throws).
 * @param {string} text
 * @returns {any}
 */
export function safeJsonParse(text) {
  if (!text) return null
  const candidates = []
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) candidates.push(fence[1])
  candidates.push(text)
  const first = text.indexOf('{')
  const last = text.lastIndexOf('}')
  if (first >= 0 && last > first) candidates.push(text.slice(first, last + 1))
  for (const c of candidates) {
    try {
      const parsed = JSON.parse(c.trim())
      if (parsed !== null && parsed !== undefined) return parsed
    } catch {
      /* try next candidate */
    }
  }
  return null
}

/**
 * Lowercase slug for file names / run ids.
 * @param {string} s
 * @returns {string}
 */
export function slugify(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

/**
 * A redaction rule: match, plus either a literal replacement or a replacer
 * function (signature mirrors String.prototype.replace's callback).
 * @typedef {[RegExp, string | ((match: string, ...groups: string[]) => string)]} SecretPattern
 */

/** @type {SecretPattern[]} */
const SECRET_PATTERNS = [
  [/\b(?:sk|pk|rk)-[A-Za-z0-9_-]{16,}\b/g, '<redacted>'], // OpenAI / Stripe style keys
  [/\bgh[pousr]_[A-Za-z0-9]{20,}\b/g, '<redacted>'], // GitHub tokens
  [/\bAKIA[0-9A-Z]{16}\b/g, '<redacted>'], // AWS access keys
  [
    /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}/g,
    '<redacted>', // JWTs (Vercel OIDC etc.)
  ],
  // Auth headers first: consume scheme + token together so no tail survives.
  [/\b(bearer|basic)\s+[A-Za-z0-9._~+/=-]{8,}/gi, (_m, scheme) => `${scheme} <redacted>`],
  [
    /((?:api[_-]?key|apikey|access[_-]?token|refresh[_-]?token|token|secret|password|passwd|authorization|auth)\s*[=:]\s*)(["']?)(?:bearer\s+|basic\s+)?[^\s"',;&]{6,}/gi,
    (_m, key, quote) => `${key}${quote}<redacted>${quote}`,
  ],
]

/**
 * Replace credential-looking substrings before anything is logged or shown.
 * @param {string} s
 * @returns {string}
 */
export function redact(s) {
  let out = String(s ?? '')
  for (const [pattern, replacement] of SECRET_PATTERNS) {
    out = out.replace(pattern, /** @type {any} */ (replacement))
  }
  return out
}
