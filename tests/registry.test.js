import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ToolRegistry } from '../src/tools/registry.js'
import { Logger } from '../src/logging/logger.js'
import { ok, err } from '../src/utils/result.js'

/** Minimal context for unit tests (no filesystem access needed). */
function makeCtx() {
  const settings = /** @type {any} */ ({ workspaceRoot: process.cwd(), agent: {} })
  return {
    workspaceRoot: process.cwd(),
    logger: new Logger({ level: 'silent', sink: () => {} }),
    settings,
  }
}

test('register + list + manifest exposes schema', () => {
  const registry = new ToolRegistry(/** @type {any} */ (makeCtx()))
  registry.register({
    name: 'echo',
    description: 'returns the input',
    inputSchema: { type: 'object', properties: { x: { type: 'string' } } },
    execute: async (args) => ok(args.x),
  })
  assert.equal(registry.list().length, 1)
  assert.equal(registry.manifest()[0].name, 'echo')
  assert.deepEqual(registry.get('echo')?.inputSchema.properties.x, { type: 'string' })
})

test('duplicate tool names are rejected at registration time', () => {
  const registry = new ToolRegistry(/** @type {any} */ (makeCtx()))
  const tool = {
    name: 'dupe',
    description: 'x',
    inputSchema: {},
    execute: async () => ok(null),
  }
  registry.register(tool)
  assert.throws(() => registry.register(tool), /already registered/)
})

test('malformed tool definitions are rejected', () => {
  const registry = new ToolRegistry(/** @type {any} */ (makeCtx()))
  assert.throws(() => registry.register(/** @type {any} */ ({})), /non-empty name/)
  assert.throws(
    () => registry.register(/** @type {any} */ ({ name: 'x', description: 'd' })),
    /execute/,
  )
  assert.throws(
    () => registry.register(/** @type {any} */ ({ name: 'x', execute: async () => ok(null) })),
    /description/,
  )
})

test('unknown tool returns a structured error, not a throw', async () => {
  const registry = new ToolRegistry(/** @type {any} */ (makeCtx()))
  const result = await registry.execute('nope', {})
  assert.equal(result.ok, false)
  assert.match(String(result.error), /Unknown tool "nope"/)
  assert.match(String(result.error), /Available/)
})

test('executor exceptions are converted into structured errors', async () => {
  const registry = new ToolRegistry(/** @type {any} */ (makeCtx()))
  registry.register({
    name: 'boom',
    description: 'always throws',
    inputSchema: {},
    execute: async () => {
      throw new Error('kaboom')
    },
  })
  const result = await registry.execute('boom', {})
  assert.equal(result.ok, false)
  assert.equal(result.error, 'kaboom')
  assert.equal(result.meta?.thrown, true)
})

test('tools returning a plain value are normalized to ok(data)', async () => {
  const registry = new ToolRegistry(/** @type {any} */ (makeCtx()))
  registry.register({
    name: 'plain',
    description: 'returns raw data',
    inputSchema: {},
    execute: async () => /** @type {any} */ ({ hello: 'world' }),
  })
  const result = await registry.execute('plain', {})
  assert.equal(result.ok, true)
  assert.match(String(result.data), /hello/)
})

test('oversized output is truncated so it cannot blow the context', async () => {
  const registry = new ToolRegistry(/** @type {any} */ (makeCtx()))
  registry.register({
    name: 'huge',
    description: 'returns a lot',
    inputSchema: {},
    execute: async () => ok('x'.repeat(50_000)),
  })
  const result = await registry.execute('huge', {})
  assert.equal(result.ok, true)
  assert.ok(String(result.data).length < 9000)
  assert.match(String(result.data), /truncated/)
})

test('err() always carries a string message', () => {
  const r = err(new Error('boom'))
  assert.equal(r.ok, false)
  assert.equal(r.error, 'boom')
  assert.equal(err({ weird: true }).error, '{"weird":true}')
})
