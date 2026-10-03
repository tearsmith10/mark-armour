import { executiveBoard } from './seed.js'

export const uid = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`

// Boards are namespaced per signed-in account (login page → src/lib/auth.js).
export const boardKeyFor = (accountId) => `ceo-office-board-${accountId}-v1`

export function defaultBoard() {
  return executiveBoard()
}

export function loadBoard(key) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return defaultBoard()
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return defaultBoard()
    return parsed
  } catch {
    return defaultBoard()
  }
}

export function saveBoard(key, lists) {
  try {
    localStorage.setItem(key, JSON.stringify(lists))
  } catch (e) {
    console.warn('localStorage save failed:', e)
  }
}

export function exportBoard(lists) {
  return JSON.stringify({ exportedAt: new Date().toISOString(), lists }, null, 2)
}

export function importBoard(jsonText) {
  const parsed = JSON.parse(jsonText)
  const lists = Array.isArray(parsed) ? parsed : parsed.lists
  if (!Array.isArray(lists)) throw new Error('Invalid board file')
  return lists
}
