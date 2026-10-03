import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { err, ok } from '../../utils/result.js'
import { contentHash } from '../../utils/text.js'
import { resolveSafe } from '../safety.js'

/** @typedef {import('../../utils/types.js').Tool} Tool */

/** Largest previous-version we snapshot for `--undo` (256 KiB). */
export const SNAPSHOT_MAX_BYTES = 256 * 1024

/**
 * write_file — create or overwrite a workspace file.
 * Passing `create: false` refuses to overwrite an existing file (useful when
 * the agent should not clobber work it has not read).
 * @type {Tool}
 */
export const writeFileTool = {
  name: 'write_file',
  description:
    'Write content to a file in the workspace (creates parent directories). Overwrites existing files unless create:false is set.',
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'File path, relative to the workspace root' },
      content: { type: 'string', description: 'Full file content to write' },
      create: {
        type: 'boolean',
        description: 'If false, fail when the file already exists (default true = overwrite)',
      },
    },
    required: ['path', 'content'],
  },
  dangerous: true,
  async execute(args, ctx) {
    const resolved = resolveSafe(ctx.workspaceRoot, args.path, { write: true })
    if (!resolved.ok) return resolved
    const { abs, rel } = /** @type {{abs: string, rel: string}} */ (resolved.data)
    if (typeof args.content !== 'string') {
      return err('content must be a string')
    }
    if (args.create === false) {
      try {
        await readFile(abs, 'utf8')
        return err(`"${rel}" already exists and create:false was requested`)
      } catch {
        /* does not exist — fine */
      }
    }
    // Capture the previous version so `--undo <run>` can restore it.
    /** @type {{ path: string, before: string|null, existed: boolean, snapshotSkipped: boolean, afterHash?: string }} */
    const snapshot = { path: rel, before: null, existed: false, snapshotSkipped: false }
    try {
      const info = await stat(abs)
      snapshot.existed = true
      if (info.size <= SNAPSHOT_MAX_BYTES) {
        snapshot.before = await readFile(abs, 'utf8')
      } else {
        snapshot.snapshotSkipped = true
      }
    } catch {
      /* does not exist yet — snapshot.before stays null (undo will delete it) */
    }

    try {
      await mkdir(dirname(abs), { recursive: true })
      await writeFile(abs, args.content, 'utf8')
      snapshot.afterHash = contentHash(args.content)
      ctx.logger.info('file:written', { path: rel, bytes: args.content.length })
      return ok(`Wrote ${args.content.length} bytes to ${rel}`, snapshot)
    } catch (e) {
      return err(`Cannot write "${rel}": ${e instanceof Error ? e.message : e}`)
    }
  },
}
