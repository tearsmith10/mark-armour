import { useState } from 'react'
import { todayStr, dueLabel } from '../lib/dates.js'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const pad = (n) => String(n).padStart(2, '0')

export default function CalendarView({ cards, onOpen }) {
  const now = new Date()
  const [cursor, setCursor] = useState({ y: now.getFullYear(), m: now.getMonth() })

  const first = new Date(cursor.y, cursor.m, 1)
  const startOffset = (first.getDay() + 6) % 7 // Monday-first grid
  const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate()
  const today = todayStr()

  const byDate = {}
  for (const c of cards) {
    if (!c.dueDate) continue
    ;(byDate[c.dueDate] ||= []).push(c)
  }

  const cells = []
  for (let i = 0; i < startOffset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${cursor.y}-${pad(cursor.m + 1)}-${pad(d)}`)
  }
  while (cells.length % 7 !== 0) cells.push(null)

  const shift = (delta) => {
    const d = new Date(cursor.y, cursor.m + delta, 1)
    setCursor({ y: d.getFullYear(), m: d.getMonth() })
  }

  return (
    <div className="view calendar-view">
      <div className="view-hero">
        <div>
          <h2>Calendar</h2>
          <p className="muted">{cards.filter((c) => c.dueDate && !c.completed).length} scheduled tasks</p>
        </div>
        <div className="cal-nav">
          <button className="btn small" onClick={() => shift(-1)} title="Previous month">
            ‹
          </button>
          <strong className="cal-title">
            {MONTHS[cursor.m]} {cursor.y}
          </strong>
          <button className="btn small" onClick={() => shift(1)} title="Next month">
            ›
          </button>
          <button
            className="btn small"
            onClick={() => setCursor({ y: now.getFullYear(), m: now.getMonth() })}
          >
            Today
          </button>
        </div>
      </div>

      <div className="cal-grid">
        {DOW.map((d) => (
          <div key={d} className="cal-dow">
            {d}
          </div>
        ))}
        {cells.map((iso, i) => {
          if (!iso) return <div key={`e${i}`} className="cal-cell empty" />
          const dayTasks = byDate[iso] || []
          const isToday = iso === today
          return (
            <div key={iso} className={`cal-cell ${isToday ? 'is-today' : ''}`}>
              <div className={`cal-daynum ${isToday ? 'today' : ''}`}>{Number(iso.slice(-2))}</div>
              <div className="cal-tasks">
                {dayTasks.slice(0, 3).map((c) => (
                  <button
                    key={c.id}
                    className={`cal-task prio-bar-${c.priority} ${c.completed ? 'done' : ''}`}
                    onClick={() => onOpen(c.id)}
                    title={`${c.title} — ${dueLabel(c.dueDate).text}`}
                  >
                    {c.completed ? '✓ ' : ''}
                    {c.title}
                  </button>
                ))}
                {dayTasks.length > 3 && (
                  <div className="cal-more muted">+{dayTasks.length - 3} more</div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
