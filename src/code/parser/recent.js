/**
 * Lightweight parsers for "recent changes" context.
 *
 * With no git binary available, we approximate change history from file
 * mtimes (which files were touched most recently) — cheap, dependency-free,
 * and enough to know what a previous agent run (or the developer) touched.
 */

import { readdir, stat } from 'node:fs/promises'
import { extname, join, relative, sep } from 'node:path'

/** @typedef {{ path: string, mtimeMs: number, size: number }} FileMeta */

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', 'coverage', '.vercel', '.agent',
  '__pycache__', '.venv', 'venv', 'ironclad-armory',
])

const CODE_EXTS = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.json', '.css', '.html', '.md', '.yml', '.yaml',
])

/**
 * Most-recently-modified source files.
 * @param {string} root
 * @param {{ limit?: number }} [opts]
 * @returns {Promise<FileMeta[]>}
 */
export async function recentFiles(root, opts = {}) {
  const limit = opts.limit ?? 8
  /** @type {FileMeta[]} */
  const files = []
  let scanned = 0

  /** @param {string} dir @param {number} depth */
  async function walk(dir, depth) {
    if (scanned > 3000 || depth > 6) return
    /** @type {import('node:fs').Dirent[]} */
    let entries
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (scanned > 3000) return
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue
        await walk(full, depth + 1)
        continue
      }
      if (!CODE_EXTS.has(extname(entry.name).toLowerCase())) continue
      scanned++
      try {
        const info = await stat(full)
        files.push({
          path: relative(root, full).split(sep).join('/'),
          mtimeMs: info.mtimeMs,
          size: info.size,
        })
      } catch {
        /* skip */
      }
    }
  }

  await walk(root, 0)
  return files.sort((a, b) => b.mtimeMs - a.mtimeMs).slice(0, limit)
}

/**
 * Format recent files as a context block.
 * @param {FileMeta[]} files
 * @returns {string}
 */
export function formatRecent(files) {
  if (files.length === 0) return '(no recent source changes detected)'
  const now = Date.now()
  return files
    .map((f) => {
      const ageMin = Math.max(0, Math.round((now - f.mtimeMs) / 60000))
      const age = ageMin < 60 ? `${ageMin}m ago` : `${Math.round(ageMin / 60)}h ago`
      return `- ${f.path} (${age}, ${f.size}B)`
    })
    .join('\n')
}
