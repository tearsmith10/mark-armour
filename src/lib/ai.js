// Ollama client. Uses the Vite proxy (/ollama -> localhost:11434) by default
// to avoid CORS problems. Falls back to direct URL if proxy is unavailable.
const DIRECT_URL =
  (import.meta.env.VITE_OLLAMA_URL || 'http://localhost:11434').replace(/\/$/, '')
export const DEFAULT_MODEL = import.meta.env.VITE_OLLAMA_MODEL || 'llama3.1'

// Try proxy first, then direct URL (direct needs OLLAMA_ORIGINS set).
// Generous timeout: CPU-only llama3.1 can take several minutes for long prompts.
async function ollama(path, body, { timeoutMs = 300000 } = {}) {
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), timeoutMs)
  try {
    if (body) {
      // POST endpoints: /api/generate, /api/chat
      try {
        const r = await fetch(`/ollama${path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: controller.signal,
        })
        if (r.ok) return r.json()
        // fall through to direct on non-OK (e.g. proxy missing in preview build)
      } catch {
        /* try direct */
      }
      const res = await fetch(`${DIRECT_URL}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
      if (!res.ok) throw new Error(`Ollama ${res.status}`)
      return res.json()
    } else {
      // GET endpoints: /api/tags
      try {
        const r = await fetch(`/ollama${path}`, { signal: controller.signal })
        if (r.ok) return r.json()
      } catch {
        /* try direct */
      }
      const res = await fetch(`${DIRECT_URL}${path}`, { signal: controller.signal })
      if (!res.ok) throw new Error(`Ollama ${res.status}`)
      return res.json()
    }
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('Ollama timed out — is a model loaded?')
    if (e.message.includes('Failed to fetch'))
      throw new Error(
        `Cannot reach Ollama at ${DIRECT_URL}. Is 'ollama serve' running? (See README — OLLAMA_ORIGINS / proxy.)`
      )
    throw e
  } finally {
    clearTimeout(t)
  }
}

export async function listModels() {
  const data = await ollama('/api/tags', null, { timeoutMs: 10000 })
  return (data.models || []).map((m) => m.name)
}

export async function generate(prompt, model, system) {
  const data = await ollama('/api/generate', {
    model: model || DEFAULT_MODEL,
    prompt: system ? `${system}\n\n${prompt}` : prompt,
    stream: false,
    options: { num_predict: 512 }, // hard cap keeps CPU-only runs from rambling past the timeout
  })
  return (data.response || '').trim()
}

export async function chat(messages, model) {
  const data = await ollama('/api/chat', {
    model: model || DEFAULT_MODEL,
    messages,
    stream: false,
  })
  return (data.message?.content || '').trim()
}

// --- High-level helpers used by the UI ---

export async function parseNaturalTask(input, model) {
  const today = new Date()
  const iso = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const tomorrow = new Date(today.getTime() + 86400000)
  const system = `You turn a natural-language request into a todo item. Reply with ONLY valid JSON, no markdown, no explanation.
Schema: {"title": string, "description": string, "priority": "low"|"medium"|"high", "dueDate": "YYYY-MM-DD or empty", "category": "Meeting"|"Deal"|"Conference"|"Review"|"Travel", "tags": string[]}
Today is ${iso(today)}.
Rules:
- "title" = the task itself: 2-7 words starting with an action verb, e.g. "Call the supplier". NEVER copy the whole user sentence. Strip command framing ("Create a task to…", "Add a todo to…", "Remind me to…") and move other words to their fields ("high-priority" -> priority, "tomorrow" -> dueDate).
- "dueDate": convert relative dates (tomorrow, today, next monday) to YYYY-MM-DD using today's date above; "" if no date is mentioned.
- "priority": "medium" unless the request says otherwise.
- "category": deal/contract/sign/negotiate = Deal; summit/forum/conference/keynote = Conference; review/audit = Review; trip/visit/travel = Travel; else Meeting.
- "description": one short context line, or "".
- "tags": 0-3 lowercase keywords.
Example — input: "Create a high-priority task to call the supplier tomorrow"
output: {"title":"Call the supplier","description":"","priority":"high","dueDate":"${iso(tomorrow)}","category":"Meeting","tags":["supplier"]}`
  const raw = await generate(`Request: "${input}"`, model, system)
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('AI returned unparseable JSON')
  const parsed = JSON.parse(match[0])
  // Safety net: if the model echoed the whole command, trim the framing
  if (parsed.title && parsed.title.length > 56) {
    const m = parsed.title.match(
      /(?:task|todo|to-do|reminder)\s+(?:to|for|about|called|named)\s+(.+)$/i
    )
    if (m) parsed.title = m[1].trim()
  }
  return parsed
}

export async function breakdownTask(card, model) {
  const system = `You break a task into small actionable subtasks. Reply with ONLY a JSON array of strings, e.g. ["step 1","step 2"]. Max 7 items. No markdown.`
  const raw = await generate(
    `Task: "${card.title}"\nDetails: "${card.description || ''}"`,
    model,
    system
  )
  const match = raw.match(/\[[\s\S]*\]/)
  if (!match) throw new Error('AI returned unparseable list')
  const arr = JSON.parse(match[0])
  return arr.map(String).filter(Boolean).slice(0, 10)
}

export async function suggestPlan(lists, model) {
  const flat = lists.flatMap((l) =>
    l.cards
      .filter((c) => !c.completed)
      .map((c) => `- [${l.title}] [${c.category || 'Meeting'}] ${c.title} (${c.priority}, due ${c.dueDate || 'none'})`)
  )
  if (!flat.length) return 'Nothing open — board is clear. Nice work.'
  const prompt = `You are the chief of staff briefing a multi-global CEO. Here are the open items:\n${flat.join('\n')}\n\nWrite a tight executive briefing: 1) DEALS TO CLOSE — list each open deal with its due date and one-line close action. 2) TOP 3 PRIORITIES for this week and why. 3) Upcoming conferences/meetings needing prep. Maximum 180 words. Plain text, no markdown, no fluff.`
  return generate(prompt, model, 'You are a crisp, no-fluff chief of staff to a global CEO.')
}

export async function whatShouldIDoFirst(lists, model) {
  const flat = lists.flatMap((l) =>
    l.cards
      .filter((c) => !c.completed)
      .map((c) => `- [${l.title}] [${c.category || 'Meeting'}] ${c.title} (${c.priority}, due ${c.dueDate || 'none'})`)
  )
  if (!flat.length) return 'Nothing open — you are all caught up. 🎉'
  const prompt = `Open items:\n${flat.join('\n')}\n\nWhat is the SINGLE first task to do right now? Answer in exactly 3 short lines: 1) the task, 2) why first (urgency/value), 3) the very next action. Maximum 60 words total. No fluff.`
  return generate(prompt, model, 'You are a decisive chief of staff. Pick one thing and be direct.')
}
