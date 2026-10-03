import { readFile, stat } from 'node:fs/promises'
import { err, ok } from '../../utils/result.js'
import { resolveSafe } from '../safety.js'

/** @typedef {import('../../utils/types.js').Tool} Tool */

/**
 * read_file — load a workspace file (optionally a line range).
 * @type {Tool}
 */
export const readFileTool = {
  name: 'read_file',
  description:
    'Read a UTF-8 file from the workspace. Returns content with 1-based line numbers. Optionally restrict to a line range (startLine/endLine) for large files.',
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'File path, relative to the workspace root' },
      startLine: { type: 'integer', description: 'First line to return (1-based, inclusive)' },
      endLine: { type: 'integer', description: 'Last line to return (inclusive)' },
    },
    required: ['path'],
  },
  async execute(args, ctx) {
    const resolved = resolveSafe(ctx.workspaceRoot, args.path)
    if (!resolved.ok) return resolved
    const { abs } = /** @type {{abs: string, rel: string}} */ (resolved.data)
    try {
      const info = await stat(abs)
      if (info.isDirectory()) {
        return err(`"${resolved.data.rel}" is a directory — use list_files instead`)
      }
      if (info.size > 2_000_000) {
        return err(`"${resolved.data.rel}" is ${(info.size / 1e6).toFixed(1)} MB — too large to read whole`)
      }
      const text = await readFile(abs, 'utf8')
      const lines = text.split(/\r?\n/)
      const start = Math.max(1, Number(args.startLine) || 1)
      const end = Math.min(lines.length, Number(args.endLine) || lines.length)
      if (start > lines.length) {
        return err(`startLine ${start} is past the end of the file (${lines.length} lines)`)
      }
      const slice = lines.slice(start - 1, end)
      const numbered = slice
        .map((l, i) => `${String(start + i).padStart(5)}| ${l}`)
        .join('\n')
      return ok(numbered, { path: resolved.data.rel, totalLines: lines.length, range: [start, end] })
    } catch (e) {
      return err(`Cannot read "${args.path}": ${e instanceof Error ? e.message : e}`)
    }
  },
}
