import { err, ok } from '../../utils/result.js'
import { runShell } from '../terminal/run_command.js'

/** @typedef {import('../../utils/types.js').Tool} Tool */

/**
 * Detect whether a git executable is usable in the workspace.
 * (This machine currently has no `git` on PATH — tools must degrade to a
 * clear structured error rather than throwing.)
 *
 * @param {string} workspaceRoot
 * @returns {Promise<boolean>}
 */
export async function gitAvailable(workspaceRoot) {
  const r = await runShell('git --version', { cwd: workspaceRoot, timeoutMs: 10_000, allowUnsafe: false })
  return r.code === 0 && /git version/i.test(r.stdout)
}

/**
 * @param {string} workspaceRoot
 * @returns {Promise<import('../../utils/result.js').Result>}
 */
async function requireGit(workspaceRoot) {
  if (await gitAvailable(workspaceRoot)) return ok({ git: true })
  return err(
    'git executable not found on PATH. Install Git (https://git-scm.com) or run `git init` to enable repository tools. ' +
      'Falling back: use list_files / read_file / search_files for repository awareness.',
  )
}

/**
 * git_status — porcelain status of the workspace.
 * @type {Tool}
 */
export const gitStatusTool = {
  name: 'git_status',
  description:
    'Show the git status of the workspace (modified/untracked files). Returns a structured error when git is unavailable — the repository may not be under version control.',
  inputSchema: { type: 'object', properties: {}, required: [] },
  async execute(_args, ctx) {
    const guard = await requireGit(ctx.workspaceRoot)
    if (!guard.ok) return guard
    const r = await runShell('git status --porcelain=v1 --branch', {
      cwd: ctx.workspaceRoot,
      timeoutMs: 20_000,
      allowUnsafe: false,
    })
    if (r.code !== 0) return err(`git status failed: ${r.stderr.trim() || r.stdout.trim()}`)
    const lines = r.stdout.trim().split('\n').filter(Boolean)
    const branch = lines[0]?.replace('## ', '') ?? 'unknown'
    const files = lines.slice(1)
    return ok(
      `branch: ${branch}\n${files.length ? files.join('\n') : '(clean working tree)'}`,
      { branch, changed: files.length },
    )
  },
}

/**
 * git_diff — unstaged diff (or staged with stage:true), optionally scoped.
 * @type {Tool}
 */
export const gitDiffTool = {
  name: 'git_diff',
  description:
    'Show the git diff of the workspace (unstaged changes by default; set staged:true for the index; set path to scope to one file). Use this to review your own edits before reporting.',
  inputSchema: {
    type: 'object',
    properties: {
      staged: { type: 'boolean', description: 'Diff the index instead of the working tree' },
      path: { type: 'string', description: 'Limit the diff to this path' },
      stat: { type: 'boolean', description: 'Only show the per-file summary (shorter output)' },
    },
    required: [],
  },
  async execute(args, ctx) {
    const guard = await requireGit(ctx.workspaceRoot)
    if (!guard.ok) return guard
    const flags = [args.staged ? '--staged' : '', args.stat ? '--stat' : '', typeof args.path === 'string' ? `-- "${args.path}"` : '']
      .filter(Boolean)
      .join(' ')
    const r = await runShell(`git diff --no-color ${flags}`, {
      cwd: ctx.workspaceRoot,
      timeoutMs: 30_000,
      allowUnsafe: false,
    })
    if (r.code !== 0) return err(`git diff failed: ${r.stderr.trim() || r.stdout.trim()}`)
    const out = r.stdout.trim()
    if (!out) return ok('(no differences)', { empty: true })
    return ok(out, { bytes: out.length })
  },
}
