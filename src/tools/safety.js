/**
 * Path safety: every filesystem tool goes through `resolveSafe()` so the agent
 * cannot read or write outside its workspace, and certain sensitive files
 * (.env.local, keys, tokens) are refused outright.
 *
 * Rules:
 *  - relative paths resolve inside `workspaceRoot`
 *  - absolute paths must still land inside `workspaceRoot`
 *  - `..` traversal is rejected after normalization
 *  - deny-listed files (secrets) are rejected for read AND write
 *  - `.git/` internals are read-only (status/diff go through git tools)
 */

import { isAbsolute, relative, resolve, sep } from 'node:path'
import { err, ok } from '../utils/result.js'

/** @typedef {import('../utils/result.js').Result} Result */

/** Basenames that must never be touched by the agent. */
export const DENY_BASENAMES = [
  '.env.local',
  '.env.production',
  '.env.development',
  '.env',
  'id_rsa',
  'id_ed25519',
  'credentials.json',
]

/** Templates with no real secrets — safe (and useful) to read. */
export const ALLOW_BASENAMES = ['.env.example', '.env.sample', '.env.template']

/** Path fragments that are always denied (secret stores, keys). */
export const DENY_PATTERNS = [
  /(^|[\\/])\.env(\.[a-z]+)?$/i,
  /\.(pem|pfx|p12|key)$/i,
  /(^|[\\/])\.ssh([\\/]|$)/i,
  /(^|[\\/])\.aws([\\/]|$)/i,
  /(^|[\\/])secrets([\\/]|$)/i,
  /vercel\.json$/i, // deployment config — deploy tooling owns it
]

/**
 * @param {string} workspaceRoot
 * @param {string} inputPath
 * @param {{ write?: boolean }} [opts]
 * @returns {Result} data = { abs, rel } on success
 */
export function resolveSafe(workspaceRoot, inputPath, opts = {}) {
  if (typeof inputPath !== 'string' || !inputPath.trim()) {
    return err('path must be a non-empty string')
  }
  const raw = inputPath.trim()
  const abs = isAbsolute(raw) ? resolve(raw) : resolve(workspaceRoot, raw)
  const rel = relative(workspaceRoot, abs)
  if (rel.startsWith('..') || isAbsolute(rel)) {
    return err(`Path escapes the workspace: "${raw}" resolves to ${abs}`, {
      workspaceRoot,
    })
  }
  const relPosix = rel.split(sep).join('/')
  const base = abs.split(sep).pop() ?? ''
  if (!ALLOW_BASENAMES.includes(base)) {
    for (const pattern of DENY_PATTERNS) {
      if (pattern.test(relPosix) || pattern.test(abs.split(sep).join('/'))) {
        return err(`Access to "${relPosix || raw}" is denied by workspace safety policy`)
      }
    }
    if (DENY_BASENAMES.includes(base)) {
      return err(`Access to "${base}" is denied by workspace safety policy`)
    }
  }
  // Writing into .git internals would corrupt the repository.
  if (opts.write && /^\.git([/]|$)/i.test(relPosix)) {
    return err('Writing inside .git/ is not allowed — use the git tools instead')
  }
  return ok({ abs, rel: relPosix })
}

/**
 * Commands that may never run unless `AGENT_ALLOW_UNSAFE=1`.
 * Deliberately conservative: destructive / irreversible / exfiltration-ish.
 */
export const DANGEROUS_COMMAND_PATTERNS = [
  /\brm\s+(-[a-z]*\s+)*-(r|recursive|force|f)/i,
  /\brm\s+-[a-z]*r[a-z]*\s+\*|\brm\s+\*\s*$/i,
  /\bRemove-Item\b.*(-Recurse|-Force)/i,
  /\bdel\b.*\/[sf]/i,
  /\brmdir\b.*\/s/i,
  /\bmkfs\b|\bformat\b\s+[a-z]:|\bdd\b\s+if=/i,
  /\bgit\s+push\s+.*(--force|-f)\b/i,
  /\bgit\s+reset\s+--hard\b/i,
  /\bgit\s+clean\s+-[a-z]*f/i,
  /\bgit\s+checkout\s+--\s/i,
  /\bdrop\s+(table|database|schema)\b/i,
  /\btruncate\s+table\b/i,
  /\bshutdown\b|\breboot\b|\bpoweroff\b/i,
  /:\(\)\s*\{\s*:\|:\s*&\s*\}\s*;/, // fork bomb
  /\bcurl\b.*\|\s*(sh|bash|powershell)/i, // pipe-to-shell
  /\bchmod\s+(-R\s+)?777\b/i,
  /\b(?:npm|pnpm|yarn)\s+publish\b/i,
  /\bvercel\s+(--prod|rm|remove)\b/i,
  /\b(Stop-Process|taskkill)\b.*\/f/i,
]

/**
 * @param {string} command
 * @param {boolean} allowUnsafe
 * @returns {Result} ok when the command may run
 */
export function checkCommand(command, allowUnsafe) {
  if (typeof command !== 'string' || !command.trim()) {
    return err('command must be a non-empty string')
  }
  if (allowUnsafe) return ok({ command })
  for (const pattern of DANGEROUS_COMMAND_PATTERNS) {
    if (pattern.test(command)) {
      return err(
        `Blocked dangerous command: "${command.slice(0, 160)}". ` +
          'Set AGENT_ALLOW_UNSAFE=1 (or pass --allow-unsafe) to authorize destructive operations explicitly.',
      )
    }
  }
  return ok({ command })
}
