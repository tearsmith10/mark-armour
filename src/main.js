#!/usr/bin/env node
/**
 * Self-coding agent — CLI entry point.
 *
 *   node src/main.js "add a --verbose flag to the export command"
 *   node src/main.js --dry-run "refactor the date helpers"
 *   node src/main.js --doctor            diagnose the environment
 *   node src/main.js --list-runs         show run history
 *   node src/main.js --undo latest       revert the last run's file changes
 *   node src/main.js --list-tools        show the tool registry
 *
 * Lifecycle: TASK → CONTEXT → PLAN → [APPROVE] → EXECUTE → VERIFY → FIX → REVIEW → REPORT
 * Every run writes an audit record to .agent/runs/<id>.json.
 */

import { parseArgs } from 'node:util'
import { resolve } from 'node:path'
import { realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createInterface } from 'node:readline/promises'
import { loadSettings } from './config/index.js'
import { Logger } from './logging/logger.js'
import { Agent } from './agent/Agent.js'
import { runDoctor, formatChecks } from './agent/doctor/index.js'
import { listRuns, undoRun } from './agent/undo/index.js'
import { createRegistry } from './tools/index.js'
import { createProvider, describeProvider } from './llm/provider.js'
import { listProviders } from './llm/models.js'

const USAGE = `
self-coding agent — autonomous task execution with verification

Usage:
  npm run agent -- "<task>" [options]    run a task end-to-end (from this repo)
  office-agent "<task>" [options]        same, after \`npm link\`
  office-agent --doctor                  check the environment and print fixes
  office-agent --list-runs               list recorded runs (newest first)
  office-agent --undo <id|latest>        revert a run's file changes
  office-agent --dry-run "<task>"        plan only, execute nothing
  office-agent --list-tools              show the tool registry
  office-agent --list-providers          show LLM provider options

Flags must come before the task; unknown dashed words inside the task text are
preserved, and wrapping quotes are stripped. Add \`--\` to force the rest literal.

Options:
  -n, --dry-run          stop after the PLAN stage (no writes, no commands)
  -i, --interactive      show the plan and ask before executing anything
  -w, --workspace <dir>  run against a different workspace root
      --provider <id>    ollama | openai | anthropic | mock   (env AGENT_LLM_PROVIDER)
      --model <name>     model override                         (env AGENT_LLM_MODEL)
      --max-steps <n>    execution action budget                (env AGENT_MAX_STEPS)
      --max-repairs <n>  self-correction attempts               (env AGENT_MAX_REPAIRS)
      --no-verify        skip the validation stage (not recommended)
      --allow-unsafe     permit destructive commands for this run
      --undo <id>        undo a run: "latest" or a run id/prefix from --list-runs
  -v, --verbose          debug logging on stderr
  -q, --quiet            warnings/errors only
  -j, --json             machine-readable output (run record / doctor / undo)
  -h, --help             this help

Exit codes: 0 = success  1 = failure  2 = usage error
`

/**
 * @typedef {Object} CliArgs
 * @property {string|null} task
 * @property {boolean} dryRun
 * @property {boolean} json
 * @property {boolean} listTools
 * @property {boolean} listProviders
 * @property {boolean} doctor
 * @property {boolean} listRuns
 * @property {string|null} undo
 * @property {boolean} interactive
 * @property {boolean} help
 * @property {boolean} allowUnsafe
 * @property {boolean} verify
 * @property {import('./config/index.js').SettingsOverrides} overrides
 * @property {number} code
 */

/** @param {number} code @returns {CliArgs} */
function emptyCli(code) {
  return {
    task: null, dryRun: false, json: false, listTools: false, listProviders: false,
    doctor: false, listRuns: false, undo: null, interactive: false, help: false,
    allowUnsafe: false, verify: true, overrides: {}, code,
  }
}

/** Options whose next token is a value (not a flag) — keep in sync with strictParse(). */
const VALUE_OPTIONS = new Set(['workspace', 'provider', 'model', 'max-steps', 'max-repairs', 'undo'])

/**
 * Strict parseArgs wrapper. The option spec stays inline here (contextually
 * typed by parseArgs) so `values` keeps precise types — do not annotate the
 * return type or it widens to `string | boolean`.
 * @param {string[]} args
 */
function strictParse(args) {
  return parseArgs({
    args,
    options: {
      'dry-run': { type: 'boolean', short: 'n', default: false },
      interactive: { type: 'boolean', short: 'i', default: false },
      workspace: { type: 'string', short: 'w' },
      provider: { type: 'string' },
      model: { type: 'string' },
      'max-steps': { type: 'string' },
      'max-repairs': { type: 'string' },
      'no-verify': { type: 'boolean', default: false },
      'allow-unsafe': { type: 'boolean', default: false },
      doctor: { type: 'boolean', default: false },
      'list-runs': { type: 'boolean', default: false },
      undo: { type: 'string' },
      verbose: { type: 'boolean', short: 'v', default: false },
      quiet: { type: 'boolean', short: 'q', default: false },
      json: { type: 'boolean', short: 'j', default: false },
      'list-tools': { type: 'boolean', default: false },
      'list-providers': { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
    allowPositionals: true,
    strict: true,
  })
}

/**
 * A task is free text and may legitimately contain tokens like `--version`.
 * When strict parsing rejects an unknown option, retry with everything from the
 * first task word onward treated as literal text (via a `--` terminator), so an
 * unquoted task survives cmd's quote-stripping instead of crashing the CLI.
 * @param {string[]} argv
 * @returns {string[]|null} rewritten argv, or null when there is no task to anchor on
 */
export function withTaskTerminator(argv) {
  if (argv.includes('--')) return null // already has a terminator
  let taskStart = -1
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]
    if (token.startsWith('-') && token !== '-') {
      const key = token.replace(/^-+/, '').split('=')[0]
      if (!token.includes('=') && VALUE_OPTIONS.has(key)) i++ // skip the option's value
      continue
    }
    taskStart = i
    break
  }
  if (taskStart < 0) return null // no task text anywhere in argv
  return [...argv.slice(0, taskStart), '--', ...argv.slice(taskStart)]
}

/**
 * @param {string[]} argv
 * @returns {CliArgs}
 */
export function parseCli(argv) {
  /** @type {{ ok: true, parsed: ReturnType<typeof strictParse> } | { ok: false, error: Error }} */
  let attempt
  try {
    attempt = { ok: true, parsed: strictParse(argv) }
  } catch (e) {
    attempt = { ok: false, error: e instanceof Error ? e : new Error(String(e)) }
    const rewritten = withTaskTerminator(argv)
    if (rewritten) {
      try {
        attempt = { ok: true, parsed: strictParse(rewritten) }
      } catch {
        /* keep the original error — it points at a real usage mistake */
      }
    }
  }
  if (!attempt.ok) {
    process.stderr.write(`${attempt.error.message}\n${USAGE}`)
    return emptyCli(2)
  }

  const { values, positionals } = attempt.parsed
  /** @type {import('./config/index.js').SettingsOverrides} */
  const overrides = {}
  if (values.workspace) overrides.workspaceRoot = values.workspace
  if (values.verbose) overrides.logLevel = 'debug'
  else if (values.quiet) overrides.logLevel = 'warn'

  /** @type {any} */
  const llm = {}
  if (values.provider) llm.provider = values.provider
  if (values.model) llm.model = values.model
  if (Object.keys(llm).length) overrides.llm = llm

  /** @type {any} */
  const agent = {}
  if (values['max-steps']) agent.maxSteps = Number(values['max-steps'])
  if (values['max-repairs']) agent.maxRepairs = Number(values['max-repairs'])
  if (values['no-verify']) agent.verifyEnabled = false
  if (values['allow-unsafe']) agent.allowUnsafe = true
  if (Object.keys(agent).length) overrides.agent = agent

  return {
    task: joinTask(positionals),
    dryRun: values['dry-run'] ?? false,
    json: values.json ?? false,
    listTools: values['list-tools'] ?? false,
    listProviders: values['list-providers'] ?? false,
    doctor: values.doctor ?? false,
    listRuns: values['list-runs'] ?? false,
    undo: values.undo ?? null,
    interactive: values.interactive ?? false,
    help: values.help ?? false,
    allowUnsafe: values['allow-unsafe'] ?? false,
    verify: !(values['no-verify'] ?? false),
    overrides,
    code: 0,
  }
}

/**
 * Join positionals into the free-text task, dropping a wrapping quote pair
 * (shells/cmd sometimes pass `"…"` through literally).
 * @param {string[]} positionals
 * @returns {string|null}
 */
export function joinTask(positionals) {
  const joined = positionals.join(' ').trim()
  if (joined.length >= 2) {
    const first = joined[0]
    const last = joined[joined.length - 1]
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return joined.slice(1, -1).trim() || null
    }
  }
  return joined || null
}

/**
 * Interactive plan approval: print the plan, ask, return the decision.
 * Anything other than y/yes is treated as "do not execute" (safe default).
 * Prompt goes to stderr so `--json` stdout stays machine-readable.
 * @param {import('./utils/types.js').Plan} plan
 * @returns {Promise<boolean>}
 */
async function confirmPlan(plan) {
  const out = process.stderr
  out.write(`\nPlan (${plan.origin} model, ${plan.steps.length} steps)\n`)
  out.write(`  strategy: ${plan.strategy}\n`)
  plan.steps.forEach((step, i) => {
    out.write(`  ${String(i + 1).padStart(2)}. [${step.tool ?? '—'}] ${step.goal}\n`)
  })

  const rl = createInterface({ input: process.stdin, output: process.stderr })
  try {
    return await new Promise((resolve) => {
      let done = false
      const finish = (/** @type {boolean} */ value) => {
        if (done) return
        done = true
        resolve(value)
      }
      // stdin closed / EOF (CI, /dev/null) → do not execute.
      rl.once('close', () => finish(false))
      rl.question('\nExecute this plan? [y/N] ')
        .then((answer) => finish(/^(y|yes)$/i.test(answer.trim())))
        .catch(() => finish(false))
    })
  } finally {
    rl.close()
  }
}

/**
 * @param {import('./agent/undo/index.js').RunSummary[]} runs
 * @returns {string}
 */
function formatRuns(runs) {
  if (!runs.length) return 'No runs recorded yet (.agent/runs is empty).'
  const lines = runs.map((r) => {
    const when = r.startedAt.replace('T', ' ').slice(0, 19)
    const id = r.kind === 'undo' ? `${r.id} (undo)` : r.id
    const task = r.task.length > 58 ? `${r.task.slice(0, 55)}…` : r.task
    return `${when}  ${r.status.padEnd(8)} ${id}  ${task}  [${r.actions} actions]`
  })
  return ['started             status   id                                            task', ...lines].join('\n')
}

async function main() {
  const cli = parseCli(process.argv.slice(2))

  if (cli.help) {
    process.stdout.write(USAGE)
    return 0
  }

  /** @type {import('./config/index.js').Settings} */
  let settings
  try {
    settings = loadSettings({ overrides: cli.overrides })
  } catch (e) {
    process.stderr.write(`Configuration error: ${e instanceof Error ? e.message : e}\n`)
    return 2
  }

  const logger = new Logger({ level: settings.logLevel, file: settings.logFile })

  if (cli.listProviders) {
    for (const p of listProviders()) {
      process.stdout.write(`${p.id.padEnd(10)} ${p.label}  [${p.docs}]\n`)
    }
    return 0
  }

  if (cli.listTools) {
    const registry = createRegistry({ workspaceRoot: settings.workspaceRoot, logger, settings })
    for (const t of registry.list()) {
      process.stdout.write(
        `${t.dangerous ? '⚠ ' : '  '}${t.name.padEnd(14)} ${t.description.split('\n')[0]}\n`,
      )
    }
    return 0
  }

  if (cli.doctor) {
    const result = await runDoctor({ settings, logger })
    if (cli.json) {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
    } else {
      process.stdout.write(`Agent doctor — ${settings.workspaceRoot}\n\n`)
      process.stdout.write(`${formatChecks(result.checks)}\n\n`)
      const fails = result.checks.filter((c) => c.status === 'fail').length
      const warns = result.checks.filter((c) => c.status === 'warn').length
      process.stdout.write(
        result.ok
          ? `Ready to run${warns ? ` (${warns} warning(s))` : ''} — try: node src/main.js --dry-run "your task"\n`
          : `Not ready: ${fails} blocking issue(s) — apply the fixes above.\n`,
      )
    }
    return result.ok ? 0 : 1
  }

  if (cli.listRuns) {
    const runs = await listRuns(settings.workspaceRoot)
    if (cli.json) {
      process.stdout.write(`${JSON.stringify(runs, null, 2)}\n`)
    } else {
      process.stdout.write(`${formatRuns(runs)}\n`)
    }
    return 0
  }

  if (cli.undo) {
    const result = await undoRun({
      workspaceRoot: settings.workspaceRoot,
      runId: cli.undo,
      logger,
    })
    if (cli.json) {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
    } else if (!result.ok) {
      process.stderr.write(`Undo failed: ${result.error}\n`)
      const details = /** @type {any} */ (result.data) ?? {}
      for (const s of details.skipped ?? []) {
        process.stderr.write(`  skipped  ${s.path} — ${s.reason}\n`)
      }
    } else {
      const data = /** @type {any} */ (result.data)
      process.stdout.write(`${data.message}\n`)
      for (const p of data.restored ?? []) process.stdout.write(`  restored ${p}\n`)
      for (const p of data.removed ?? []) process.stdout.write(`  deleted  ${p}\n`)
      for (const s of data.skipped ?? []) process.stdout.write(`  skipped  ${s.path} — ${s.reason}\n`)
      if (data.auditFile) process.stderr.write(`undo record: ${data.auditFile}\n`)
    }
    return result.ok ? 0 : 1
  }

  if (!cli.task) {
    process.stderr.write(`Missing task.\n${USAGE}`)
    return 2
  }

  // Fail fast (with a clear message) when the configured provider cannot even
  // be constructed — mock/ollama construct lazily, so only key-less cloud
  // providers land here.
  try {
    createProvider(settings.llm)
  } catch (e) {
    process.stderr.write(`LLM provider error: ${e instanceof Error ? e.message : e}\n`)
    return 2
  }

  process.stderr.write(`provider : ${describeProvider(settings.llm)}\n`)
  process.stderr.write(`workspace: ${settings.workspaceRoot}\n`)
  process.stderr.write(`task     : ${cli.task}\n`)
  if (cli.dryRun) process.stderr.write(`mode     : dry-run (plan only)\n`)
  if (cli.interactive && !cli.dryRun) process.stderr.write(`mode     : interactive (approval required)\n`)
  process.stderr.write('\n')

  const agent = new Agent({ settings, logger })
  const { record, report, runFile, rejected } = await agent.run({
    task: cli.task,
    dryRun: cli.dryRun,
    allowUnsafe: cli.allowUnsafe,
    ...(cli.interactive && !cli.dryRun ? { confirmPlan: confirmPlan } : {}),
  })

  if (rejected) {
    process.stderr.write('Plan rejected — nothing was executed.\n\n')
  }

  if (cli.json) {
    process.stdout.write(`${JSON.stringify(record, null, 2)}\n`)
  } else {
    process.stdout.write(`${report}\n`)
    if (runFile) process.stderr.write(`\nrun record: ${runFile}\n`)
    if (record.status === 'success' || record.status === 'dry-run') {
      const changed = record.review?.changed ?? []
      if (changed.length) {
        process.stderr.write(`\nTip: undo these changes with: node src/main.js --undo ${record.id}\n`)
      }
    }
  }

  return record.status === 'success' || record.status === 'dry-run' ? 0 : 1
}

/**
 * Run the CLI only when this file is the process entry point — tests import
 * `parseCli` without triggering a full run. Compared by realpath because npm
 * shims (npm link) invoke the file through a junction/symlink path.
 */
const invokedDirectly = (() => {
  const entry = process.argv[1]
  if (!entry) return false
  try {
    return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(resolve(entry))
  } catch {
    return false
  }
})()

if (invokedDirectly) {
  main().then(
    (code) => {
      process.exitCode = code
    },
    (e) => {
      process.stderr.write(`Fatal: ${e instanceof Error ? (e.stack ?? e.message) : e}\n`)
      process.exitCode = 1
    },
  )
}
