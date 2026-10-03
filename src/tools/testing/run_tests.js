import { spawnSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { err, ok } from '../../utils/result.js'
import { redact, truncate } from '../../utils/text.js'
import { runShell } from '../terminal/run_command.js'

/** @typedef {import('../../utils/types.js').Tool} Tool */
/** @typedef {import('../../utils/result.js').Result} Result */

/** Order in which we look for a validation script in package.json. */
export const SCRIPT_PRIORITY = ['test', 'lint', 'typecheck', 'check', 'build']

/** Directories skipped when enumerating sources for syntax checks. */
const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', 'coverage', '.vercel', '.agent',
  '__pycache__', '.venv', 'venv', 'ironclad-armory',
])

/**
 * Detect the project's validation command from its package.json scripts.
 * Returns `{ command: null }` when the project defines none (caller falls back
 * to an in-process `node --check` sweep).
 *
 * @param {string} workspaceRoot
 * @param {string[]|null} forced   AGENT_VERIFY_COMMANDS override
 * @returns {{ command: string|null, source: string }}
 */
export function detectTestCommand(workspaceRoot, forced) {
  if (forced && forced.length) {
    return { command: forced.join(' && '), source: 'AGENT_VERIFY_COMMANDS' }
  }
  /** @type {Record<string,string>} */
  let scripts = {}
  try {
    const pkg = JSON.parse(readFileSync(join(workspaceRoot, 'package.json'), 'utf8'))
    scripts = pkg?.scripts ?? {}
  } catch {
    return { command: null, source: 'no package.json' }
  }
  for (const name of SCRIPT_PRIORITY) {
    const value = scripts[name]
    if (typeof value === 'string' && value.trim()) {
      return { command: `npm run ${name}`, source: `package.json scripts.${name}` }
    }
  }
  return { command: null, source: 'no validation script defined' }
}

/**
 * Collect JS source files for an in-process syntax sweep.
 * No shell quoting involved — safe on Windows, macOS and Linux.
 *
 * @param {string} root
 * @param {number} [limit]
 * @returns {string[]}
 */
export function collectJsFiles(root, limit = 400) {
  /** @type {string[]} */
  const files = []
  /** @param {string} dir @param {number} depth */
  const walk = (dir, depth) => {
    if (files.length >= limit || depth > 8) return
    /** @type {import('node:fs').Dirent[]} */
    let entries
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (files.length >= limit) return
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue
        walk(join(dir, entry.name), depth + 1)
      } else if (/\.(js|mjs|cjs)$/.test(entry.name)) {
        files.push(join(dir, entry.name))
      }
    }
  }
  walk(root, 0)
  return files
}

/**
 * `node --check` over every source file — the fallback validation gate for
 * projects that define no scripts. Uses spawnSync (no shell) so paths with
 * spaces/quotes are handled correctly.
 *
 * @param {string} root
 * @returns {Result}
 */
export function nodeCheckAll(root) {
  const files = collectJsFiles(root)
  if (files.length === 0) {
    return ok('No JavaScript source files found to check', { source: 'node --check' })
  }
  /** @type {string[]} */
  const failures = []
  for (const file of files) {
    const r = spawnSync(process.execPath, ['--check', file], {
      encoding: 'utf8',
      timeout: 20_000,
      windowsHide: true,
    })
    if (r.status !== 0) {
      failures.push(`${file}: ${redact(truncate((r.stderr || r.stdout || '').trim(), 400))}`)
    }
  }
  if (failures.length) {
    return err(
      `node --check failed for ${failures.length} of ${files.length} file(s)`,
      { source: 'node --check' },
      failures.join('\n---\n'),
    )
  }
  return ok(`node --check passed for ${files.length} file(s)`, { source: 'node --check' })
}

/**
 * run_tests — run the project's validation suite (the verifier's workhorse).
 * @type {Tool}
 */
export const runTestsTool = {
  name: 'run_tests',
  description:
    "Run the project's validation: the package.json test/lint/typecheck/build script (auto-detected), or an explicit command. Returns pass/fail plus captured output. Use this after every code change.",
  inputSchema: {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description:
          'Optional explicit command; defaults to the auto-detected project validation script',
      },
    },
    required: [],
  },
  dangerous: true,
  async execute(args, ctx) {
    const root = ctx.workspaceRoot
    let command
    let source
    if (typeof args.command === 'string' && args.command.trim()) {
      command = args.command.trim()
      source = 'explicit'
    } else {
      const detected = detectTestCommand(root, ctx.settings.agent.verifyCommands)
      command = detected.command
      source = detected.source
    }

    if (!command) {
      ctx.logger.info('tests:start', { source: 'node --check (no project script)' })
      return nodeCheckAll(root)
    }

    ctx.logger.info('tests:start', { command, source })
    const result = await runShell(command, {
      cwd: root,
      timeoutMs: ctx.settings.agent.commandTimeoutMs,
      allowUnsafe: ctx.settings.agent.allowUnsafe,
    })
    const output = redact(truncate([result.stdout, result.stderr].filter(Boolean).join('\n').trim(), 8000))

    if (result.timedOut) {
      return err(`Validation timed out: ${command}`, { timedOut: true }, output)
    }
    if (result.code !== 0) {
      return err(
        `Validation FAILED (exit ${result.code}) — ${command}`,
        { code: result.code, source },
        output || '(no output)',
      )
    }
    return ok(output || `Validation passed — ${command}`, { code: 0, source })
  },
}
