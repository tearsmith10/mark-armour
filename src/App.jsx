import { useEffect, useMemo, useRef, useState } from 'react'
import CardItem from './components/CardItem.jsx'
import AiPanel from './components/AiPanel.jsx'
import Login from './components/Login.jsx'
import Sidebar from './components/Sidebar.jsx'
import NewTaskModal from './components/NewTaskModal.jsx'
import TaskDetail from './components/TaskDetail.jsx'
import TodayView from './views/TodayView.jsx'
import CalendarView from './views/CalendarView.jsx'
import { ProjectsView, InboxView } from './views/OtherViews.jsx'
import { getSession, signOut } from './lib/auth.js'
import { loadBoard, saveBoard, boardKeyFor, uid, exportBoard, importBoard } from './lib/storage.js'
import { executiveBoard } from './lib/seed.js'
import { DEFAULT_MODEL, listModels, breakdownTask } from './lib/ai.js'
import { todayStr, headerDate } from './lib/dates.js'

const THEME_KEY = 'ceo-office-theme'
const getTheme = () => localStorage.getItem(THEME_KEY) || 'dark'

const VIEW_TITLES = {
  today: 'Today',
  board: 'Board',
  calendar: 'Calendar',
  projects: 'Projects',
  inbox: 'Inbox',
}

export default function App() {
  const [session, setSession] = useState(getSession)
  const [theme, setTheme] = useState(getTheme)
  const [lists, setLists] = useState(() =>
    session ? loadBoard(boardKeyFor(session.email)) : []
  )
  const [readyKey, setReadyKey] = useState(() =>
    session ? boardKeyFor(session.email) : null
  )
  const [model, setModel] = useState(DEFAULT_MODEL)
  const [models, setModels] = useState([])
  const [aiStatus, setAiStatus] = useState('checking…')
  const [aiBusy, setAiBusy] = useState(false)
  const [aiCards, setAiCards] = useState({}) // cardId -> busy
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all') // all | open | done | high
  const [catFilter, setCatFilter] = useState('all') // all | Meeting | Deal | Conference
  const [sortDue, setSortDue] = useState(false)
  const [newListTitle, setNewListTitle] = useState('')
  const [view, setView] = useState('today')
  const [aiOpen, setAiOpen] = useState(() => window.innerWidth > 1100)
  const [modalOpen, setModalOpen] = useState(false)
  const [activeCardId, setActiveCardId] = useState(null)
  const [dropTarget, setDropTarget] = useState(null)
  const searchRef = useRef(null)

  // Theme → document + persistence
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  // Per-account board: load when account changes, save only once loaded
  const boardKey = session ? boardKeyFor(session.email) : null
  useEffect(() => {
    if (!boardKey) {
      setReadyKey(null)
      return
    }
    setLists(loadBoard(boardKey))
    setReadyKey(boardKey)
  }, [boardKey])
  useEffect(() => {
    if (boardKey && boardKey === readyKey) saveBoard(boardKey, lists)
  }, [lists, boardKey, readyKey])

  useEffect(() => {
    listModels()
      .then((m) => {
        setModels(m)
        setAiStatus(m.length ? `connected (${m.length} model${m.length > 1 ? 's' : ''})` : 'running, no models pulled')
        if (m.length && !m.includes(model)) setModel(m[0])
      })
      .catch((e) => setAiStatus(`unreachable — ${e.message}`))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keyboard shortcuts: N=new, /=search, T=Today, B=Board, A=AI, Esc=close
  useEffect(() => {
    if (!session) return
    function onKey(e) {
      const t = e.target
      const typing =
        t &&
        (t.tagName === 'INPUT' ||
          t.tagName === 'TEXTAREA' ||
          t.tagName === 'SELECT' ||
          t.isContentEditable)
      if (e.key === 'Escape') {
        setModalOpen(false)
        setActiveCardId(null)
        if (typing) t.blur?.()
        return
      }
      if (typing || e.ctrlKey || e.metaKey || e.altKey) return
      switch (e.key.toLowerCase()) {
        case 'n':
          e.preventDefault()
          setModalOpen(true)
          break
        case '/':
          e.preventDefault()
          setView('board')
          searchRef.current?.focus()
          break
        case 't':
          setView('today')
          break
        case 'b':
          setView('board')
          break
        case 'a':
          setAiOpen((o) => !o)
          break
        default:
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [session])

  const boardSnapshot = useMemo(
    () =>
      lists
        .map(
          (l) =>
            `${l.title}:\n` +
            l.cards
              .map(
                (c) =>
                  ` - ${c.completed ? '[x]' : '[ ]'} [${c.category || 'Meeting'}] ${c.title} (priority ${c.priority}, due ${c.dueDate || 'none'})`
              )
              .join('\n')
        )
        .join('\n'),
    [lists]
  )

  // Flat view of every card (with its list) for Today / Calendar / Projects / Inbox
  const allCards = useMemo(
    () => lists.flatMap((l) => l.cards.map((c) => ({ ...c, listId: l.id, listTitle: l.title }))),
    [lists]
  )

  const searched = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return allCards
    return allCards.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        (c.description || '').toLowerCase().includes(q) ||
        (c.notes || '').toLowerCase().includes(q) ||
        (c.dueDate || '').includes(q) ||
        (c.tags || []).some((t) => t.toLowerCase().includes(q))
    )
  }, [allCards, search])

  const counts = useMemo(
    () => ({
      today: allCards.filter((c) => !c.completed && c.dueDate === todayStr()).length,
      calendar: allCards.filter((c) => !c.completed && c.dueDate).length,
      inbox: allCards.filter((c) => !c.completed && !c.dueDate).length,
    }),
    [allCards]
  )

  const activeCard = useMemo(() => {
    if (!activeCardId) return null
    for (const l of lists) {
      const c = l.cards.find((x) => x.id === activeCardId)
      if (c) return { card: c, listId: l.id }
    }
    return null
  }, [activeCardId, lists])

  function mutate(fn) {
    setLists((prev) => fn(structuredClone(prev)))
  }

  function logAct(c, text) {
    c.updatedAt = Date.now()
    // Seed cards have no activity array yet — start history with the creation event
    if (!Array.isArray(c.activity)) {
      c.activity = [{ at: c.createdAt || Date.now(), text: 'Created' }]
    }
    c.activity = [{ at: Date.now(), text }, ...c.activity]
  }

  function addCard(listId, data) {
    mutate((next) => {
      const list = next.find((l) => l.id === listId)
      if (!list) return next
      list.cards.unshift({
        id: uid(),
        title: data.title,
        description: data.description || '',
        category: data.category || 'Meeting',
        completed: false,
        priority: data.priority || 'medium',
        dueDate: data.dueDate || '',
        tags: data.tags || [],
        subtasks: [],
        notes: '',
        activity: [{ at: Date.now(), text: 'Created' }],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
      return next
    })
  }

  function updateCard(cardId, patch, logText) {
    mutate((next) => {
      const c = next.flatMap((l) => l.cards).find((x) => x.id === cardId)
      if (!c) return next
      Object.assign(c, patch)
      if (logText) logAct(c, logText)
      return next
    })
  }

  function toggleCard(cardId) {
    mutate((next) => {
      const c = next.flatMap((l) => l.cards).find((x) => x.id === cardId)
      if (!c) return next
      c.completed = !c.completed
      logAct(c, c.completed ? '✅ Marked complete' : '↩️ Reopened')
      return next
    })
  }

  function deleteCard(cardId) {
    mutate((next) => {
      const l = next.find((x) => x.cards.some((c) => c.id === cardId))
      if (l) l.cards = l.cards.filter((c) => c.id !== cardId)
      return next
    })
  }

  async function handleBreakdown(listId, card) {
    setAiCards((s) => ({ ...s, [card.id]: true }))
    try {
      const steps = await breakdownTask(card, model)
      mutate((next) => {
        const c = next.flatMap((l) => l.cards).find((x) => x.id === card.id)
        if (c) {
          c.subtasks = [...(c.subtasks || []), ...steps.map((t) => ({ id: uid(), title: t, done: false }))]
          logAct(c, `✨ AI added ${steps.length} subtasks`)
        }
        return next
      })
    } catch (e) {
      alert(`AI breakdown failed: ${e.message}`)
    } finally {
      setAiCards((s) => ({ ...s, [card.id]: false }))
    }
  }

  function visibleCards(cards) {
    const q = search.toLowerCase()
    const out = cards.filter((c) => {
      if (
        q &&
        !(
          c.title.toLowerCase().includes(q) ||
          (c.description || '').toLowerCase().includes(q) ||
          (c.dueDate || '').includes(q) ||
          (c.tags || []).some((t) => t.toLowerCase().includes(q))
        )
      )
        return false
      if (filter === 'open' && c.completed) return false
      if (filter === 'done' && !c.completed) return false
      if (filter === 'high' && c.priority !== 'high') return false
      if (catFilter !== 'all' && (c.category || 'Meeting') !== catFilter) return false
      return true
    })
    if (sortDue) out.sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'))
    return out
  }

  // Move a card to another list — used by drag & drop AND the ⇄ Move select
  function moveCard(cardId, fromListId, targetListId) {
    if (fromListId === targetListId) return
    mutate((next) => {
      const from = next.find((l) => l.id === fromListId)
      const to = next.find((l) => l.id === targetListId)
      if (!from || !to) return next
      const idx = from.cards.findIndex((c) => c.id === cardId)
      if (idx === -1) return next
      const [card] = from.cards.splice(idx, 1)
      logAct(card, `↗️ Moved to "${to.title}"`)
      to.cards.push(card)
      return next
    })
  }

  // Drag & drop (HTML5, no dependency)
  function onDropCard(e, targetListId) {
    e.preventDefault()
    setDropTarget(null)
    try {
      const payload = JSON.parse(e.dataTransfer.getData('text/plain'))
      moveCard(payload.cardId, payload.listId, targetListId)
    } catch {
      /* ignore malformed drops */
    }
  }

  function exportJson() {
    const blob = new Blob([exportBoard(lists)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'board-backup.json'
    a.click()
  }

  async function importJson(file) {
    if (!file) return
    try {
      setLists(importBoard(await file.text()))
    } catch {
      alert('Invalid backup file')
    }
  }

  const total = lists.reduce((n, l) => n + l.cards.length, 0)
  const done = lists.reduce((n, l) => n + l.cards.filter((c) => c.completed).length, 0)

  if (!session) {
    return (
      <Login
        onLogin={setSession}
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
      />
    )
  }

  return (
    <div className="app">
      <Sidebar
        view={view}
        onView={setView}
        counts={counts}
        onExport={exportJson}
        onImport={importJson}
        onReseed={() => {
          if (confirm('Replace the current board with the 30-task CEO executive board (Oct–Dec)?')) {
            setLists(executiveBoard())
          }
        }}
        onNewTask={() => setModalOpen(true)}
      />

      <div className="main-col">
        <header className="topbar">
          <div className="topbar-title">
            <h1>{VIEW_TITLES[view]}</h1>
            <span className="muted small">{headerDate()}</span>
          </div>

          <div className="search-wrap">
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tasks… (/)"
              className="search"
              aria-label="Search tasks"
            />
            {search && (
              <button className="icon-btn tiny search-clear" onClick={() => setSearch('')} title="Clear search">
                ×
              </button>
            )}
          </div>

          <div className="topbar-right">
            <button className="btn primary" onClick={() => setModalOpen(true)} title="New task (N)">
              + New Task <kbd>N</kbd>
            </button>
            <button
              className={`btn ${aiOpen ? 'gold' : ''}`}
              onClick={() => setAiOpen((o) => !o)}
              title="Toggle AI assistant (A)"
            >
              ✨ AI <kbd>A</kbd>
            </button>
            <button
              className="theme-toggle"
              onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
              title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            <span
              className={`status ${aiStatus.startsWith('connected') ? 'ok' : 'warn'}`}
              title="Ollama status"
            >
              ● {aiStatus}
            </span>
            <span className="user-chip" title={session.email}>
              <span className="avatar">{(session.name || '?').slice(0, 1).toUpperCase()}</span>
              <span className="user-name">{session.name}</span>
            </span>
            <button
              className="btn small"
              onClick={() => {
                signOut()
                setSession(null)
              }}
            >
              Sign out
            </button>
          </div>
        </header>

        <main className="content">
          {view === 'board' && (
            <>
              <div className="toolbar">
                <span className="muted small">
                  {done}/{total} done
                </span>
                <select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter by status">
                  <option value="all">All</option>
                  <option value="open">Open</option>
                  <option value="done">Completed</option>
                  <option value="high">High priority</option>
                </select>
                <select
                  value={catFilter}
                  onChange={(e) => setCatFilter(e.target.value)}
                  title="Filter by type"
                  aria-label="Filter by type"
                >
                  <option value="all">All types</option>
                  <option value="Meeting">Meetings</option>
                  <option value="Deal">Deals</option>
                  <option value="Conference">Conferences</option>
                  <option value="Review">Reviews</option>
                  <option value="Travel">Travel</option>
                </select>
                <button className="btn small" title="Sort cards by due date" onClick={() => setSortDue((v) => !v)}>
                  {sortDue ? '✓ By date' : 'Sort by date'}
                </button>
                {(search || filter !== 'all' || catFilter !== 'all' || sortDue) && (
                  <button
                    className="btn small"
                    onClick={() => {
                      setSearch('')
                      setFilter('all')
                      setCatFilter('all')
                      setSortDue(false)
                    }}
                  >
                    Clear
                  </button>
                )}
                <span className="muted small hint">drag cards between lists · press N for a new task</span>
              </div>

              <div className="board-wrap">
                <div className="board">
                  {lists.map((list) => {
                    const shown = visibleCards(list.cards)
                    return (
                      <section
                        key={list.id}
                        className={`list ${dropTarget === list.id ? 'drop-active' : ''}`}
                        onDragOver={(e) => {
                          e.preventDefault()
                          setDropTarget(list.id)
                        }}
                        onDragLeave={() => setDropTarget((t) => (t === list.id ? null : t))}
                        onDrop={(e) => onDropCard(e, list.id)}
                      >
                        <div className="list-head">
                          <strong>{list.title}</strong>
                          <span className="muted">{shown.length}</span>
                          <button
                            className="icon-btn"
                            title="Delete list"
                            onClick={() => {
                              if (
                                list.cards.length === 0 ||
                                confirm(`Delete "${list.title}" and its ${list.cards.length} task(s)?`)
                              ) {
                                mutate((n) => n.filter((l) => l.id !== list.id))
                              }
                            }}
                          >
                            ×
                          </button>
                        </div>

                        <AddCardForm onAdd={(title) => addCard(list.id, { title })} />

                        {list.cards.length === 0 ? (
                          <p className="empty-list">
                            No tasks yet — drag a card here or press <kbd>N</kbd>.
                          </p>
                        ) : shown.length === 0 ? (
                          <p className="empty-list">No tasks match the current filters.</p>
                        ) : (
                          shown.map((card) => (
                            <CardItem
                              key={card.id}
                              card={card}
                              lists={lists}
                              currentListId={list.id}
                              onOpen={() => setActiveCardId(card.id)}
                              onMove={(targetId) => moveCard(card.id, list.id, targetId)}
                              aiBusy={!!aiCards[card.id]}
                              onDragStart={(e) =>
                                e.dataTransfer.setData(
                                  'text/plain',
                                  JSON.stringify({ listId: list.id, cardId: card.id })
                                )
                              }
                              onToggle={() => toggleCard(card.id)}
                              onDelete={() => deleteCard(card.id)}
                              onAiBreakdown={() => handleBreakdown(list.id, card)}
                            />
                          ))
                        )}
                      </section>
                    )
                  })}

                  <div className="list new-list">
                    <input
                      value={newListTitle}
                      onChange={(e) => setNewListTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newListTitle.trim()) {
                          mutate((n) => [...n, { id: uid(), title: newListTitle.trim(), cards: [] }])
                          setNewListTitle('')
                        }
                      }}
                      placeholder="New list title…"
                    />
                    <button
                      className="btn"
                      onClick={() => {
                        if (!newListTitle.trim()) return
                        mutate((n) => [...n, { id: uid(), title: newListTitle.trim(), cards: [] }])
                        setNewListTitle('')
                      }}
                    >
                      + Add list
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}

          {view === 'today' && <TodayView cards={searched} onOpen={setActiveCardId} />}
          {view === 'calendar' && <CalendarView cards={searched} onOpen={setActiveCardId} />}
          {view === 'projects' && <ProjectsView cards={searched} onOpen={setActiveCardId} />}
          {view === 'inbox' && (
            <InboxView cards={searched} onOpen={setActiveCardId} onNewTask={() => setModalOpen(true)} />
          )}
        </main>

        <footer className="muted small">
          Signed in as <code>{session.email}</code> · boards saved per account in <code>localStorage</code> ·
          AI runs locally via Ollama — no cloud calls.
        </footer>
      </div>

      {aiOpen && (
        <AiPanel
          lists={lists}
          boardSnapshot={boardSnapshot}
          model={model}
          models={models}
          onModelChange={setModel}
          onCreateTask={(parsed) => addCard(lists[0]?.id, parsed)}
          busy={aiBusy}
          setBusy={setAiBusy}
        />
      )}

      {activeCard && (
        <TaskDetail
          card={activeCard.card}
          listId={activeCard.listId}
          lists={lists}
          onUpdate={updateCard}
          onToggle={() => toggleCard(activeCard.card.id)}
          onMove={(targetId) => moveCard(activeCard.card.id, activeCard.listId, targetId)}
          onDelete={() => deleteCard(activeCard.card.id)}
          onClose={() => setActiveCardId(null)}
        />
      )}

      {modalOpen && lists.length > 0 && (
        <NewTaskModal
          lists={lists}
          defaultListId={lists[0].id}
          model={model}
          onCreate={(listId, data) => {
            addCard(listId, data)
            setModalOpen(false)
          }}
          onClose={() => setModalOpen(false)}
          aiBusy={aiBusy}
          setAiBusy={setAiBusy}
        />
      )}
    </div>
  )
}

function AddCardForm({ onAdd }) {
  const [v, setV] = useState('')
  return (
    <form
      className="row add-card-form"
      onSubmit={(e) => {
        e.preventDefault()
        if (!v.trim()) return
        onAdd(v.trim())
        setV('')
      }}
    >
      <input value={v} onChange={(e) => setV(e.target.value)} placeholder="+ Add a card" />
      <button className="btn small" type="submit">
        Add
      </button>
    </form>
  )
}
