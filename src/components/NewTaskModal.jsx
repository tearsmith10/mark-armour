import { useEffect, useRef, useState } from 'react'
import { parseNaturalTask } from '../lib/ai.js'

const emptyForm = {
  title: '',
  description: '',
  dueDate: '',
  priority: 'medium',
  category: 'Meeting',
  tags: '',
}

export default function NewTaskModal({ lists, defaultListId, model, onCreate, onClose, aiBusy, setAiBusy }) {
  const [nl, setNl] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [listId, setListId] = useState(defaultListId)
  const [err, setErr] = useState('')
  const nlRef = useRef(null)

  useEffect(() => nlRef.current?.focus(), [])

  const set = (patch) => setForm((f) => ({ ...f, ...patch }))

  async function extract() {
    const text = nl.trim() || form.title.trim()
    if (!text) return
    setErr('')
    setAiBusy(true)
    try {
      const p = await parseNaturalTask(text, model)
      set({
        title: p.title || text,
        description: p.description || '',
        dueDate: p.dueDate || '',
        priority: p.priority || 'medium',
        category: p.category || 'Meeting',
        tags: (p.tags || []).join(', '),
      })
    } catch (e) {
      setErr(`AI extraction failed: ${e.message} — you can fill the fields manually.`)
      if (!form.title) set({ title: text })
    } finally {
      setAiBusy(false)
    }
  }

  function submit(e) {
    e.preventDefault()
    const title = form.title.trim() || nl.trim()
    if (!title) return
    onCreate(listId, {
      ...form,
      title,
      tags: form.tags
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean),
    })
    onClose()
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="modal-head">
          <h2>New task</h2>
          <button type="button" className="icon-btn" onClick={onClose} title="Close (Esc)">
            ×
          </button>
        </div>

        <label className="field-label">Describe it naturally</label>
        <div className="row">
          <input
            ref={nlRef}
            value={nl}
            onChange={(e) => setNl(e.target.value)}
            placeholder='e.g. "Call the supplier tomorrow high priority"'
            className="grow"
          />
          <button
            type="button"
            className="btn gold"
            onClick={extract}
            disabled={aiBusy}
            title="Extract title, date, priority and type with local AI"
          >
            {aiBusy ? '✨…' : '✨ AI extract'}
          </button>
        </div>

        <div className="modal-divider">Details</div>

        <label className="field-label">Task name</label>
        <input
          value={form.title}
          onChange={(e) => set({ title: e.target.value })}
          placeholder="Task name"
        />

        <label className="field-label">Description</label>
        <textarea
          value={form.description}
          onChange={(e) => set({ description: e.target.value })}
          placeholder="Optional details…"
          rows={2}
        />

        <div className="row form-grid">
          <div>
            <label className="field-label">Due date</label>
            <input type="date" value={form.dueDate} onChange={(e) => set({ dueDate: e.target.value })} />
          </div>
          <div>
            <label className="field-label">Priority</label>
            <select value={form.priority} onChange={(e) => set({ priority: e.target.value })}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
          <div>
            <label className="field-label">Type</label>
            <select value={form.category} onChange={(e) => set({ category: e.target.value })}>
              <option value="Meeting">Meeting</option>
              <option value="Deal">Deal</option>
              <option value="Conference">Conference</option>
              <option value="Review">Review</option>
              <option value="Travel">Travel</option>
            </select>
          </div>
          <div>
            <label className="field-label">List</label>
            <select value={listId} onChange={(e) => setListId(e.target.value)}>
              {lists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        <label className="field-label">Tags (comma separated)</label>
        <input
          value={form.tags}
          onChange={(e) => set({ tags: e.target.value })}
          placeholder="supplier, logistics"
        />

        {err && <div className="auth-err">{err}</div>}

        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" disabled={!form.title.trim() && !nl.trim()}>
            Create task
          </button>
        </div>
      </form>
    </div>
  )
}
