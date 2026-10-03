/**
 * Code search — ranking helpers used to build *targeted* context.
 *
 * The context builder never dumps the whole repo into a prompt: it searches
 * for the task's own vocabulary, then reads only the top hits.
 */

import { readdir, readFile, stat } from 'node:fs/promises'
import { extname, join, relative, sep } from 'node:path'

/** @typedef {{ path: string, line: number, text: string, score: number }} CodeHit */

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', 'coverage', '.vercel', '.agent',
  '__pycache__', '.venv', 'venv', 'ironclad-armory',
])

const TEXT_EXTS = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.json', '.md', '.css', '.html',
  '.yml', '.yaml', '.toml', '.txt', '.example',
])

const MAX_HITS = 40
const MAX_FILES = 2500

/**
 * Split a natural-language task into search tokens (lowercase, deduped,
 * stopwords removed).
 * @param {string} task
 * @returns {string[]}
 */
export function tokenize(task) {
  const stop = new Set([
    'the', 'and', 'for', 'with', 'that', 'this', 'from', 'into', 'your', 'you',
    'please', 'add', 'a', 'an', 'to', 'of', 'in', 'on', 'is', 'are', 'be',
    'it', 'its', 'or', 'when', 'should', 'must', 'can', 'need', 'want', 'make',
  ])
  return [
    ...new Set(
      String(task)
        .toLowerCase()
        .split(/[^a-z0-9_]+/)
        .filter((w) => w.length > 2 && !stop.has(w)),
    ),
  ]
}

/**
 * Grep the workspace for task-relevant lines, scored by how many tokens match.
 *
 * @param {string} root
 * @param {string[]} tokens
 * @param {{ limit?: number, extensions?: Set<string> }} [opts]
 * @returns {Promise<CodeHit[]>}
 */
export async function searchRelevant(root, tokens, opts = {}) {
  const limit = opts.limit ?? 10
  const extensions = opts.extensions ?? TEXT_EXTS
  const lowerTokens = tokens.map((t) => t.toLowerCase())
  if (lowerTokens.length === 0) return []

  /** @type {CodeHit[]} */
  const hits = []
  let scanned = 0

  /**
   * @param {string} dir
   * @param {number} depth
   */
  async function walk(dir, depth) {
    if (scanned >= MAX_FILES || hits.length >= MAX_HITS * 3 || depth > 7) return
    /** @type {import('node:fs').Dirent[]} */
    let entries
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (scanned >= MAX_FILES || hits.length >= MAX_HITS * 3) return
      if (entry.name.startsWith('.') && entry.name !== '.env.example') continue
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue
        await walk(full, depth + 1)
        continue
      }
      if (!entry.isFile()) continue
      if (!extensions.has(extname(entry.name).toLowerCase())) continue
      scanned++
      try {
        if ((await stat(full)).size > 300_000) continue
        const text = await readFile(full, 'utf8')
        if (text.includes('\0')) continue
        const lines = text.split(/\r?\n/)
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].toLowerCase()
          let score = 0
          for (const token of lowerTokens) if (line.includes(token)) score++
          if (score > 0) {
            hits.push({
              path: relative(root, full).split(sep).join('/'),
              line: i + 1,
              text: lines[i].trim().slice(0, 200),
              score,
            })
          }
          if (hits.length >= MAX_HITS * 3) break
        }
      } catch {
        /* unreadable */
      }
    }
  }

  await walk(root, 0)
  return hits.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path)).slice(0, limit)
}

/**
 * Rank files by name match against the tokens (complements line search:
 * "auth.js" may never contain the word "login" in a matching line).
 *
 * @param {string} root
 * @param {string[]} tokens
 * @param {{ limit?: number }} [opts]
 * @returns {Promise<string[]>}
 */
export async function searchByFileName(root, tokens, opts = {}) {
  const limit = opts.limit ?? 8
  /** @type {{ path: string, score: number }[]} */
  const found = []
  let scanned = 0

  /** @param {string} dir @param {number} depth */
  async function walk(dir, depth) {
    if (scanned >= MAX_FILES || found.length >= limit * 4 || depth > 6) return
    /** @type {import('node:fs').Dirent[]} */
    let entries
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (scanned >= MAX_FILES || found.length >= limit * 4) return
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue
        await walk(full, depth + 1)
        continue
      }
      scanned++
      const name = entry.name.toLowerCase()
      let score = 0
      for (const token of tokens) if (name.includes(token)) score++
      if (score > 0) {
        found.push({ path: relative(root, full).split(sep).join('/'), score })
      }
    }
  }

  await walk(root, 0)
  return found
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))
    .slice(0, limit)
    .map((f) => f.path)
}
