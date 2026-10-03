import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, mkdir, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ToolRegistry } from '../src/tools/registry.js'
import { createRegistry } from '../src/tools/index.js'
import { Logger } from '../src/logging/logger.js'
import { readFileTool } from '../src/tools/filesystem/read_file.js'
import { writeFileTool } from '../src/tools/filesystem/write_file.js'
import { editFileTool } from '../src/tools/filesystem/edit_file.js'
import { listFilesTool } from '../src/tools/filesystem/list_files.js'
import { searchFilesTool } from '../src/tools/repository/search_files.js'

/** @returns {Promise<{ root: string, registry: ToolRegistry, cleanup: () => Promise<void> }>} */
async function makeWorkspace() {
  const root = await mkdtemp(join(tmpdir(), 'agent-fs-'))
  const logger = new Logger({ level: 'silent', sink: () => {} })
  const settings = /** @type {any} */ ({
    workspaceRoot: root,
    agent: { allowUnsafe: false, commandTimeoutMs: 30_000 },
  })
  const registry = new ToolRegistry({ workspaceRoot: root, logger, settings })
  registry.register(readFileTool)
  registry.register(writeFileTool)
  registry.register(editFileTool)
  registry.register(listFilesTool)
  registry.register(searchFilesTool)
  await mkdir(join(root, 'src'), { recursive: true })
  await writeFile(join(root, 'src', 'app.js'), 'export const VERSION = "1.0.0"\n// TODO: bump\n')
  await mkdir(join(root, 'node_modules', 'left-pad'), { recursive: true })
  await writeFile(join(root, 'node_modules', 'left-pad', 'index.js'), 'TODO: never scanned\n')
  return { root, registry, cleanup: () => rm(root, { recursive: true, force: true }) }
}

test('write → read round trip with line numbers', async () => {
  const { root, registry, cleanup } = await makeWorkspace()
  try {
    const w = await registry.execute('write_file', { path: 'notes.md', content: '# hi\n' })
    assert.equal(w.ok, true)
    const r = await registry.execute('read_file', { path: 'notes.md' })
    assert.equal(r.ok, true)
    assert.match(String(r.data), /1\| # hi/)
    const lines = await registry.execute('read_file', { path: 'notes.md', startLine: 1, endLine: 1 })
    assert.equal(lines.ok, true)
    assert.match(String(lines.data), /# hi/)
  } finally {
    await cleanup()
    void root
  }
})

test('create:false refuses to overwrite an existing file', async () => {
  const { registry, cleanup } = await makeWorkspace()
  try {
    const first = await registry.execute('write_file', { path: 'a.txt', content: 'one' })
    assert.equal(first.ok, true)
    const second = await registry.execute('write_file', { path: 'a.txt', content: 'two', create: false })
    assert.equal(second.ok, false)
    assert.match(String(second.error), /already exists/)
  } finally {
    await cleanup()
  }
})

test('read_file on a directory suggests list_files instead', async () => {
  const { registry, cleanup } = await makeWorkspace()
  try {
    const r = await registry.execute('read_file', { path: 'src' })
    assert.equal(r.ok, false)
    assert.match(String(r.error), /list_files/)
  } finally {
    await cleanup()
  }
})

test('edit_file replaces a unique anchor and fails on ambiguity', async () => {
  const { root, registry, cleanup } = await makeWorkspace()
  try {
    const good = await registry.execute('edit_file', {
      path: 'src/app.js',
      oldText: 'VERSION = "1.0.0"',
      newText: 'VERSION = "2.0.0"',
    })
    assert.equal(good.ok, true)
    const after = await readFile(join(root, 'src', 'app.js'), 'utf8')
    assert.match(after, /2\.0\.0/)

    // 'VERSION' now occurs exactly once → a second, unique edit succeeds.
    const single = await registry.execute('edit_file', {
      path: 'src/app.js',
      oldText: 'VERSION',
      newText: 'APP_VERSION',
    })
    assert.equal(single.ok, true)

    // A duplicated fragment must be refused instead of patched at random.
    await registry.execute('write_file', {
      path: 'dupes.txt',
      content: 'alpha\nbeta\nalpha\n',
    })
    const ambiguous = await registry.execute('edit_file', {
      path: 'dupes.txt',
      oldText: 'alpha',
      newText: 'gamma',
    })
    assert.equal(ambiguous.ok, false)
    assert.match(String(ambiguous.error), /matches 2 times/)
    assert.match(String(ambiguous.error), /unique/)

    // …unless replaceAll is explicit.
    const all = await registry.execute('edit_file', {
      path: 'dupes.txt',
      oldText: 'alpha',
      newText: 'gamma',
      replaceAll: true,
    })
    assert.equal(all.ok, true)
    assert.equal(await readFile(join(root, 'dupes.txt'), 'utf8'), 'gamma\nbeta\ngamma\n')

    const missing = await registry.execute('edit_file', {
      path: 'src/app.js',
      oldText: 'DOES NOT EXIST',
      newText: 'x',
    })
    assert.equal(missing.ok, false)
    assert.match(String(missing.error), /not found/)
  } finally {
    await cleanup()
  }
})

test('edits outside the workspace are refused', async () => {
  const { registry, cleanup } = await makeWorkspace()
  try {
    const r = await registry.execute('write_file', { path: '../escape.txt', content: 'x' })
    assert.equal(r.ok, false)
    assert.match(String(r.error), /escapes the workspace/)
  } finally {
    await cleanup()
  }
})

test('list_files skips node_modules and git internals', async () => {
  const { registry, cleanup } = await makeWorkspace()
  try {
    const r = await registry.execute('list_files', { path: '.', maxDepth: 4 })
    assert.equal(r.ok, true)
    const out = String(r.data)
    assert.match(out, /src/)
    assert.doesNotMatch(out, /node_modules/)
    assert.doesNotMatch(out, /left-pad/)
  } finally {
    await cleanup()
  }
})

test('search_files finds matches and ignores node_modules', async () => {
  const { registry, cleanup } = await makeWorkspace()
  try {
    const r = await registry.execute('search_files', { query: 'TODO' })
    assert.equal(r.ok, true)
    const out = String(r.data)
    assert.match(out, /src\/app\.js:\d+/)
    assert.doesNotMatch(out, /node_modules/)
  } finally {
    await cleanup()
  }
})

test('search_files supports regex and extension filters', async () => {
  const { registry, cleanup } = await makeWorkspace()
  try {
    const re = await registry.execute('search_files', { query: 'VERSION\\s*=', isRegex: true })
    assert.equal(re.ok, true)
    assert.match(String(re.data), /src\/app\.js/)

    const scoped = await registry.execute('search_files', {
      query: 'TODO',
      path: 'src',
      extension: '.js',
    })
    assert.equal(scoped.ok, true)
    assert.match(String(scoped.data), /src\/app\.js/)

    const wrongExt = await registry.execute('search_files', { query: 'TODO', extension: '.py' })
    assert.equal(wrongExt.ok, true)
    assert.match(String(wrongExt.data), /No matches/)
  } finally {
    await cleanup()
  }
})

test('invalid regex yields a structured error, not a crash', async () => {
  const { registry, cleanup } = await makeWorkspace()
  try {
    const r = await registry.execute('search_files', { query: '([unclosed', isRegex: true })
    assert.equal(r.ok, false)
    assert.match(String(r.error), /Invalid regular expression/)
  } finally {
    await cleanup()
  }
})

test('the default registry contains exactly the nine required tools', async () => {
  const settings = /** @type {any} */ ({ workspaceRoot: process.cwd(), agent: {} })
  const registry = createRegistry({
    workspaceRoot: process.cwd(),
    logger: new Logger({ level: 'silent', sink: () => {} }),
    settings,
  })
  const names = registry
    .list()
    .map((t) => t.name)
    .sort()
  assert.deepEqual(names, [
    'edit_file',
    'git_diff',
    'git_status',
    'list_files',
    'read_file',
    'run_command',
    'run_tests',
    'search_files',
    'write_file',
  ])
  for (const t of registry.list()) {
    assert.ok(t.description.length > 20, `${t.name} needs a real description`)
    assert.equal(typeof t.inputSchema, 'object')
  }
})
