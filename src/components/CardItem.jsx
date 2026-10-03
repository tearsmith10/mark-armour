import { dueLabel, isOverdue } from '../lib/dates.js'

/**
 * Compact Kanban card — title-first design.
 * Click title/card → open details panel. Drag to move, or use ⇄ Move select.
 */
export default function CardItem({
  card,
  lists,
  currentListId,
  onOpen,
  onMove,
  onToggle,
  onDelete,
  onDragStart,
  aiBusy,
  onAiBreakdown,
}) {
  const due = dueLabel(card.dueDate)
  const overdue = isOverdue(card)
  const doneCount = card.subtasks?.filter((s) => s.done).length || 0
  const totalCount = card.subtasks?.length || 0
  const tags = card.tags || []

  return (
    <article
      draggable
      onDragStart={onDragStart}
      className={`card ${card.completed ? 'done' : ''} ${overdue ? 'overdue' : ''} prio-${card.priority}`}
      onClick={onOpen}
      title="Click to open details"
    >
      <div className="card-top">
        <input
          type="checkbox"
          checked={!!card.completed}
          onChange={(e) => {
            e.stopPropagation()
            onToggle()
          }}
          onClick={(e) => e.stopPropagation()}
          title="Toggle completion"
        />
        <h4 className="card-title">{card.title}</h4>
        <button
          className="icon-btn card-del"
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          title="Delete task"
        >
          ×
        </button>
      </div>

      <div className="card-meta">
        {due && (
          <span className={`pill date ${due.state}`}>
            📅 {due.text}
          </span>
        )}
        <span className={`pill ${card.priority}`}>{card.priority}</span>
        <span className={`pill ${card.completed ? 'status-done' : ''}`}>
          {card.completed ? '✓ done' : 'open'}
        </span>
        <span className="pill cat">{card.category || 'Meeting'}</span>
        {totalCount > 0 && (
          <span className="pill subtasks">
            ☑ {doneCount}/{totalCount}
          </span>
        )}
        {tags.slice(0, 2).map((t) => (
          <span key={t} className="pill tag">
            #{t}
          </span>
        ))}
        {tags.length > 2 && <span className="pill tag">+{tags.length - 2}</span>}
      </div>

      <div className="card-actions" onClick={(e) => e.stopPropagation()}>
        <select
          className="move-select"
          value=""
          onChange={(e) => e.target.value && onMove(e.target.value)}
          title="Move this card to another list"
          aria-label="Move card to list"
        >
          <option value="" disabled>
            ⇄ Move to…
          </option>
          {lists
            .filter((l) => l.id !== currentListId)
            .map((l) => (
              <option key={l.id} value={l.id}>
                {l.title}
              </option>
            ))}
        </select>
        {onAiBreakdown && (
          <button
            className="icon-btn tiny"
            disabled={aiBusy}
            onClick={onAiBreakdown}
            title="✨ Break into subtasks with local AI"
          >
            {aiBusy ? '…' : '✨'}
          </button>
        )}
      </div>
    </article>
  )
}
