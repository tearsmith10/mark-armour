import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createProvider } from '../src/llm/provider.js'
import { mockAdapter } from '../src/llm/adapters/mock.js'
import { safeJsonParse, redact, truncate, slugify } from '../src/utils/text.js'
import { parseDecision } from '../src/agent/executor/index.js'
import { heuristicPlan, createPlan } from '../src/agent/planner/index.js'
import { Logger } from '../src/logging/logger.js'

const silentLogger = () => new Logger({ level: 'silent', sink: () => {} })

test('mock provider returns a parseable plan for the PLANNER stage', async () => {
  const llm = mockAdapter()
  const raw = await llm.complete([
    { role: 'system', content: 'sys' },
    { role: 'user', content: 'STAGE: PLANNER\nmake a plan' },
  ])
  const parsed = safeJsonParse(raw)
  assert.ok(Array.isArray(parsed.steps))
  assert.ok(parsed.steps.every((/** @type {any} */ s) => typeof s.goal === 'string'))
})

test('mock provider finishes when execution is complete', async () => {
  const llm = mockAdapter()
  const raw = await llm.complete([{ role: 'user', content: 'STAGE: EXECUTOR' }])
  const decision = parseDecision(raw)
  assert.equal(/** @type {any} */ (decision)?.kind, 'done')
})

test('mock provider honors an explicit script and repeats the last entry', async () => {
  const llm = mockAdapter({ script: ['{"tool":"read_file","args":{"path":"a"}}', '{"done":true,"summary":"fin"}'] })
  assert.match(await llm.complete([]), /read_file/)
  assert.match(await llm.complete([]), /done/)
  assert.match(await llm.complete([]), /done/) // exhausted → repeats last
})

test('createProvider rejects unknown providers', () => {
  assert.throws(
    () => createProvider(/** @type {any} */ ({ provider: 'nope', model: 'x' })),
    /Unknown LLM provider/,
  )
})

test('openai provider fails fast when the API key is missing', () => {
  assert.throws(
    () =>
      createProvider(
        /** @type {any} */ ({ provider: 'openai', model: 'gpt-4o-mini', apiKey: null, baseUrl: '' }),
      ),
    /OPENAI_API_KEY/,
  )
})

test('createPlan falls back to the heuristic plan when the LLM is down', async () => {
  const failing = /** @type {any} */ ({
    id: 'broken',
    model: 'x',
    complete: async () => {
      throw new Error('ECONNREFUSED localhost:11434')
    },
  })
  const plan = await createPlan({
    task: 'add a flag',
    context: '(ctx)',
    llm: failing,
    tools: [],
    logger: silentLogger(),
  })
  assert.equal(plan.origin, 'heuristic')
  assert.ok(plan.steps.length >= 3)
  assert.match(plan.strategy, /heuristic fallback/)
  assert.match(plan.strategy, /ECONNREFUSED/)
})

test('createPlan ignores tool names the model invented', async () => {
  const fake = /** @type {any} */ ({
    id: 'fake',
    model: 'x',
    complete: async () =>
      JSON.stringify({
        strategy: 's',
        steps: [
          { goal: 'real tool', tool: 'list_files', args: { path: '.' } },
          { goal: 'made up', tool: 'rm_everything', args: {} },
          { goal: 'reasoning only', tool: null },
        ],
      }),
  })
  const plan = await createPlan({
    task: 'x',
    context: '(ctx)',
    llm: fake,
    tools: [/** @type {any} */ ({ name: 'list_files', description: 'd', inputSchema: {}, execute: async () => ({ ok: true, data: null, error: null, meta: {} }) })],
    logger: silentLogger(),
  })
  assert.equal(plan.origin, 'llm')
  assert.equal(plan.steps[0].tool, 'list_files')
  assert.equal(plan.steps[1].tool, null, 'unknown tools must be nulled, not executed')
  assert.equal(plan.steps[2].tool, null)
})

test('heuristic plan always ends with validation', () => {
  const plan = heuristicPlan('do something risky')
  const last = plan.steps[plan.steps.length - 1]
  assert.equal(last.tool, null)
  assert.ok(plan.steps.some((s) => s.tool === 'run_tests'))
})

test('parseDecision accepts only well-formed actions', () => {
  assert.deepEqual(parseDecision('{"tool":"read_file","args":{"path":"a"}}'), {
    kind: 'tool',
    tool: 'read_file',
    args: { path: 'a' },
    reasoning: undefined,
  })
  assert.equal(parseDecision('{"done":true}')?.kind, 'done')
  assert.equal(parseDecision('I think we should just edit the file directly'), null)
  assert.equal(parseDecision('{"nonsense":true}'), null)
  assert.equal(parseDecision(''), null)
})

test('safeJsonParse handles fenced and prose-wrapped JSON', () => {
  assert.deepEqual(safeJsonParse('```json\n{"a":1}\n```'), { a: 1 })
  assert.deepEqual(safeJsonParse('Sure! Here you go: {"a":2} hope that helps'), { a: 2 })
  assert.equal(safeJsonParse('no json here'), null)
  assert.equal(safeJsonParse('{broken'), null)
})

test('redact strips credential-looking values', () => {
  const samples = [
    'sk-test_1234567890abcdef1234567890',
    'Authorization: Bearer abcdefghijklmnop123456',
    'api_key=supersecretvalue99',
    'password: hunter2hunter2',
    'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIn0.abcdefgh',
  ]
  for (const s of samples) {
    assert.doesNotMatch(redact(s), /hunter2|supersecretvalue|eyJzdWI|sk-test_12345|abcdefghijklmnop12345/, s)
  }
  assert.equal(redact('plain text stays'), 'plain text stays')
})

test('truncate keeps head and tail', () => {
  const out = truncate('a'.repeat(1000) + 'MIDDLE' + 'b'.repeat(1000), 100)
  assert.ok(out.length < 300)
  assert.match(out, /truncated/)
  assert.equal(truncate('short', 100), 'short')
})

test('slugify produces filesystem-safe ids', () => {
  assert.equal(slugify('Hello, World! 2026'), 'hello-world-2026')
  assert.equal(slugify('///'), '')
})
