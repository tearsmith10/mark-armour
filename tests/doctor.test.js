import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runDoctor, formatChecks } from '../src/agent/doctor/index.js'
import { loadSettings } from '../src/config/index.js'
import { Logger } from '../src/logging/logger.js'

process.env.AGENT_LOG_FILE = 'none'

const logger = new Logger({ level: 'silent', sink: () => {} })

/** @returns {Promise<string>} temp workspace with a test script */
async function makeWorkspace() {
  const root = await mkdtemp(join(tmpdir(), 'agent-doctor-'))
  await writeFile(
    join(root, 'package.json'),
    JSON.stringify({ name: 'fixture', version: '1.0.0', scripts: { test: 'node t.js' } }, null, 2),
  )
  await writeFile(join(root, 't.js'), 'console.log("ok")\n')
  return root
}

/**
 * @param {string} root
 * @param {any} [overrides]
 */
function settingsFor(root, overrides = {}) {
  return loadSettings({
    cwd: root,
    overrides: { workspaceRoot: root, llm: { provider: 'mock' }, ...overrides },
  })
}

test('doctor reports a healthy environment for the mock provider', async (t) => {
  const root = await makeWorkspace()
  t.after(() => rm(root, { recursive: true, force: true }))

  const { checks, ok } = await runDoctor({ settings: settingsFor(root), logger })
  assert.equal(ok, true, `expected no failures: ${JSON.stringify(checks.filter((c) => c.status === 'fail'))}`)
  assert.equal(checks.length, 10)

  /** @param {string} id */
  const byId = (id) => checks.find((c) => c.id === id)
  assert.equal(byId('node')?.status, 'ok')
  assert.equal(byId('workspace')?.status, 'ok')
  assert.match(String(byId('workspace')?.detail), /writable/)
  assert.equal(byId('provider')?.status, 'ok')
  assert.equal(byId('reachability')?.status, 'ok', 'mock needs no endpoint')
  assert.equal(byId('validation')?.status, 'ok')
  assert.match(String(byId('validation')?.detail), /npm run test/)
  assert.equal(byId('tools')?.status, 'ok')
  assert.match(String(byId('tools')?.detail), /9 tools/)
  assert.equal(byId('storage')?.status, 'ok')
  assert.equal(byId('safety')?.status, 'ok')

  for (const c of checks) {
    assert.ok(c.label.length > 0 && c.detail.length > 0, `${c.id} must be self-describing`)
    if (c.status !== 'ok') assert.ok(c.fix, `${c.id} (${c.status}) must come with a fix`)
  }
})

test('doctor flags allowUnsafe as a warning, not a failure', async (t) => {
  const root = await makeWorkspace()
  t.after(() => rm(root, { recursive: true, force: true }))

  const settings = settingsFor(root, { agent: { allowUnsafe: true } })
  const { checks, ok } = await runDoctor({ settings, logger })
  assert.equal(ok, true)
  const safety = checks.find((c) => c.id === 'safety')
  assert.equal(safety?.status, 'warn')
  assert.match(String(safety?.detail), /AGENT_ALLOW_UNSAFE is ON/)
})

test('doctor fails when a cloud provider has no API key', async (t) => {
  const root = await makeWorkspace()
  t.after(() => rm(root, { recursive: true, force: true }))

  const settings = loadSettings({
    cwd: root,
    overrides: {
      workspaceRoot: root,
      llm: { provider: 'openai', model: 'gpt-4o-mini', apiKey: null, baseUrl: 'https://api.openai.com/v1' },
    },
  })
  const { checks, ok } = await runDoctor({ settings, logger })
  assert.equal(ok, false, 'a keyless cloud provider must be reported as not ready')
  const failing = checks.filter((c) => c.status === 'fail').map((c) => c.id)
  assert.ok(failing.includes('provider'), `expected provider failure, got ${failing.join(',')}`)
  assert.ok(failing.includes('reachability'))
})

test('doctor degrades to a warning when a project defines no scripts', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'agent-doctor-noscript-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  await writeFile(join(root, 'package.json'), JSON.stringify({ name: 'bare', version: '1.0.0' }))

  const { checks, ok } = await runDoctor({ settings: settingsFor(root), logger })
  assert.equal(ok, true, 'missing scripts is a warning, not a blocker')
  const validation = checks.find((c) => c.id === 'validation')
  assert.equal(validation?.status, 'warn')
  assert.match(String(validation?.detail), /node --check/)
  assert.match(String(validation?.fix), /AGENT_VERIFY_COMMANDS/)
})

test('doctor fails when the workspace does not exist', async (t) => {
  const root = await makeWorkspace()
  t.after(() => rm(root, { recursive: true, force: true }))
  const settings = settingsFor(join(root, 'does-not-exist-at-all'))

  const { ok, checks } = await runDoctor({ settings, logger })
  assert.equal(ok, false)
  assert.ok(checks.some((c) => c.id === 'workspace' && c.status === 'fail'))
})

test('formatChecks renders aligned lines with fix hints', async (t) => {
  const root = await makeWorkspace()
  t.after(() => rm(root, { recursive: true, force: true }))

  const { checks } = await runDoctor({ settings: settingsFor(root), logger })
  const text = formatChecks(checks)
  assert.match(text, /✓ Node\.js/)
  assert.match(text, /⚠/) // git is unavailable on this machine (warn)
  const lines = text.split('\n')
  assert.ok(lines.length >= checks.length, 'every check prints a line')
  for (const c of checks.filter((x) => x.fix)) {
    assert.ok(
      lines.some((l) => l.includes(`fix: ${c.fix}`)),
      `${c.id} fix hint must be printed`,
    )
  }
})
