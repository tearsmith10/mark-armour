import { useEffect, useState } from 'react'
import { fmtDateLong, dueLabel } from '../lib/dates.js'
import { uid } from '../lib/storage.js'

export default function TaskDetail({ card, listId, lists, onUpdate, onToggle, onMove, onDelete, onClose }) {
  const [title, setTitle] = useState(card.title)
  const [desc, setDesc] = useState(card.description || '')
  const [notes, setNotes] = useState(card.notes || '')
  const [tags, setTags] = useState((card.tags || []).join(', '))
  const [newSub, setNewSub] = useState('')

  useEffect(() => {
    setTitle(card.title)
    setDesc(card.description || '')
    setNotes(card.notes || '')
    setTags((card.tags || []).join(', '))
  }, [card.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const due = dueLabel(card.dueDate)
  const currentList = lists.find((l) => l.id === listId)

  const commit = (patch, logText) => onUpdate(card, patch, logText)
  const commitTags = () => {
    const next = tags.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean)
    if (JSON.stringify(next) !== JSON.stringify(card.tags || [])) {
      commit({ tags: next }, 'Edited tags')
    }
  }

  const activity = card.activity?.length
    ? card.activity
    : [{ at: card.createdAt, text: 'Created' }]

  return (
    <>
      <div className="panel-backdrop" onClick={onClose} />
      <aside className="task-panel" aria-label="Task details">
        <div className="panel-head">
          <div className="panel-head-meta">
            <span className="pill cat">{card.category || 'Meeting'}</span>
            <span className="muted small">in {currentList?.title || '—'}</span>
          </div>
          <button className="icon-btn" onClick={onClose} title="Close (Esc)">
            ×
          </button>
        </div>

        <div className="panel-body">
          <input
            className="panel-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => {
              if (title.trim() && title !== card.title) commit({ title: title.trim() }, 'Renamed task')
            }}
          />

          {/* Status */}
          <div className="panel-row">
            <span className="field-label">Status</span>
            <div className="seg">
              <button
                className={!card.completed ? 'active' : ''}
                onClick={() => card.completed && onToggle()}
              >
                Open
              </button>
              <button
                className={card.completed ? 'active done' : ''}
                onClick={() => !card.completed && onToggle()}
              >
                ✓ Done
              </button>
            </div>
            <select
              className="move-select"
              value={listId}
              onChange={(e) => onMove(e.target.value)}
              title="Move to list"
            >
              {lists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.title}
                </option>
              ))}
            </select>
          </div>

          {/* Description */}
          <label className="field-label">Description</label>
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            onBlur={() => {
              if (desc !== (card.description || '')) commit({ description: desc }, 'Updated description')
            }}
            placeholder="Add a description…"
            rows={3}
          />

          {/* Date / priority / type */}
          <div className="row form-grid">
            <div>
              <label className="field-label">Due date</label>
              <input
                type="date"
                value={card.dueDate || ''}
                onChange={(e) => commit({ dueDate: e.target.value }, e.target.value ? `Due date → ${e.target.value}` : 'Removed due date')}
              />
              {due && (
                <div className={`due-note ${due.state}`}>{due.text}</div>
              )}
            </div>
            <div>
              <label className="field-label">Priority</label>
              <select
                value={card.priority}
                onChange={(e) => commit({ priority: e.target.value }, `Priority → ${e.target.value}`)}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div>
              <label className="field-label">Type</label>
              <select
                value={card.category || 'Meeting'}
                onChange={(e) => commit({ category: e.target.value }, `Type → ${e.target.value}`)}
              >
                <option value="Meeting">Meeting</option>
                <option value="Deal">Deal</option>
                <option value="Conference">Conference</option>
                <option value="Review">Review</option>
                <option value="Travel">Travel</option>
              </select>
            </div>
          </div>

          {card.dueDate && (
            <div className="muted small">📅 {fmtDateLong(card.dueDate)}</div>
          )}

          {/* Tags */}
          <label className="field-label">Tags</label>
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            onBlur={commitTags}
            placeholder="comma, separated"
          />

          {/* Subtasks */}
          <label className="field-label">
            Subtasks
            {card.subtasks?.length > 0 && (
              <span className="muted">
                {' '}
                · {card.subtasks.filter((s) => s.done).length}/{card.subtasks.length}
              </span>
            )}
          </label>
          <div className="subtasks">
            {(card.subtasks || []).map((s) => (
              <div key={s.id} className="subtask">
                <input
                  type="checkbox"
                  checked={!!s.done}
                  onChange={() =>
                    commit(
                      { subtasks: card.subtasks.map((x) => (x.id === s.id ? { ...x, done: !x.done } : x)) },
                      `${s.done ? 'Reopened' : 'Completed'} subtask: ${s.title}`
                    )
                  }
                />
                <span className={s.done ? 'strike' : ''}>{s.title}</span>
                <button
                  className="icon-btn tiny"
                  title="Delete subtask"
                  onClick={() =>
                    commit({ subtasks: card.subtasks.filter((x) => x.id !== s.id) }, `Removed subtask: ${s.title}`)
                  }
                >
                  ×
                </button>
              </div>
            ))}
            <form
              className="row"
              onSubmit={(e) => {
                e.preventDefault()
                if (!newSub.trim()) return
                commit(
                  { subtasks: [...(card.subtasks || []), { id: uid(), title: newSub.trim(), done: false }] },
                  `Added subtask: ${newSub.trim()}`
                )
                setNewSub('')
              }}
            >
              <input
                value={newSub}
                onChange={(e) => setNewSub(e.target.value)}
                placeholder="+ Add subtask"
              />
            </form>
          </div>

          {/* Notes */}
          <label className="field-label">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => {
              if (notes !== (card.notes || '')) commit({ notes }, 'Edited notes')
            }}
            placeholder="Private notes…"
            rows={3}
          />

          {/* Activity / history */}
          <label className="field-label">Activity</label>
          <ul className="activity">
            {activity.slice(0, 30).map((a, i) => (
              <li key={i}>
                <span className="act-dot" />
                <span>{a.text}</span>
                <span className="muted act-time">
                  {new Date(a.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}{' '}
                  {new Date(a.at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                </span>
              </li>
            ))}
          </ul>

          <button
            className="btn danger"
            onClick={() => {
              onDelete()
              onClose()
            }}
          >
            🗑 Delete task
          </button>
        </div>
      </aside>
    </>
  )
}
