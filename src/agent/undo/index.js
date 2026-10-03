/**
 * Undo — revert the file changes a previous run made.
 *
 * Every successful `write_file` / `edit_file` action stores a snapshot of the
 * previous file version in the run record (`.agent/runs/<id>.json`). Undo
 * replays those snapshots in reverse order:
 *
 *   file created by the run  → delete it
 *   file overwritten          → restore the previous content
 *   file changed since the run → skipped (undo never clobbers newer work)
 *   no snapshot (too large)   → skipped, reported honestly
 *
 * Undo itself writes an audit record (`.agent/runs/undo-*.json`) so the chain
 * of modifications stays inspectable.
 */

import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { resolveSafe } from '../../tools/safety.js'
import { err, ok } from '../../utils/result.js'
import { contentHash } from '../../utils/text.js'

/** @typedef {import('../../utils/result.js').Result} Result */
/** @typedef {import('../../utils/types.js').RunRecord} RunRecord */
/** @typedef {import('../../logging/logger.js').Logger} Logger */

/** @typedef {{ id: string, task: string, status: string, kind: string, startedAt: string,
 *              finishedAt: string|null, actions: number, file: string }} RunSummary */

const RUNS_DIR = '.agent/runs'

/**
 * List saved runs (and undo records), newest first.
 * @param {string} workspaceRoot
 * @param {number} [limit]
 * @returns {Promise<RunSummary[]>}
 */
export async function listRuns(workspaceRoot, limit = 20) {
  const dir = join(workspaceRoot, RUNS_DIR)
  /** @type {import('node:fs').Dirent[]} */
  let entries
  try {
    entries = (await readdir(dir, { withFileTypes: true })).filter(
      (e) => e.isFile() && e.name.endsWith('.json'),
    )
  } catch {
    return []
  }

  /** @type {RunSummary[]} */
  const runs = []
  for (const entry of entries) {
    const file = join(dir, entry.name)
    try {
      const parsed = JSON.parse(await readFile(file, 'utf8'))
      const info = await stat(file)
      runs.push({
        id: String(parsed.id ?? entry.name.replace(/\.json$/, '')),
        task: String(parsed.task ?? '(unknown task)'),
        status: String(parsed.status ?? 'unknown'),
        kind: parsed.kind === 'undo' ? 'undo' : 'run',
        startedAt: String(parsed.startedAt ?? info.mtime.toISOString()),
        finishedAt: parsed.finishedAt ? String(parsed.finishedAt) : null,
        actions: Array.isArray(parsed.actions) ? parsed.actions.length : 0,
        file,
      })
    } catch {
      /* unreadable record — skip it rather than break the listing */
    }
  }
  runs.sort((a, b) => (a.startedAt < b.startedAt ? 1 : a.startedAt > b.startedAt ? -1 : 0))
  return runs.slice(0, limit)
}

/**
 * Resolve 'latest' (or a full id / id prefix) to an existing run record.
 * @param {string} workspaceRoot
 * @param {string} runId
 * @returns {Promise<Result>} data: { record, file }
 */
export async function loadRun(workspaceRoot, runId) {
  const dir = join(workspaceRoot, RUNS_DIR)
  const wanted = runId.trim()
  if (!wanted) return err('No run id given — use `--undo <run-id>` or `--undo latest`')

  try {
    await stat(dir)
  } catch {
    return err(`No runs found in ${dir} — the agent has not run here yet`)
  }

  if (wanted === 'latest') {
    const runs = (await listRuns(workspaceRoot, 100)).filter((r) => r.kind === 'run')
    if (!runs.length) return err('No runs recorded yet — nothing to undo')
    return ok({ record: await readRecord(runs[0].file), file: runs[0].file })
  }

  const direct = join(dir, `${wanted}.json`)
  try {
    await stat(direct)
    return ok({ record: await readRecord(direct), file: direct })
  } catch {
    /* fall through to prefix matching */
  }

  const runs = await listRuns(workspaceRoot, 500)
  const matches = runs.filter((r) => r.id.startsWith(wanted))
  if (matches.length === 1) return ok({ record: await readRecord(matches[0].file), file: matches[0].file })
  if (matches.length > 1) {
    return err(`Run id "${wanted}" is ambiguous (${matches.length} matches) — use a longer prefix`)
  }
  return err(`Run "${wanted}" not found — list runs with \`--list-runs\``)
}

/**
 * @param {string} file
 * @returns {Promise<RunRecord>}
 */
async function readRecord(file) {
  return /** @type {RunRecord} */ (JSON.parse(await readFile(file, 'utf8')))
}

/**
 * Revert the file mutations of a run, newest action first.
 *
 * @param {{ workspaceRoot: string, runId: string, logger: Logger }} args
 * @returns {Promise<Result>} data: { record, restored, removed, skipped, auditFile }
 */
export async function undoRun({ workspaceRoot, runId, logger }) {
  const log = logger.child({ mod: 'undo' })
  const loaded = await loadRun(workspaceRoot, runId)
  if (!loaded.ok) return loaded
  const { record, file: runFile } = /** @type {{ record: RunRecord, file: string }} */ (loaded.data)

  if (/** @type {any} */ (record).kind === 'undo') {
    return err(`"${record.id}" is an undo record, not a run — nothing to undo from it`)
  }

  /** @type {Array<import('../../utils/types.js').ActionRecord>} */
  const mutations = (record.actions ?? [])
    .filter(
      (a) =>
        a.ok &&
        (a.tool === 'write_file' || a.tool === 'edit_file') &&
        a.snapshot &&
        typeof a.input?.path === 'string',
    )
    .reverse()

  if (!mutations.length) {
    return err(
      `Run "${record.id}" recorded no reversible file changes (looked for write_file/edit_file snapshots)`,
    )
  }

  /** @type {string[]} */
  const restored = []
  /** @type {string[]} */
  const removed = []
  /** @type {{ path: string, reason: string }[]} */
  const skipped = []

  for (const action of mutations) {
    const rel = String(action.input?.path)
    const resolved = resolveSafe(workspaceRoot, rel, { write: true })
    if (!resolved.ok) {
      skipped.push({ path: rel, reason: String(resolved.error) })
      continue
    }
    const { abs } = /** @type {{ abs: string, rel: string }} */ (resolved.data)
    const snapshot = /** @type {import('../../utils/types.js').FileSnapshot} */ (action.snapshot)

    if (snapshot.skipped) {
      skipped.push({ path: rel, reason: 'no snapshot stored (file exceeded the snapshot size cap)' })
      continue
    }

    const current = await readIfExists(abs)

    if (!snapshot.existed) {
      if (current === null) {
        skipped.push({ path: rel, reason: 'file is already absent (already undone or deleted after the run)' })
        continue
      }
      if (conflicts(snapshot, current)) {
        skipped.push({ path: rel, reason: 'file was modified after this run — refusing to delete newer work' })
        continue
      }
      try {
        await rm(abs, { force: true })
        removed.push(rel)
        log.info('undo:removed', { path: rel })
      } catch (e) {
        skipped.push({ path: rel, reason: `cannot delete: ${e instanceof Error ? e.message : e}` })
      }
      continue
    }

    if (typeof snapshot.before !== 'string') {
      skipped.push({ path: rel, reason: 'snapshot has no previous content' })
      continue
    }
    if (current === null) {
      skipped.push({ path: rel, reason: 'file no longer exists — refusing to resurrect it' })
      continue
    }
    if (conflicts(snapshot, current)) {
      skipped.push({
        path: rel,
        reason: 'file changed after this run (edited by hand or by a later run) — refusing to overwrite newer work',
      })
      continue
    }
    try {
      await mkdir(join(abs, '..'), { recursive: true })
      await writeFile(abs, snapshot.before, 'utf8')
      restored.push(rel)
      log.info('undo:restored', { path: rel, bytes: snapshot.before.length })
    } catch (e) {
      skipped.push({ path: rel, reason: `cannot write: ${e instanceof Error ? e.message : e}` })
    }
  }

  const changed = restored.length + removed.length
  const message =
    `Undid ${changed} change(s) from run ${record.id}` +
    (skipped.length ? ` (${skipped.length} skipped)` : '')
  if (!changed && skipped.length) {
    const detail = skipped.map((s) => `${s.path}: ${s.reason}`).join('; ')
    return err(
      `Run ${record.id}: nothing was undone — ${skipped.length} recorded change(s) conflict with the current files (${detail})`,
      {},
      { record, restored, removed, skipped, auditFile: null },
    )
  }

  const auditFile = changed
    ? await writeUndoAudit(workspaceRoot, {
        run: record.id,
        task: record.task,
        runFile,
        restored,
        removed,
        skipped,
      })
    : null

  return ok({ message, record, restored, removed, skipped, auditFile })
}

/**
 * @param {string} abs
 * @returns {Promise<string|null>}
 */
async function readIfExists(abs) {
  try {
    return await readFile(abs, 'utf8')
  } catch {
    return null
  }
}

/**
 * True when the file on disk no longer matches what the run left behind.
 * @param {import('../../utils/types.js').FileSnapshot} snapshot
 * @param {string} current
 * @returns {boolean}
 */
function conflicts(snapshot, current) {
  if (!snapshot.afterHash) return false // older record — no integrity data
  return contentHash(current) !== snapshot.afterHash
}

/**
 * Persist an audit record of the undo itself.
 * @param {string} workspaceRoot
 * @param {{ run: string, task: string, runFile: string, restored: string[],
 *           removed: string[], skipped: { path: string, reason: string }[] }} summary
 * @returns {Promise<string|null>}
 */
async function writeUndoAudit(workspaceRoot, summary) {
  try {
    const dir = join(workspaceRoot, RUNS_DIR)
    await mkdir(dir, { recursive: true })
    const id = `undo-${summary.run}-${Date.now()}`
    const file = join(dir, `${id}.json`)
    await writeFile(
      file,
      JSON.stringify(
        {
          id,
          kind: 'undo',
          task: `undo ${summary.run}`,
          status: 'success',
          startedAt: new Date().toISOString(),
          finishedAt: new Date().toISOString(),
          actions: [
            ...summary.restored.map((p) => ({ action: `restore: ${p}`, ok: true, ts: Date.now() })),
            ...summary.removed.map((p) => ({ action: `delete: ${p}`, ok: true, ts: Date.now() })),
            ...summary.skipped.map((s) => ({
              action: `skip: ${s.path}`,
              ok: false,
              error: s.reason,
              ts: Date.now(),
            })),
          ],
          errors: summary.skipped.map((s) => `${s.path}: ${s.reason}`),
          undo: summary,
        },
        null,
        2,
      ),
      'utf8',
    )
    return file
  } catch {
    return null
  }
}
