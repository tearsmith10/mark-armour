import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runCommandTool, runShell } from '../src/tools/terminal/run_command.js'
import { runTestsTool, detectTestCommand, nodeCheckAll, collectJsFiles } from '../src/tools/testing/run_tests.js'
import { gitStatusTool, gitDiffTool, gitAvailable } from '../src/tools/git/git_tools.js'
import { Logger } from '../src/logging/logger.js'

const logger = new Logger({ level: 'silent', sink: () => {} })

/** @param {boolean} [allowUnsafe] */
/**
 * @param {string} root
 * @param {boolean} [allowUnsafe]
 */
function ctxFor(root, allowUnsafe = false) {
  return /** @type {any} */ ({
    workspaceRoot: root,
    logger,
    settings: { workspaceRoot: root, agent: { allowUnsafe, commandTimeoutMs: 60_000 } },
  })
}

test('runShell captures stdout and exit codes', async () => {
  const good = await runShell('node -e "console.log(41+1)"', {
    cwd: process.cwd(),
    timeoutMs: 30_000,
    allowUnsafe: false,
  })
  assert.equal(good.code, 0)
  assert.match(good.stdout, /42/)

  const bad = await runShell('node -e "process.exit(3)"', {
    cwd: process.cwd(),
    timeoutMs: 30_000,
    allowUnsafe: false,
  })
  assert.equal(bad.code, 3)
})

test('runShell enforces its timeout', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'agent-shell-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const started = Date.now()
  const r = await runShell('node -e "setTimeout(()=>{},60000)"', {
    cwd: root,
    timeoutMs: 1500,
    allowUnsafe: false,
  })
  assert.ok(Date.now() - started < 20_000, 'must not wait for the full child lifetime')
  assert.equal(r.timedOut, true)
})

test('run_command blocks dangerous commands and passes safe ones', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'agent-cmd-'))
  t.after(() => rm(root, { recursive: true, force: true }))

  const blocked = await runCommandTool.execute({ command: 'rm -rf .' }, ctxFor(root))
  assert.equal(blocked.ok, false)
  assert.match(String(blocked.error), /Blocked dangerous command/)

  const safe = await runCommandTool.execute({ command: 'node -e "console.log(1)"' }, ctxFor(root))
  assert.equal(safe.ok, true)
})

test('run_command reports non-zero exits as structured failures', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'agent-cmd-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const r = await runCommandTool.execute(
    { command: 'node -e "console.error(\'it broke\'); process.exit(1)"' },
    ctxFor(root),
  )
  assert.equal(r.ok, false)
  assert.match(String(r.error), /exit code 1/)
  assert.match(String(r.data), /it broke/)
})

test('run_command refuses to run outside the workspace', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'agent-cmd-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const r = await runCommandTool.execute(
    { command: 'node -e "1"', cwd: '../../..' },
    ctxFor(root),
  )
  assert.equal(r.ok, false)
  assert.match(String(r.error), /escapes the workspace/)
})

test('detectTestCommand prefers an explicit override, then test, lint, build', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'agent-detect-'))
  const { writeFile } = await import('node:fs/promises')
  /** @param {Record<string, string>} scripts */
  const pkg = (scripts) => JSON.stringify({ scripts })
  try {
    await writeFile(join(dir, 'package.json'), pkg({ build: 'vite build' }))
    assert.equal(detectTestCommand(dir, ['npm run custom']).command, 'npm run custom')
    assert.equal(detectTestCommand(dir, null).command, 'npm run build')

    await writeFile(join(dir, 'package.json'), pkg({ test: 'node t.js', build: 'vite build' }))
    assert.equal(detectTestCommand(dir, null).command, 'npm run test')

    await writeFile(join(dir, 'package.json'), JSON.stringify({ no: 'scripts' }))
    const none = detectTestCommand(dir, null)
    assert.equal(none.command, null)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('run_tests falls back to node --check when no script exists', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'agent-notest-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const { writeFile, mkdir } = await import('node:fs/promises')
  await mkdir(join(root, 'src'), { recursive: true })
  await writeFile(join(root, 'src', 'good.js'), 'export const ok = 1\n')
  const r = await runTestsTool.execute({}, ctxFor(root))
  assert.equal(r.ok, true, String(r.error))
  assert.match(String(r.data), /node --check passed/)
})

test('node --check flags syntax errors', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'agent-syntax-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const { writeFile } = await import('node:fs/promises')
  await writeFile(join(root, 'broken.js'), 'const x = {\n')
  const r = await runTestsTool.execute({}, ctxFor(root))
  assert.equal(r.ok, false)
  assert.match(String(r.error), /node --check failed/)
  assert.match(String(r.data), /broken\.js/)
  assert.ok(collectJsFiles(root).some((f) => f.endsWith('broken.js')))
})

test('git tools degrade to a clear error when git is unavailable', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'agent-git-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const available = await gitAvailable(root)
  if (available) {
    // Machine has git: tools should then work (repo or not).
    const status = await gitStatusTool.execute({}, ctxFor(root))
    assert.equal(typeof status.ok, 'boolean')
    if (!status.ok) assert.match(String(status.error), /git status failed|not a git/i)
  } else {
    const status = await gitStatusTool.execute({}, ctxFor(root))
    assert.equal(status.ok, false)
    assert.match(String(status.error), /git executable not found/)
    assert.match(String(status.error), /Install Git/)

    const diff = await gitDiffTool.execute({}, ctxFor(root))
    assert.equal(diff.ok, false)
    assert.match(String(diff.error), /git executable not found/)
  }
})
