import { spawn } from 'node:child_process'
import { err, ok } from '../../utils/result.js'
import { redact, truncate } from '../../utils/text.js'
import { checkCommand, resolveSafe } from '../safety.js'

/** @typedef {import('../../utils/types.js').Tool} Tool */
/** @typedef {import('../../utils/result.js').Result} Result */

/**
 * Run a shell command inside the workspace with:
 *  - a deny-list for destructive commands (unless allowUnsafe),
 *  - a hard timeout,
 *  - captured, size-capped stdout/stderr,
 *  - structured results the agent can feed back into self-correction.
 *
 * @param {string} command
 * @param {{ cwd: string, timeoutMs: number, allowUnsafe: boolean, env?: Record<string,string> }} opts
 * @returns {Promise<{ code: number|null, signal: string|null, stdout: string, stderr: string, timedOut: boolean }>}
 */
export function runShell(command, opts) {
  return new Promise((resolvePromise) => {
    const isWin = process.platform === 'win32'
    const child = spawn(command, {
      cwd: opts.cwd,
      shell: true,
      env: { ...process.env, ...(opts.env ?? {}), FORCE_COLOR: '0' },
      windowsHide: true,
    })
    let stdout = ''
    let stderr = ''
    let timedOut = false
    let settled = false
    const CAP = 100_000

    /**
     * Resolve exactly once — on timeout we must NOT wait for the child's
     * 'close', because on Windows the shell can exit while a grandchild keeps
     * the stdio pipes open for minutes.
     * @param {{ code: number|null, signal: string|null }} final
     */
    const settle = (final) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolvePromise({ ...final, stdout, stderr, timedOut })
    }

    /**
     * Kill the whole process tree. On Windows this MUST complete before we
     * fall back to child.kill(): killing cmd.exe first orphans the
     * grandchild, which then keeps the working directory locked forever.
     * @returns {Promise<void>}
     */
    const killTree = async () => {
      if (isWin && child.pid) {
        await new Promise((resolve) => {
          let done = false
          const finish = () => {
            if (done) return
            done = true
            resolve(undefined)
          }
          try {
            const killer = spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
              windowsHide: true,
              stdio: 'ignore',
            })
            killer.on('close', finish)
            killer.on('exit', finish)
            killer.on('error', finish)
          } catch {
            finish()
          }
          setTimeout(finish, 4000).unref?.()
        })
      }
      try {
        child.kill('SIGTERM')
      } catch {
        /* already gone */
      }
      const forceTimer = setTimeout(() => {
        try {
          child.kill('SIGKILL')
        } catch {
          /* ignore */
        }
      }, 2000)
      forceTimer.unref?.()
    }

    const timer = setTimeout(() => {
      timedOut = true
      // Reap the tree first so the caller's workspace is not left locked.
      killTree().finally(() => settle({ code: null, signal: 'SIGTERM' }))
    }, opts.timeoutMs)

    child.stdout?.on('data', (d) => {
      if (stdout.length < CAP) stdout += String(d)
    })
    child.stderr?.on('data', (d) => {
      if (stderr.length < CAP) stderr += String(d)
    })
    child.on('error', (e) => {
      stderr = `${stderr}${e.message}`
      settle({ code: null, signal: null })
    })
    child.on('close', (code, signal) => {
      settle({ code, signal: signal ?? null })
    })
  })
}

/**
 * run_command — execute a shell command in the workspace.
 * @type {Tool}
 */
export const runCommandTool = {
  name: 'run_command',
  description:
    'Run a shell command from the workspace root (builds, scripts, package managers, git …). Returns exit code, stdout and stderr. Fails with a structured error on non-zero exit or timeout. Destructive commands are blocked unless explicitly authorized.',
  inputSchema: {
    type: 'object',
    properties: {
      command: { type: 'string', description: 'Shell command to run, e.g. "npm test"' },
      timeoutMs: { type: 'integer', description: 'Optional timeout override (default from AGENT_COMMAND_TIMEOUT_MS)' },
    },
    required: ['command'],
  },
  dangerous: true,
  async execute(args, ctx) {
    const guard = checkCommand(String(args.command ?? ''), ctx.settings.agent.allowUnsafe)
    if (!guard.ok) return guard

    const cwdCheck = resolveSafe(ctx.workspaceRoot, args.cwd ?? '.')
    if (!cwdCheck.ok) return cwdCheck
    const cwd = /** @type {{abs: string}} */ (cwdCheck.data).abs

    const timeoutMs = Number(args.timeoutMs) || ctx.settings.agent.commandTimeoutMs
    ctx.logger.info('shell:start', { command: String(args.command).slice(0, 200), timeoutMs })

    const result = await runShell(String(args.command), {
      cwd,
      timeoutMs,
      allowUnsafe: ctx.settings.agent.allowUnsafe,
    })

    const combined = [result.stdout, result.stderr].filter(Boolean).join('\n').trim()
    const summary = redact(
      truncate(
        combined || `(no output) exit=${result.code}`,
        6000,
      ),
    )

    if (result.timedOut) {
      return err(`Command timed out after ${timeoutMs}ms: ${String(args.command).slice(0, 160)}`, {
        timedOut: true,
        code: result.code,
      }, summary)
    }
    if (result.code !== 0) {
      return err(
        `Command failed with exit code ${result.code}: ${String(args.command).slice(0, 160)}`,
        { code: result.code },
        summary,
      )
    }
    return ok(summary, { code: 0 })
  },
}
