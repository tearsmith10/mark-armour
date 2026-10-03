import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { ollamaAdapter } from '../src/llm/adapters/ollama.js'
import { openaiAdapter } from '../src/llm/adapters/openai.js'
import { anthropicAdapter } from '../src/llm/adapters/anthropic.js'
import { httpJson } from '../src/llm/adapters/http.js'

/** @typedef {{ url: string, method: string, headers: any, body: any }} Captured */

/** @type {Captured[]} */
const captured = []
/** @type {(res: import('node:http').ServerResponse) => void} */
let responder = (res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end('{}')
}
/** @type {import('node:http').Server} */
let server
let base = ''

before(async () => {
  server = createServer((req, res) => {
    let raw = ''
    req.on('data', (d) => (raw += String(d)))
    req.on('end', () => {
      /** @type {any} */
      let body = null
      try {
        body = raw ? JSON.parse(raw) : null
      } catch {
        body = raw
      }
      captured.push({
        url: req.url ?? '',
        method: req.method ?? '',
        headers: req.headers,
        body,
      })
      responder(res)
    })
  })
  await new Promise((resolveListen) => {
    server.listen(0, '127.0.0.1', () => resolveListen(undefined))
  })
  const address = server.address()
  base = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`
})

after(() => {
  server.closeAllConnections?.()
  server.close()
})

/** Clear captured requests and install a new responder. */
function reset(/** @type {(res: import('node:http').ServerResponse) => void} */ next) {
  captured.length = 0
  responder = next
}

/** @param {any} payload */
function json(payload, status = 200) {
  return (/** @type {import('node:http').ServerResponse} */ res) => {
    res.writeHead(status, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(payload))
  }
}

test('ollama adapter speaks the API contract used by the app', async () => {
  reset(json({ model: 'llama3.1', done: true, message: { role: 'assistant', content: '  {"done":true}  ' } }))
  const llm = ollamaAdapter({ baseUrl: base, model: 'llama3.1' })
  const reply = await llm.complete([
    { role: 'system', content: 'sys' },
    { role: 'user', content: 'next action' },
  ], { temperature: 0.5 })

  assert.equal(reply, '{"done":true}')
  const req = captured[0]
  assert.equal(req.method, 'POST')
  assert.equal(req.url, '/api/chat')
  assert.equal(req.body.model, 'llama3.1')
  assert.equal(req.body.stream, false)
  assert.equal(req.body.options.temperature, 0.5)
  assert.equal(req.body.messages.length, 2)
  assert.equal(req.body.messages[1].role, 'user')
})

test('ollama adapter rejects an empty model message', async () => {
  reset(json({ message: { content: '   ' } }))
  const llm = ollamaAdapter({ baseUrl: base, model: 'llama3.1' })
  await assert.rejects(() => llm.complete([{ role: 'user', content: 'x' }]), /empty message/)
})

test('openai adapter sends auth + chat/completions payload', async () => {
  reset(json({ choices: [{ message: { role: 'assistant', content: 'hello' } }] }))
  const llm = openaiAdapter({ baseUrl: `${base}/v1`, model: 'gpt-4o-mini', apiKey: 'sk-test-123' })
  const reply = await llm.complete([{ role: 'user', content: 'hi' }], { temperature: 0.1 })

  assert.equal(reply, 'hello')
  const req = captured[0]
  assert.equal(req.url, '/v1/chat/completions')
  assert.equal(req.headers.authorization, 'Bearer sk-test-123')
  assert.equal(req.body.model, 'gpt-4o-mini')
  assert.equal(req.body.stream, false)
  assert.equal(req.body.temperature, 0.1)
})

test('openai adapter surfaces upstream errors for self-correction', async () => {
  reset(json({ error: { message: 'invalid api key provided' } }, 401))
  const llm = openaiAdapter({ baseUrl: `${base}/v1`, model: 'gpt-4o-mini', apiKey: 'sk-wrong' })
  await assert.rejects(
    () => llm.complete([{ role: 'user', content: 'hi' }]),
    (e) => /401/.test(String(e)) && /invalid api key/.test(String(e)),
  )
})

test('openai adapter fails fast without a key', () => {
  assert.throws(
    () => openaiAdapter({ baseUrl: base, model: 'gpt-4o-mini', apiKey: null }),
    /OPENAI_API_KEY/,
  )
})

test('anthropic adapter extracts system, normalizes turns, sets headers', async () => {
  reset(json({ content: [{ type: 'text', text: 'ok' }] }))
  const llm = anthropicAdapter({ baseUrl: base, model: 'claude-3-5-sonnet-latest', apiKey: 'sk-ant-test' })
  const reply = await llm.complete(
    [
      { role: 'system', content: 'be terse' },
      { role: 'user', content: 'a' },
      { role: 'user', content: 'b' },
    ],
    {},
  )

  assert.equal(reply, 'ok')
  const req = captured[0]
  assert.equal(req.url, '/v1/messages')
  assert.equal(req.headers['x-api-key'], 'sk-ant-test')
  assert.equal(req.headers['anthropic-version'], '2023-06-01')
  assert.equal(req.body.model, 'claude-3-5-sonnet-latest')
  assert.equal(req.body.system, 'be terse')
  assert.equal(req.body.max_tokens, 4096)
  // system must not appear in messages; consecutive user turns are merged
  assert.deepEqual(req.body.messages, [{ role: 'user', content: 'a\n\nb' }])
})

test('anthropic adapter fails fast without a key', () => {
  assert.throws(() => anthropicAdapter({ baseUrl: base, model: 'm', apiKey: null }), /ANTHROPIC_API_KEY/)
})

test('httpJson times out instead of hanging forever', async () => {
  reset(() => {
    /* never respond */
  })
  await assert.rejects(
    () => httpJson(`${base}/slow`, { body: {}, timeoutMs: 150 }),
    /timed out after 150ms/,
  )
})

test('httpJson reports unreachable endpoints with the URL', async () => {
  await assert.rejects(
    () => httpJson('http://127.0.0.1:1/api/chat', { body: {}, timeoutMs: 1500 }),
    /Cannot reach LLM endpoint http:\/\/127\.0\.0\.1:1\/api\/chat/,
  )
})
