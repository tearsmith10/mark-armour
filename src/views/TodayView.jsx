import { dueLabel, todayStr, isOverdue, headerDate } from '../lib/dates.js'

function Section({ title, icon, items, onOpen, empty }) {
  return (
    <section className="today-section">
      <h3>
        {icon} {title} <span className="section-count">{items.length}</span>
      </h3>
      {items.length === 0 ? (
        <p className="empty-mini">{empty}</p>
      ) : (
        <div className="today-list">
          {items.map((c) => (
            <button key={c.id} className={`today-card prio-${c.priority} ${c.completed ? 'done' : ''}`} onClick={() => onOpen(c.id)}>
              <span className="today-main">
                <span className="today-title">{c.title}</span>
                <span className="today-meta">
                  <span className={`pill ${c.priority}`}>{c.priority}</span>
                  <span className="pill cat">{c.category || 'Meeting'}</span>
                  <span className="pill">in {c.listTitle}</span>
                </span>
              </span>
              <span className="today-due">
                {c.dueDate ? (
                  <span className={`pill date ${dueLabel(c.dueDate).state}`}>
                    {dueLabel(c.dueDate).text}
                  </span>
                ) : (
                  <span className="pill date">no date</span>
                )}
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  )
}

export default function TodayView({ cards, onOpen }) {
  const today = todayStr()
  const seen = new Set()
  const take = (arr) => {
    const out = arr.filter((c) => !seen.has(c.id))
    out.forEach((c) => seen.add(c.id))
    return out
  }

  const overdue = take(cards.filter((c) => isOverdue(c)).sort((a, b) => a.dueDate.localeCompare(b.dueDate)))
  const dueToday = take(cards.filter((c) => c.dueDate === today))
  const high = take(
    cards.filter((c) => c.priority === 'high' && !c.completed).sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'))
  )
  const upcoming = take(
    cards
      .filter((c) => c.dueDate > today && !c.completed)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  )
  const completed = take(cards.filter((c) => c.completed).sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0)).slice(0, 8))

  const openCount = cards.filter((c) => !c.completed).length

  return (
    <div className="view today-view">
      <div className="view-hero">
        <div>
          <h2>Today</h2>
          <p className="muted">
            {headerDate()} · {openCount} open task{openCount === 1 ? '' : 's'}
          </p>
        </div>
      </div>

      <Section
        title="Overdue"
        icon="🚨"
        items={overdue}
        onOpen={onOpen}
        empty="Nothing overdue — you're on schedule."
      />
      <Section
        title="Today's tasks"
        icon="📍"
        items={dueToday}
        onOpen={onOpen}
        empty="Nothing due today. Enjoy the breathing room."
      />
      <Section
        title="High priority"
        icon="🔥"
        items={high}
        onOpen={onOpen}
        empty="No high-priority tasks open."
      />
      <Section
        title="Upcoming"
        icon="⏭"
        items={upcoming}
        onOpen={onOpen}
        empty="Nothing scheduled ahead."
      />
      <Section
        title="Completed"
        icon="✅"
        items={completed}
        onOpen={onOpen}
        empty="No completed tasks yet."
      />
    </div>
  )
}
