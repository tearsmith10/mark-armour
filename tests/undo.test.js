import { test } from 'node:test'
import assert from 'node:assert/strict'
import { access, mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { executePlan } from '../src/agent/executor/index.js'
import { Memory } from '../src/agent/memory/index.js'
import { loadRun, listRuns, undoRun } from '../src/agent/undo/index.js'
import { loadSettings } from '../src/config/index.js'
import { Logger } from '../src/logging/logger.js'

process.env.AGENT_LOG_FILE = 'none'

const logger = new Logger({ level: 'silent', sink: () => {} })

/** Temp workspace with a validation script. */
async function makeWorkspace() {
  const root = await mkdtemp(join(tmpdir(), 'agent-undo-'))
  await mkdir(join(root, 'src'), { recursive: true })
  await writeFile(
    join(root, 'package.json'),
    JSON.stringify({ name: 'fixture', version: '1.0.0', scripts: { test: 'node t.js' } }, null, 2),
  )
  await writeFile(join(root, 't.js'), 'console.log("ok")\n')
  await writeFile(join(root, 'config.txt'), 'original\n')
  return root
}

/**
 * Run a scripted execution that mutates files, and persist the run record.
 * @param {string} root
 * @param {any[]} steps
 */
async function runAndSave(root, steps) {
  const settings = loadSettings({
    cwd: root,
    overrides: { workspaceRoot: root, llm: { provider: 'mock' } },
  })
  const memory = new Memory({ task: 'mutate files', workspaceRoot: root })

  /** @type {any[]} */
  const replies = [{ done: true, summary: 'done' }]
  const scripted = /** @type {any} */ ({
    id: 'scripted',
    model: 'x',
    complete: async () => JSON.stringify(replies.shift() ?? { done: true }),
  })

  await executePlan({
    task: 'mutate files',
    context: '(ctx)',
    plan: { strategy: 's', origin: 'llm', steps },
    llm: scripted,
    tools: [],
    runTool: (/** @type {string} */ name, /** @type {any} */ args) => registryRun(root, name, args),
    memory,
    settings,
    logger,
  })
  const file = await memory.save()
  return { memory, file }
}

/** Minimal tool dispatcher that mirrors the real registry for file mutations.
 * @param {string} root
 * @param {string} name
 * @param {any} args
 * @returns {Promise<import('../src/utils/result.js').Result>}
 */
async function registryRun(root, name, args) {
  const { writeFileTool } = await import('../src/tools/filesystem/write_file.js')
  const { editFileTool } = await import('../src/tools/filesystem/edit_file.js')
  const { ok } = await import('../src/utils/result.js')
  const ctx = { workspaceRoot: root, logger, settings: /** @type {any} */ ({}) }
  const tool = name === 'write_file' ? writeFileTool : name === 'edit_file' ? editFileTool : null
  if (!tool) return ok(`no-op ${name}`)
  return tool.execute(args, ctx)
}

test('undo restores overwritten files, deletes created ones', async (t) => {
  const root = await makeWorkspace()
  t.after(() => rm(root, { recursive: true, force: true }))

  const { memory } = await runAndSave(root, [
    { goal: 'overwrite config', tool: 'write_file', args: { path: 'config.txt', content: 'version 2\n' } },
    { goal: 'create a file', tool: 'write_file', args: { path: 'src/new.js', content: 'export const x = 1\n' } },
    { goal: 'edit it', tool: 'edit_file', args: { path: 'config.txt', oldText: 'version 2', newText: 'version 3' } },
  ])

  assert.equal(await readFile(join(root, 'config.txt'), 'utf8'), 'version 3\n')
  await access(join(root, 'src', 'new.js'))

  const result = await undoRun({ workspaceRoot: root, runId: 'latest', logger })
  assert.equal(result.ok, true, String(result.error))
  const data = /** @type {any} */ (result.data)

  assert.equal(await readFile(join(root, 'config.txt'), 'utf8'), 'original\n', 'pre-run content restored')
  await assert.rejects(() => access(join(root, 'src', 'new.js')), 'created file removed')
  // Two mutations hit config.txt (write, then edit) — both are replayed.
  assert.deepEqual([...data.restored].sort(), ['config.txt', 'config.txt'])
  assert.deepEqual(data.removed.sort(), ['src/new.js'])
  assert.equal(data.skipped.length, 0)
  assert.ok(data.auditFile, 'undo must write its own audit record')

  // The original run id still resolves as "latest" (undo records are excluded).
  const latest = await loadRun(root, 'latest')
  assert.equal(latest.ok, true)
  assert.equal(/** @type {any} */ (latest.data).record.id, memory.record.id)

  const runs = await listRuns(root)
  assert.ok(runs.some((r) => r.kind === 'undo'), 'undo record shows up in history')
  assert.ok(runs.some((r) => r.id === memory.record.id))

  // Audit record content.
  const audit = JSON.parse(await readFile(String(data.auditFile), 'utf8'))
  assert.equal(audit.kind, 'undo')
  assert.equal(audit.undo.run, memory.record.id)
})

test('undo replays multiple edits to the same file in reverse order', async (t) => {
  const root = await makeWorkspace()
  t.after(() => rm(root, { recursive: true, force: true }))

  await runAndSave(root, [
    { goal: 'a', tool: 'write_file', args: { path: 'config.txt', content: 'step 1\n' } },
    { goal: 'b', tool: 'write_file', args: { path: 'config.txt', content: 'step 2\n' } },
    { goal: 'c', tool: 'write_file', args: { path: 'config.txt', content: 'step 3\n' } },
  ])
  assert.equal(await readFile(join(root, 'config.txt'), 'utf8'), 'step 3\n')

  const result = await undoRun({ workspaceRoot: root, runId: 'latest', logger })
  assert.equal(result.ok, true, String(result.error))
  assert.equal(await readFile(join(root, 'config.txt'), 'utf8'), 'original\n')
})

test('undo refuses runs with no reversible file changes', async (t) => {
  const root = await makeWorkspace()
  t.after(() => rm(root, { recursive: true, force: true }))

  const memory = new Memory({ task: 'read only', workspaceRoot: root })
  memory.recordAction({ action: 'read_file', tool: 'read_file', ok: true, ts: Date.now() })
  await memory.save()

  const result = await undoRun({ workspaceRoot: root, runId: 'latest', logger })
  assert.equal(result.ok, false)
  assert.match(String(result.error), /no reversible file changes/)
})

test('undo reports unknown run ids clearly', async (t) => {
  const root = await makeWorkspace()
  t.after(() => rm(root, { recursive: true, force: true }))

  // A workspace where the agent has never run: honest "nothing here" message.
  const empty = await undoRun({ workspaceRoot: join(root, 'nowhere'), runId: 'latest', logger })
  assert.equal(empty.ok, false)
  assert.match(String(empty.error), /has not run here/)

  // A workspace with runs, but an id nobody recorded.
  await runAndSave(root, [
    { goal: 'write', tool: 'write_file', args: { path: 'config.txt', content: 'changed' } },
  ])
  const missing = await undoRun({ workspaceRoot: root, runId: 'does-not-exist', logger })
  assert.equal(missing.ok, false)
  assert.match(String(missing.error), /not found/)
  assert.match(String(missing.error), /--list-runs/)

  // Id prefix matching must be unambiguous-safe: partial ids resolve.
  const prefix = await undoRun({ workspaceRoot: root, runId: memoryId(await listRuns(root)), logger })
  assert.equal(prefix.ok, true, String(prefix.error))
})

/**
 * First 10 chars of the newest real run id (prefix matching).
 * @param {import('../src/agent/undo/index.js').RunSummary[]} runs
 * @returns {string}
 */
function memoryId(runs) {
  const id = runs.find((r) => r.kind === 'run')?.id ?? ''
  return id.slice(0, 10)
}

test('undo refuses to undo an undo record', async (t) => {
  const root = await makeWorkspace()
  t.after(() => rm(root, { recursive: true, force: true }))

  await runAndSave(root, [
    { goal: 'write', tool: 'write_file', args: { path: 'config.txt', content: 'changed\n' } },
  ])
  const first = await undoRun({ workspaceRoot: root, runId: 'latest', logger })
  assert.equal(first.ok, true, String(first.error))
  const auditFile = String(/** @type {any} */ (first.data).auditFile)
  const auditId = (auditFile.split(/[\\/]/).pop() ?? '').replace(/\.json$/, '')

  const second = await undoRun({ workspaceRoot: root, runId: auditId, logger })
  assert.equal(second.ok, false)
  assert.match(String(second.error), /undo record/)
})

test('undo refuses to touch files that changed after the run', async (t) => {
  const root = await makeWorkspace()
  t.after(() => rm(root, { recursive: true, force: true }))

  await runAndSave(root, [
    { goal: 'patch config', tool: 'write_file', args: { path: 'config.txt', content: 'agent version' } },
  ])

  // The user (or a later run) keeps working on the same file.
  await writeFile(join(root, 'config.txt'), 'user work that must survive')

  const result = await undoRun({ workspaceRoot: root, runId: 'latest', logger })
  assert.equal(result.ok, false, 'a conflicting undo must not report success')
  assert.match(String(result.error), /nothing was undone/)
  assert.match(String(result.error), /refusing to overwrite newer work/)
  assert.equal(
    await readFile(join(root, 'config.txt'), 'utf8'),
    'user work that must survive',
    'newer work must be untouched',
  )
  const data = /** @type {any} */ (result.data)
  assert.equal(data.restored.length, 0)
  assert.equal(data.removed.length, 0)
  assert.equal(data.skipped.length, 1)
  assert.equal(data.auditFile, null, 'a refused undo writes no audit record')
})

test('undoing the same run twice is a safe no-op', async (t) => {
  const root = await makeWorkspace()
  t.after(() => rm(root, { recursive: true, force: true }))

  await runAndSave(root, [
    { goal: 'write', tool: 'write_file', args: { path: 'src/new.js', content: 'export const x = 1' } },
    { goal: 'edit', tool: 'edit_file', args: { path: 'config.txt', oldText: 'original', newText: 'patched' } },
  ])

  const first = await undoRun({ workspaceRoot: root, runId: 'latest', logger })
  assert.equal(first.ok, true, String(first.error))
  assert.equal(await readFile(join(root, 'config.txt'), 'utf8'), 'original\n')

  const second = await undoRun({ workspaceRoot: root, runId: 'latest', logger })
  assert.equal(second.ok, false, 'the second undo must not pretend to act')
  assert.match(String(second.error), /nothing was undone/)
  assert.equal(await readFile(join(root, 'config.txt'), 'utf8'), 'original\n', 'content stays stable')
  await assert.rejects(() => access(join(root, 'src', 'new.js')), 'created file stays deleted')
})

test('run records persist the snapshots undo needs', async (t) => {
  const root = await makeWorkspace()
  t.after(() => rm(root, { recursive: true, force: true }))

  const { memory, file } = await runAndSave(root, [
    { goal: 'edit', tool: 'edit_file', args: { path: 'config.txt', oldText: 'original', newText: 'patched' } },
  ])
  const saved = JSON.parse(await readFile(file, 'utf8'))
  const action = saved.actions.find((/** @type {any} */ a) => a.tool === 'edit_file')
  assert.ok(action, 'the mutation must be recorded')
  assert.equal(action.snapshot.before, 'original\n')
  assert.equal(action.snapshot.existed, true)
  // Snapshots are restore data — they must not leak into the model-facing output.
  assert.ok(!String(action.output ?? '').includes('original\n'), 'output stays a summary, not the payload')
  assert.equal(memory.record.actions[0].snapshot?.before, 'original\n')
})
