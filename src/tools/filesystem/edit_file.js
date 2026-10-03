import { readFile, writeFile } from 'node:fs/promises'
import { err, ok } from '../../utils/result.js'
import { resolveSafe } from '../safety.js'
import { contentHash } from '../../utils/text.js'
import { SNAPSHOT_MAX_BYTES } from './write_file.js'

/** @typedef {import('../../utils/types.js').Tool} Tool */

/**
 * edit_file — surgical find & replace inside a file.
 * Requires an exact, unique match (unless replaceAll) so an ambiguous pattern
 * fails loudly instead of patching the wrong occurrence.
 * @type {Tool}
 */
export const editFileTool = {
  name: 'edit_file',
  description:
    'Replace an exact text fragment in a file. oldText must match exactly once (or set replaceAll:true). Returns a diff summary; fails if the anchor is missing or ambiguous.',
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'File path, relative to the workspace root' },
      oldText: { type: 'string', description: 'Exact text to find (must be unique unless replaceAll)' },
      newText: { type: 'string', description: 'Replacement text (may be empty to delete)' },
      replaceAll: { type: 'boolean', description: 'Replace every occurrence (default false)' },
    },
    required: ['path', 'oldText', 'newText'],
  },
  dangerous: true,
  async execute(args, ctx) {
    const resolved = resolveSafe(ctx.workspaceRoot, args.path, { write: true })
    if (!resolved.ok) return resolved
    const { abs, rel } = /** @type {{abs: string, rel: string}} */ (resolved.data)
    const oldText = args.oldText
    const newText = args.newText
    if (typeof oldText !== 'string' || oldText === '') return err('oldText must be a non-empty string')
    if (typeof newText !== 'string') return err('newText must be a string')
    if (oldText === newText) return err('oldText and newText are identical — nothing to do')

    let text
    try {
      text = await readFile(abs, 'utf8')
    } catch (e) {
      return err(`Cannot read "${rel}": ${e instanceof Error ? e.message : e}`)
    }

    const count = text.split(oldText).length - 1
    if (count === 0) {
      return err(`oldText not found in ${rel} — read the file and match the content exactly`)
    }
    if (count > 1 && !args.replaceAll) {
      return err(
        `oldText matches ${count} times in ${rel} — provide more surrounding context to make it unique, or set replaceAll:true`,
      )
    }

    const updated = args.replaceAll ? text.split(oldText).join(newText) : text.replace(oldText, newText)
    if (updated === text) return err('Edit produced no change')

    try {
      await writeFile(abs, updated, 'utf8')
    } catch (e) {
      return err(`Cannot write "${rel}": ${e instanceof Error ? e.message : e}`)
    }
    ctx.logger.info('file:edited', { path: rel, occurrences: args.replaceAll ? count : 1 })
    return ok(
      `Replaced ${args.replaceAll ? count : 1} occurrence(s) in ${rel} ` +
        `(${text.length} → ${updated.length} bytes)`,
      {
        path: rel,
        replacements: args.replaceAll ? count : 1,
        // Previous version for `--undo <run>`.
        before: text.length <= SNAPSHOT_MAX_BYTES ? text : null,
        existed: true,
        snapshotSkipped: text.length > SNAPSHOT_MAX_BYTES,
        afterHash: contentHash(updated),
      },
    )
  },
}
