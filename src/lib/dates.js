// Small date helpers shared by cards, Today view and Calendar.

const pad = (n) => String(n).padStart(2, '0')

export const todayStr = () => {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function fmtDate(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  return `${MONTHS[m - 1]} ${d}`
}

export function fmtDateLong(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  return `${DAYS[new Date(y, m - 1, d).getDay()]}, ${MONTHS[m - 1]} ${d}, ${y}`
}

/** Whole days between two YYYY-MM-DD strings (positive if b is later). */
export function daysBetween(a, b) {
  const [ay, am, ad] = a.split('-').map(Number)
  const [by, bm, bd] = b.split('-').map(Number)
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000)
}

/** Short due label: Overdue / Today / Tomorrow / In 4d / Oct 15 */
export function dueLabel(iso) {
  if (!iso) return null
  const diff = daysBetween(todayStr(), iso)
  if (diff < 0) return { text: `${-diff}d overdue`, state: 'overdue' }
  if (diff === 0) return { text: 'Today', state: 'soon' }
  if (diff === 1) return { text: 'Tomorrow', state: 'soon' }
  if (diff <= 7) return { text: `In ${diff}d`, state: 'soon' }
  return { text: fmtDate(iso), state: 'future' }
}

export function isOverdue(card) {
  return !!card.dueDate && !card.completed && card.dueDate < todayStr()
}

export function headerDate() {
  const d = new Date()
  return `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`
}
