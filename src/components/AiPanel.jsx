import { useEffect, useRef, useState } from 'react'
import { chat, suggestPlan, whatShouldIDoFirst, parseNaturalTask, DEFAULT_MODEL } from '../lib/ai.js'
import { dueLabel, isOverdue, todayStr } from '../lib/dates.js'

const SUGGESTIONS = ['Plan my day', 'What should I do first?', 'Show my overdue tasks', '✨ Executive briefing']

/** Local, instant answers — no model call needed. */
function localReply(text, lists) {
  const all = lists.flatMap((l) => l.cards.map((c) => ({ ...c, listTitle: l.title })))

  // "Show my overdue tasks"
  if (/\boverdue\b|\bpast due\b|\blate tasks\b/i.test(text)) {
    const overdue = all
      .filter(isOverdue)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    if (!overdue.length) return '✅ Nothing overdue — you are fully on schedule.'
    return (
      `🚨 ${overdue.length} overdue task${overdue.length === 1 ? '' : 's'}:\n` +
      overdue
        .map((c) => {
          const d = dueLabel(c.dueDate)
          return `• ${c.title} — ${d.text} [${c.priority}, ${c.listTitle}]`
        })
        .join('\n')
    )
  }

  // "What's due today" style query
  if (/\bwhat.?s due today\b|\btoday.?s tasks\b|\bdue today\b/i.test(text)) {
    const today = all.filter((c) => c.dueDate === todayStr() && !c.completed)
    if (!today.length) return '✅ Nothing due today.'
    return `📍 ${today.length} due today:\n` + today.map((c) => `• ${c.title} [${c.priority}]`).join('\n')
  }

  return null
}

/** Detect "create a high-priority task to call the supplier tomorrow" */
function wantsCreation(text) {
  return (
    (/\b(create|add|make|schedule|log|put in)\b[\s\S]*\b(task|todo|to-do|reminder)\b/i.test(text) &&
      !/show|list|what|how many|summar/i.test(text)) ||
    /\b(task|todo|reminder)\b[\s\S]*\b(today|tomorrow|tonight|next week|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(text)
  )
}

export default function AiPanel({
  lists,
  boardSnapshot,
  model,
  models,
  onModelChange,
  onCreateTask,
  busy: extBusy,
  setBusy: setExtBusy,
}) {
  const [input, setInput] = useState('')
  const [log, setLog] = useState([
    {
      role: 'assistant',
      text: 'Hi — I run 100% locally via Ollama. Try: "Plan my day", "What should I do first?", "Show my overdue tasks", or "Create a high-priority task to call the supplier tomorrow".',
    },
  ])
  const [busy, setBusy] = useState(false)
  const logRef = useRef(null)

  const working = busy || extBusy

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' })
  }, [log, busy])

  function push(msgs) {
    setLog((prev) => [...prev, ...msgs])
  }

  async function send(preset) {
    const text = (preset ?? input).trim()
    if (!text || working) return
    setInput('')
    push([{ role: 'user', text }])
    setBusy(true)
    setExtBusy?.(true)
    try {
      // 1) Natural-language task creation → local model extracts fields
      if (wantsCreation(text)) {
        const p = await parseNaturalTask(text, model)
        onCreateTask(p)
        const due = p.dueDate ? ` · due ${dueLabel(p.dueDate).text}` : ''
        push([
          {
            role: 'assistant',
            text: `✅ Created in To Do:\n"${p.title}"\n${(p.priority || 'medium').toUpperCase()} priority${due} · ${p.category || 'Meeting'}${p.tags?.length ? ` · ${p.tags.map((t) => '#' + t).join(' ')}` : ''}`,
          },
        ])
        return
      }

      // 2) Instant local answers (no model call)
      const local = localReply(text, lists)
      if (local) {
        push([{ role: 'assistant', text: local }])
        return
      }

      // 3) "Plan my day"
      if (/\bplan\s+(my|the|a)\s+day\b|\bdaily\s+plan\b|\bbrief\s+me\b|\bbriefing\b/i.test(text)) {
        const plan = await suggestPlan(lists, model)
        push([{ role: 'assistant', text: plan }])
        return
      }

      // 4) "What should I do first?"
      if (/what should i do first|do first|first thing|top priority|prioriti[sz]e/i.test(text)) {
        const ans = await whatShouldIDoFirst(lists, model)
        push([{ role: 'assistant', text: ans }])
        return
      }

      // 5) Free chat with board context
      const context = `Current board snapshot:\n${boardSnapshot}\n\nUser: ${text}\nReply concisely and helpfully. If the user states a task, restate it as: Title / Priority / Due date.`
      const reply = await chat(
        [
          { role: 'system', content: 'You are a concise local productivity assistant for a CEO office.' },
          { role: 'user', content: context },
        ],
        model
      )
      push([{ role: 'assistant', text: reply }])
    } catch (e) {
      push([{ role: 'assistant', text: `⚠️ ${e.message}` }])
    } finally {
      setBusy(false)
      setExtBusy?.(false)
    }
  }

  return (
    <aside className="ai-panel" aria-label="Local AI assistant">
      <div className="ai-head">
        <h3>✨ Local AI</h3>
        <select value={model} onChange={(e) => onModelChange(e.target.value)} title="Ollama model">
          {[model, ...models.filter((m) => m !== model)].map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>

      <div className="ai-chips">
        {SUGGESTIONS.map((s) => (
          <button key={s} className="chip" disabled={working} onClick={() => send(s)}>
            {s}
          </button>
        ))}
      </div>

      <div className="chat-log" ref={logRef}>
        {log.map((m, i) => (
          <div key={i} className={`msg ${m.role}`}>{m.text}</div>
        ))}
        {busy && <div className="msg assistant">…thinking locally (on CPU this can take a minute)</div>}
      </div>

      <div className="row">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="Ask or create a task…"
          aria-label="Ask the local AI"
        />
        <button className="btn" onClick={() => send()} disabled={working}>
          Send
        </button>
      </div>
      <p className="muted small ai-note">
        Runs on your machine via Ollama · <code>{DEFAULT_MODEL}</code> — nothing leaves this device.
      </p>
    </aside>
  )
}
