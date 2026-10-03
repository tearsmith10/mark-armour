import { useRef } from 'react'

const NAV = [
  { id: 'today', label: 'Today', icon: '📅' },
  { id: 'board', label: 'Board', icon: '🗂' },
  { id: 'calendar', label: 'Calendar', icon: '📆' },
  { id: 'projects', label: 'Projects', icon: '🏷' },
  { id: 'inbox', label: 'Inbox', icon: '📥' },
]

export default function Sidebar({
  view,
  onView,
  counts,
  onExport,
  onImport,
  onReseed,
  onNewTask,
}) {
  const fileRef = useRef(null)

  return (
    <nav className="sidebar" aria-label="Main navigation">
      <div className="side-brand">🏢 My Office</div>

      <ul className="side-nav">
        {NAV.map((item) => (
          <li key={item.id}>
            <button
              className={`side-item ${view === item.id ? 'active' : ''}`}
              onClick={() => onView(item.id)}
            >
              <span className="side-icon">{item.icon}</span>
              <span>{item.label}</span>
              {counts?.[item.id] != null && counts[item.id] > 0 && (
                <span className="side-count">{counts[item.id]}</span>
              )}
            </button>
          </li>
        ))}
      </ul>

      <div className="side-footer">
        <button className="btn primary side-new" onClick={onNewTask} title="New task (N)">
          + New Task
        </button>
        <div className="side-links">
          <button className="side-link" onClick={onExport} title="Export board as JSON">
            ⇩ Export
          </button>
          <button className="side-link" onClick={() => fileRef.current?.click()} title="Import board from JSON">
            ⇧ Import
          </button>
          <input
            ref={fileRef}
            type="file"
            hidden
            accept="application/json"
            onChange={(e) => {
              onImport(e.target.files?.[0])
              e.target.value = ''
            }}
          />
          <button className="side-link" onClick={onReseed} title="Reload the 30-task CEO board">
            ↺ CEO board
          </button>
        </div>
      </div>
    </nav>
  )
}
