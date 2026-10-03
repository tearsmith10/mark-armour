import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile, mkdir, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Agent } from '../src/agent/Agent.js'
import { executePlan } from '../src/agent/executor/index.js'
import { buildPromptMessages } from '../src/agent/prompts.js'
import { runValidation, verifyAndRepair } from '../src/agent/verifier/index.js'
import { Memory } from '../src/agent/memory/index.js'
import { loadSettings } from '../src/config/index.js'
import { Logger } from '../src/logging/logger.js'
import { mockAdapter } from '../src/llm/adapters/mock.js'
import { ok, err } from '../src/utils/result.js'

process.env.AGENT_LOG_FILE = 'none'
process.env.AGENT_LOG_LEVEL = 'silent'

const silentLogger = () => new Logger({ level: 'silent', sink: () => {} })

/**
 * Temp workspace with a controllable validation script.
 * @param {{ testBody?: string }} [opts]
 */
async function makeProject(opts = {}) {
  const root = await mkdtemp(join(tmpdir(), 'agent-proj-'))
  await mkdir(join(root, 'src'), { recursive: true })
  await writeFile(
    join(root, 'package.json'),
    JSON.stringify({ name: 'fixture', version: '1.0.0', scripts: { test: 'node test.js' } }, null, 2),
  )
  await writeFile(join(root, 'test.js'), opts.testBody ?? 'console.log("ok")\n')
  await writeFile(join(root, 'src', 'index.js'), 'export const x = 1\n')
  return root
}

/**
 * @param {string} root
 * @param {import('../src/config/index.js').SettingsOverrides} [extra]
 */
function settingsFor(root, extra = {}) {
  return loadSettings({
    cwd: root,
    overrides: { workspaceRoot: root, llm: { provider: 'mock' }, ...extra },
  })
}

test('executor runs planned tool steps then asks the model for the rest', async (t) => {
  const root = await makeProject()
  t.after(() => rm(root, { recursive: true, force: true }))
  const settings = settingsFor(root)
  const memory = new Memory({ task: 'inspect', workspaceRoot: root })
  /** @type {string[]} */
  const executed = []
  /** @param {string} name @param {any} a */
  const runTool = async (name, a) => {
    executed.push(name)
    return ok(`ran ${name}`)
  }

  const result = await executePlan({
    task: 'inspect the project',
    context: '(ctx)',
    plan: {
      strategy: 's',
      origin: 'llm',
      steps: [
        { goal: 'list', tool: 'list_files', args: { path: '.' } },
        { goal: 'think', tool: null },
        { goal: 'validate', tool: 'run_tests', args: {} },
      ],
    },
    llm: mockAdapter(),
    tools: [],
    runTool,
    memory,
    settings,
    logger: silentLogger(),
  })

  assert.deepEqual(executed, ['list_files', 'run_tests'])
  assert.equal(result.done, true, 'mock executor should report done')
  assert.equal(result.actions, 2) // 2 planned tool steps; the "done" reply costs no action
  assert.equal(memory.record.actions.filter((a) => a.tool).length, 2)
})

test('executor stops when the model repeats the same call instead of burning the budget', async (t) => {
  const root = await makeProject()
  t.after(() => rm(root, { recursive: true, force: true }))
  const settings = settingsFor(root, { agent: { maxSteps: 20 } })
  const memory = new Memory({ task: 'create hello', workspaceRoot: root })

  // A small local model that never says "done" and keeps re-issuing one write.
  const sameDecision = JSON.stringify({
    reasoning: 'write the file',
    tool: 'write_file',
    args: { path: 'hello.txt', content: 'hi' },
  })
  const llm = mockAdapter({ script: Array(10).fill(sameDecision) })
  /** @type {string[]} */
  const executed = []
  /** @param {string} name @param {any} a */
  const runTool = async (name, a) => {
    executed.push(name)
    return ok(`ran ${name}`)
  }

  const result = await executePlan({
    task: 'create hello.txt',
    context: '(ctx)',
    plan: { strategy: 's', origin: 'llm', steps: [] },
    llm,
    tools: [],
    runTool,
    memory,
    settings,
    logger: silentLogger(),
  })

  assert.equal(result.done, false, 'a looping model never counts as finished')
  assert.equal(executed.length, 3, 'three identical calls are tolerated; the fourth is refused')
  assert.equal(result.actions, 3, 'the refused decision costs no action')
  assert.ok(result.actions < 20, 'loop detection must stop it well before the budget')

  const errors = memory.record.errors.join(' | ')
  assert.match(errors, /Loop detected/)
  assert.match(errors, /write_file/)
  assert.match(errors, /already complete/, 'the hint should point at the likely reality')
})

test('different consecutive calls never trip the loop guard', async (t) => {
  const root = await makeProject()
  t.after(() => rm(root, { recursive: true, force: true }))
  const settings = settingsFor(root, { agent: { maxSteps: 12 } })
  const memory = new Memory({ task: 'read around', workspaceRoot: root })

  // Alternating but distinct calls (legitimate exploration) → only budget applies.
  const script = Array.from({ length: 16 }, (_, i) =>
    JSON.stringify({ reasoning: 'look', tool: 'read_file', args: { path: i % 2 ? 'a.txt' : 'b.txt' } }),
  )
  const llm = mockAdapter({ script })
  const runTool = async () => ok('ran')

  const result = await executePlan({
    task: 'explore',
    context: '(ctx)',
    plan: { strategy: 's', origin: 'llm', steps: [] },
    llm,
    tools: [],
    runTool,
    memory,
    settings,
    logger: silentLogger(),
  })

  assert.equal(result.actions, 12, 'runs until the action budget, not the loop guard')
  assert.ok(!memory.record.errors.some((e) => /Loop detected/.test(e)))
})

test('executor prompt forbids repeating a completed tool call', () => {
  const messages = buildPromptMessages({ stage: 'EXECUTOR', task: 't', context: 'c', tools: [] })
  const text = messages.map((m) => m.content).join('\n')
  assert.match(text, /NEVER repeat a tool call/)
  assert.match(text, /"done": true/)
})

test('executor stops at the action budget instead of looping forever', async (t) => {
  const root = await makeProject()
  t.after(() => rm(root, { recursive: true, force: true }))
  const settings = settingsFor(root, { agent: { maxSteps: 4, maxActionsPerStep: 2, maxRepairs: 1 } })
  const memory = new Memory({ task: 'loop', workspaceRoot: root })

  // A model that always asks for one more tool call — with *distinct* args so
  // the budget (not the loop guard) is what stops it.
  let n = 0
  const greedy = /** @type {any} */ ({
    id: 'greedy',
    model: 'x',
    complete: async () => JSON.stringify({ tool: 'list_files', args: { path: '.', attempt: n++ } }),
  })

  const result = await executePlan({
    task: 'never ends',
    context: '(ctx)',
    plan: { strategy: 's', origin: 'llm', steps: [] },
    llm: greedy,
    tools: [],
    runTool: async () => ok('fine'),
    memory,
    settings,
    logger: silentLogger(),
  })

  assert.equal(result.actions, 4)
  assert.equal(result.done, false)
  assert.ok(memory.record.errors.some((e) => /Action budget exhausted/.test(e)))
})

test('executor surfaces tool failures to the model as structured notes', async (t) => {
  const root = await makeProject()
  t.after(() => rm(root, { recursive: true, force: true }))
  const settings = settingsFor(root)
  const memory = new Memory({ task: 'x', workspaceRoot: root })

  /** @type {string[]} */
  const prompts = []
  const scripted = /** @type {any} */ ({
    id: 'scripted',
    model: 'x',
    /** @param {{ role: string, content: string }[]} messages */
    complete: async (messages) => {
      prompts.push(messages[messages.length - 1].content)
      return prompts.length === 1
        ? JSON.stringify({ tool: 'run_tests', args: {} })
        : JSON.stringify({ done: true, summary: 'recovered' })
    },
  })

  const result = await executePlan({
    task: 'handle failure',
    context: '(ctx)',
    plan: { strategy: 's', origin: 'llm', steps: [] },
    llm: scripted,
    tools: [],
    runTool: async () => err('npm ERR! missing script', { code: 1 }, 'stack trace…'),
    memory,
    settings,
    logger: silentLogger(),
  })

  assert.equal(result.done, true)
  assert.match(prompts[1], /OPEN FAILURES/)
  assert.match(prompts[1], /npm ERR! missing script/)
  assert.equal(memory.record.errors.length, 1)
})

test('validation detects the project test script and reports failures', async (t) => {
  const passing = await makeProject({ testBody: 'console.log("all good")\n' })
  const failing = await makeProject({ testBody: 'console.error("boom"); process.exit(1)\n' })
  t.after(() =>
    Promise.all([
      rm(passing, { recursive: true, force: true }),
      rm(failing, { recursive: true, force: true }),
    ]),
  )

  const okRun = await runValidation({ settings: settingsFor(passing), logger: silentLogger() })
  assert.equal(okRun.passed, true)
  assert.equal(okRun.commands[0].command, 'npm run test')
  assert.equal(okRun.commands[0].code, 0)

  const badRun = await runValidation({ settings: settingsFor(failing), logger: silentLogger() })
  assert.equal(badRun.passed, false)
  assert.match(badRun.commands[0].output, /boom/)
})

test('verifyAndRepair fixes a failing validation within the repair budget', async (t) => {
  const root = await makeProject({ testBody: 'console.error("missing marker"); process.exit(1)\n' })
  t.after(() => rm(root, { recursive: true, force: true }))

  const settings = settingsFor(root)
  const memory = new Memory({ task: 'make tests pass', workspaceRoot: root })
  const failing = await runValidation({ settings, logger: silentLogger() })
  assert.equal(failing.passed, false)

  // Scripted "model": first fix the test, then declare done.
  const fixer = /** @type {any} */ ({
    id: 'fixer',
    model: 'x',
    complete: async () =>
      JSON.stringify({
        tool: 'write_file',
        args: { path: 'test.js', content: 'console.log("fixed")\n' },
      }),
  })

  const final = await verifyAndRepair({
    task: 'make tests pass',
    context: '(ctx)',
    llm: fixer,
    tools: [],
    runTool: async (name, args) => {
      if (name !== 'write_file') return err(`unexpected tool ${name}`)
      await writeFile(join(root, String(args.path)), String(args.content))
      return ok('written')
    },
    memory,
    settings,
    logger: silentLogger(),
    verification: failing,
  })

  assert.equal(final.passed, true, 'repair loop must reach a green state')
  assert.match(await readFile(join(root, 'test.js'), 'utf8'), /fixed/)
  assert.ok(memory.record.actions.some((a) => String(a.action).startsWith('repair:attempt')))
})

test('verifyAndRepair gives up after maxRepairs instead of looping forever', async (t) => {
  const root = await makeProject({ testBody: 'process.exit(1)\n' })
  t.after(() => rm(root, { recursive: true, force: true }))

  const settings = settingsFor(root, { agent: { maxRepairs: 2, maxActionsPerStep: 3, maxSteps: 10 } })
  const memory = new Memory({ task: 'hopeless', workspaceRoot: root })
  const failing = await runValidation({ settings, logger: silentLogger() })

  const stubborn = /** @type {any} */ ({
    id: 'stubborn',
    model: 'x',
    complete: async () => JSON.stringify({ tool: 'list_files', args: { path: '.' } }),
  })

  const final = await verifyAndRepair({
    task: 'hopeless',
    context: '(ctx)',
    llm: stubborn,
    tools: [],
    runTool: async () => ok('nothing useful'),
    memory,
    settings,
    logger: silentLogger(),
    verification: failing,
  })

  assert.equal(final.passed, false)
  const attempts = memory.record.actions.filter((a) => String(a.action).startsWith('repair:attempt'))
  assert.equal(attempts.length, 2, 'exactly maxRepairs attempts')
  assert.ok(memory.record.errors.some((e) => /still failing after 2/.test(e)))
})

test('verifyAndRepair stops immediately when the LLM is unreachable', async (t) => {
  const root = await makeProject({ testBody: 'process.exit(1)\n' })
  t.after(() => rm(root, { recursive: true, force: true }))
  const settings = settingsFor(root)
  const memory = new Memory({ task: 'offline', workspaceRoot: root })
  const failing = await runValidation({ settings, logger: silentLogger() })

  const offline = /** @type {any} */ ({
    id: 'offline',
    model: 'x',
    complete: async () => {
      throw new Error('ECONNREFUSED')
    },
  })

  const final = await verifyAndRepair({
    task: 'offline',
    context: '(ctx)',
    llm: offline,
    tools: [],
    runTool: async () => ok(null),
    memory,
    settings,
    logger: silentLogger(),
    verification: failing,
  })
  assert.equal(final.passed, false)
  assert.ok(memory.record.errors.some((e) => /LLM unavailable/.test(e)))
})

test('full lifecycle: TASK → CONTEXT → PLAN → EXECUTE → VERIFY → REPORT', async (t) => {
  const root = await makeProject()
  t.after(() => rm(root, { recursive: true, force: true }))
  const settings = settingsFor(root)
  const agent = new Agent({ settings, logger: silentLogger() })

  const { record, report, runFile } = await agent.run({
    task: 'inspect the fixture project and make sure its tests pass',
  })

  assert.equal(record.status, 'success')
  assert.equal(record.plan?.origin, 'llm')
  assert.ok(record.context && record.context.length > 50, 'context must be captured')
  assert.equal(record.verification?.passed, true)
  assert.equal(record.actions.length > 0, true)
  assert.equal(record.errors.length, 0)
  assert.ok(runFile, 'an audit record must be written')
  assert.match(report, /Agent report/)
  assert.match(report, /Validation/)
  assert.equal(
    record.verification?.commands[0]?.command,
    'npm run test',
    'validation must run the detected project script',
  )

  // The audit record is readable JSON with the documented lifecycle fields.
  const saved = JSON.parse(await readFile(String(runFile), 'utf8'))
  for (const field of ['id', 'task', 'status', 'startedAt', 'finishedAt', 'plan', 'actions', 'verification']) {
    assert.ok(field in saved, `record must contain ${field}`)
  }
  assert.equal(saved.status, 'success')
})

test('dry-run stops after the plan and touches nothing', async (t) => {
  const root = await makeProject()
  t.after(() => rm(root, { recursive: true, force: true }))
  const settings = settingsFor(root)
  const agent = new Agent({ settings, logger: silentLogger() })

  const { record, report } = await agent.run({ task: 'write a file', dryRun: true })

  assert.equal(record.status, 'dry-run')
  assert.equal(record.actions.length, 0)
  assert.ok(record.plan)
  assert.match(report, /dry-run/i)
})

test('a fatal error still produces a report and an audit record', async (t) => {
  const root = await makeProject()
  t.after(() => rm(root, { recursive: true, force: true }))
  const settings = settingsFor(root)
  const agent = new Agent({ settings, logger: silentLogger() })
  // Force a genuine failure inside run(): every tool call rejects, which must
  // surface as a recorded error rather than an unhandled crash.
  agent.registry.execute = async () => {
    throw new Error('simulated crash')
  }

  const { record, report, runFile } = await agent.run({ task: 'crash me' })
  assert.equal(record.status, 'failed')
  assert.ok(report.includes('failed'), 'the report must state the failure')
  assert.ok(record.errors.some((e) => /simulated crash/.test(e)), 'the cause must be recorded')
  assert.ok(runFile, 'an audit record must always be written')
  const saved = JSON.parse(await readFile(String(runFile), 'utf8'))
  assert.equal(saved.id, record.id)
  assert.equal(saved.status, 'failed')
  assert.ok('finishedAt' in saved, 'the record must be closed out')
})

test('interactive approval: rejecting the plan executes nothing', async (t) => {
  const root = await makeProject()
  t.after(() => rm(root, { recursive: true, force: true }))
  const settings = settingsFor(root)
  const agent = new Agent({ settings, logger: silentLogger() })

  /** @type {any[]} */
  const seen = []
  const { record, report, runFile, rejected } = await agent.run({
    task: 'write a file',
    confirmPlan: async (plan) => {
      seen.push(plan)
      return false
    },
  })

  assert.equal(rejected, true)
  assert.equal(record.status, 'dry-run', 'a rejected plan must not be reported as executed')
  assert.equal(record.actions.length, 0, 'no tool may run after a rejection')
  assert.equal(seen.length, 1, 'the plan must be offered exactly once')
  assert.ok(seen[0].steps.length > 0)
  assert.match(String(record.summary), /rejected/)
  assert.match(report, /nothing was executed/i)
  assert.ok(runFile, 'a rejected run is still recorded')
})

test('interactive approval: approving the plan runs the full lifecycle', async (t) => {
  const root = await makeProject()
  t.after(() => rm(root, { recursive: true, force: true }))
  const settings = settingsFor(root)
  const agent = new Agent({ settings, logger: silentLogger() })

  let approvals = 0
  const { record, rejected } = await agent.run({
    task: 'inspect the fixture project',
    confirmPlan: async () => {
      approvals++
      return true
    },
  })

  assert.equal(approvals, 1)
  assert.equal(rejected, undefined)
  assert.equal(record.status, 'success')
  assert.ok(record.actions.length > 0, 'approved plans must execute')
  assert.equal(record.verification?.passed, true)
})

test('no confirmPlan means non-interactive runs proceed without prompting', async (t) => {
  const root = await makeProject()
  t.after(() => rm(root, { recursive: true, force: true }))
  const settings = settingsFor(root)
  const agent = new Agent({ settings, logger: silentLogger() })

  const { record, rejected } = await agent.run({ task: 'inspect the fixture project' })
  assert.equal(rejected, undefined)
  assert.equal(record.status, 'success')
})
