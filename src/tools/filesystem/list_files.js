import { readdir, stat } from 'node:fs/promises'
import { join, sep } from 'node:path'
import { err, ok } from '../../utils/result.js'
import { resolveSafe } from '../safety.js'

/** @typedef {import('../../utils/types.js').Tool} Tool */

/** Directories never worth listing. */
const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  'coverage',
  '.vercel',
  '.agent',
  '__pycache__',
  '.venv',
  'venv',
])

/**
 * list_files — directory tree of the workspace (depth-limited, skipped dirs
 * excluded). Used for repository orientation during the CONTEXT stage.
 * @type {Tool}
 */
export const listFilesTool = {
  name: 'list_files',
  description:
    'List the workspace file tree starting at a path, up to maxDepth levels deep. Skips node_modules/.git/dist and other build artifacts. Returns one path per line.',
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Directory to list (default: workspace root)' },
      maxDepth: { type: 'integer', description: 'Tree depth, 1-6 (default 3)' },
    },
    required: [],
  },
  async execute(args, ctx) {
    const target = typeof args.path === 'string' && args.path.trim() ? args.path : '.'
    const resolved = resolveSafe(ctx.workspaceRoot, target)
    if (!resolved.ok) return resolved
    const { abs, rel } = /** @type {{abs: string, rel: string}} */ (resolved.data)
    const maxDepth = Math.min(6, Math.max(1, Number(args.maxDepth) || 3))

    try {
      const info = await stat(abs)
      if (!info.isDirectory()) return err(`"${rel}" is not a directory`)
    } catch (e) {
      return err(`Cannot access "${rel}": ${e instanceof Error ? e.message : e}`)
    }

    /** @type {string[]} */
    const lines = []
    let files = 0
    let dirs = 0

    /**
     * @param {string} dir
     * @param {string} prefix
     * @param {number} depth
     */
    async function walk(dir, prefix, depth) {
      if (depth > maxDepth || lines.length > 400) return
      let entries
      try {
        entries = await readdir(dir, { withFileTypes: true })
      } catch {
        return
      }
      entries.sort((a, b) => {
        if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1
        return a.name.localeCompare(b.name)
      })
      for (const entry of entries) {
        if (lines.length > 400) return
        const isDir = entry.isDirectory()
        if (isDir && SKIP_DIRS.has(entry.name)) continue
        const relPath = dir === abs ? entry.name : `${prefix}${entry.name}`
        lines.push(`${isDir ? 'dir ' : 'file'} ${relPath}`)
        if (isDir) {
          dirs++
          await walk(join(dir, entry.name), `${relPath}${sep}`, depth + 1)
        } else {
          files++
        }
      }
    }

    await walk(abs, '', 1)
    if (lines.length === 0) return ok('(empty directory)', { path: rel })
    const body = lines.join('\n')
    const suffix = lines.length > 400 ? '\n… [tree truncated at 400 entries]' : ''
    return ok(`${body}${suffix}`, { path: rel, files, dirs, truncated: lines.length > 400 })
  },
}
