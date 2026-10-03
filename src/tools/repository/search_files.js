import { readdir, readFile, stat } from 'node:fs/promises'
import { extname, join, relative, sep } from 'node:path'
import { err, ok } from '../../utils/result.js'
import { resolveSafe } from '../safety.js'

/** @typedef {import('../../utils/types.js').Tool} Tool */

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

const TEXT_EXTS = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.json', '.md', '.txt', '.css', '.html',
  '.yml', '.yaml', '.toml', '.env.example', '.sh', '.py', '.sql', '.svg', '.csv',
])

const MAX_MATCHES = 60
const MAX_FILES_SCANNED = 3000
const MAX_LINE = 400

/**
 * search_files — literal or regex content search across the workspace.
 * The repository-aware counterpart to the LLM guessing where code lives.
 * @type {Tool}
 */
export const searchFilesTool = {
  name: 'search_files',
  description:
    'Search file contents in the workspace. Returns "path:line: text" matches. Supports literal text (default) or a JavaScript regular expression, an optional glob-ish extension filter (e.g. ".js") and a subdirectory scope.',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Text or pattern to search for' },
      isRegex: { type: 'boolean', description: 'Treat query as a JavaScript RegExp (default false)' },
      extension: {
        type: 'string',
        description: 'Only search files with this extension, e.g. ".jsx" (default: all text files)',
      },
      path: { type: 'string', description: 'Subdirectory to restrict the search to' },
      caseSensitive: { type: 'boolean', description: 'Default false (case-insensitive)' },
    },
    required: ['query'],
  },
  async execute(args, ctx) {
    const query = typeof args.query === 'string' ? args.query : ''
    if (!query) return err('query must be a non-empty string')

    /** @type {RegExp} */
    let regex
    try {
      regex = new RegExp(
        args.isRegex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        args.caseSensitive ? 'g' : 'gi',
      )
    } catch (e) {
      return err(`Invalid regular expression: ${e instanceof Error ? e.message : e}`)
    }

    const scopeRel = typeof args.path === 'string' && args.path.trim() ? args.path : '.'
    const resolved = resolveSafe(ctx.workspaceRoot, scopeRel)
    if (!resolved.ok) return resolved
    const { abs: scopeAbs, rel: scopeRelClean } = /** @type {{abs: string, rel: string}} */ (resolved.data)
    const extFilter = typeof args.extension === 'string' && args.extension ? args.extension.toLowerCase() : null

    /** @type {string[]} */
    const matches = []
    let scanned = 0
    let truncated = false

    /**
     * @param {string} dir
     * @returns {Promise<void>}
     */
    async function walk(dir) {
      if (truncated || scanned >= MAX_FILES_SCANNED || matches.length >= MAX_MATCHES) return
      let entries
      try {
        entries = await readdir(dir, { withFileTypes: true })
      } catch {
        return
      }
      for (const entry of entries) {
        if (truncated || scanned >= MAX_FILES_SCANNED || matches.length >= MAX_MATCHES) break
        const full = join(dir, entry.name)
        if (entry.isDirectory()) {
          if (SKIP_DIRS.has(entry.name)) continue
          await walk(full)
          continue
        }
        if (!entry.isFile()) continue
        if (extFilter && !entry.name.toLowerCase().endsWith(extFilter)) continue
        const ext = extname(entry.name).toLowerCase()
        if (ext && !TEXT_EXTS.has(ext) && !entry.name.startsWith('.env')) continue
        scanned++
        try {
          const info = await stat(full)
          if (info.size > 500_000) continue
          const text = await readFile(full, 'utf8')
          if (text.includes('\0')) continue // binary
          const lines = text.split(/\r?\n/)
          for (let i = 0; i < lines.length; i++) {
            if (matches.length >= MAX_MATCHES) {
              truncated = true
              break
            }
            regex.lastIndex = 0
            if (regex.test(lines[i])) {
              const shown = lines[i].trim().slice(0, MAX_LINE)
              matches.push(`${relative(ctx.workspaceRoot, full).split(sep).join('/')}:${i + 1}: ${shown}`)
            }
          }
        } catch {
          /* unreadable file — skip */
        }
      }
    }

    await walk(scopeAbs)

    if (matches.length === 0) {
      return ok(`No matches for ${JSON.stringify(query)} in ${scopeRelClean} (scanned ${scanned} files)`, {
        matches: 0,
        scanned,
      })
    }
    const suffix = truncated ? `\n… [stopped at ${MAX_MATCHES} matches]` : ''
    return ok(`${matches.join('\n')}${suffix}`, { matches: matches.length, scanned, truncated })
  },
}
