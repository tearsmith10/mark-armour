import { dueLabel } from '../lib/dates.js'

/** Projects = tasks grouped by tag/label. Inbox = unscheduled tasks (no due date). */

export function ProjectsView({ cards, onOpen }) {
  const groups = new Map()
  for (const c of cards) {
    const tags = c.tags?.length ? c.tags : ['untagged']
    for (const t of tags) {
      if (!groups.has(t)) groups.set(t, [])
      groups.get(t).push(c)
    }
  }
  const sorted = [...groups.entries()].sort((a, b) => b[1].length - a[1].length)

  return (
    <div className="view projects-view">
      <div className="view-hero">
        <div>
          <h2>Projects</h2>
          <p className="muted">Tasks grouped by label</p>
        </div>
      </div>

      {sorted.length === 0 ? (
        <p className="empty-state">No labels yet — add tags to tasks to group them into projects.</p>
      ) : (
        <div className="project-grid">
          {sorted.map(([tag, items]) => {
            const open = items.filter((c) => !c.completed).length
            return (
              <section key={tag} className="project-card">
                <header>
                  <strong>#{tag}</strong>
                  <span className="muted small">
                    {open} open · {items.length} total
                  </span>
                </header>
                <div className="project-tasks">
                  {items
                    .sort((a, b) => a.completed - b.completed)
                    .slice(0, 8)
                    .map((c) => (
                      <button
                        key={c.id}
                        className={`project-row ${c.completed ? 'done' : ''}`}
                        onClick={() => onOpen(c.id)}
                      >
                        <span className="proj-dot" data-prio={c.priority} />
                        <span className="proj-title">{c.title}</span>
                        {c.dueDate && (
                          <span className={`pill date ${dueLabel(c.dueDate).state}`}>
                            {dueLabel(c.dueDate).text}
                          </span>
                        )}
                      </button>
                    ))}
                  {items.length > 8 && <div className="muted small">+{items.length - 8} more…</div>}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function InboxView({ cards, onOpen, onNewTask }) {
  const items = cards
    .filter((c) => !c.dueDate)
    .sort((a, b) => b.createdAt - a.createdAt)

  return (
    <div className="view inbox-view">
      <div className="view-hero">
        <div>
          <h2>Inbox</h2>
          <p className="muted">Unscheduled tasks — capture now, schedule later</p>
        </div>
        <button className="btn primary" onClick={onNewTask}>
          + New Task
        </button>
      </div>

      {items.length === 0 ? (
        <p className="empty-state">
          Inbox zero. 🎯 Tasks created without a due date land here.
        </p>
      ) : (
        <div className="today-list">
          {items.map((c) => (
            <button
              key={c.id}
              className={`today-card prio-${c.priority} ${c.completed ? 'done' : ''}`}
              onClick={() => onOpen(c.id)}
            >
              <span className="today-main">
                <span className="today-title">{c.title}</span>
                <span className="today-meta">
                  <span className={`pill ${c.priority}`}>{c.priority}</span>
                  <span className="pill cat">{c.category || 'Meeting'}</span>
                  {(c.tags || []).map((t) => (
                    <span key={t} className="pill tag">
                      #{t}
                    </span>
                  ))}
                </span>
              </span>
              <span className="today-due">
                <span className="pill date">no date</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
