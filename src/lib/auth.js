// Local-first auth: accounts live in this browser's localStorage only.
// Passwords are salted SHA-256 (Web Crypto) — never plaintext. This is a
// front-end demo auth; see README for wiring real Google OAuth.

const USERS_KEY = 'ceo-office-users-v1'
const SESSION_KEY = 'ceo-office-session-v1'

const normalize = (email) => (email || '').trim().toLowerCase()

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function readUsers() {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY)) || {}
  } catch {
    return {}
  }
}

function writeUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users))
}

function pub(user) {
  return { email: user.email, name: user.name, provider: user.provider, createdAt: user.createdAt }
}

export function getSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY))
  } catch {
    return null
  }
}

function setSession(user) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(pub(user)))
}

export function signOut() {
  localStorage.removeItem(SESSION_KEY)
}

export async function signUp(email, password, name) {
  const e = normalize(email)
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) throw new Error('Enter a valid email address.')
  if ((password || '').length < 6) throw new Error('Password must be at least 6 characters.')
  const users = readUsers()
  if (users[e]) throw new Error('An account with this email already exists — sign in instead.')
  const user = {
    email: e,
    name: (name || '').trim() || e.split('@')[0],
    pwHash: await sha256(`${password}:${e}`),
    provider: 'email',
    createdAt: Date.now(),
  }
  users[e] = user
  writeUsers(users)
  setSession(user)
  return pub(user)
}

export async function signIn(email, password) {
  const e = normalize(email)
  const user = readUsers()[e]
  if (!user) throw new Error('No account found for this email — sign up first.')
  const hash = await sha256(`${password}:${e}`)
  if (hash !== user.pwHash) throw new Error('Incorrect password. Try again.')
  setSession(user)
  return pub(user)
}

// "Continue with Google" — local demo session (provider: google).
// Replace with Google Identity Services when VITE_GOOGLE_CLIENT_ID is set (see README).
export async function googleContinue() {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
  const e = 'google.user@gmail.com'
  const users = readUsers()
  let user = users[e]
  if (!user) {
    user = {
      email: e,
      name: 'Google User',
      pwHash: await sha256(`google:${Date.now()}`),
      provider: 'google',
      createdAt: Date.now(),
      demo: !clientId,
    }
    users[e] = user
    writeUsers(users)
  }
  setSession(user)
  return pub(user)
}
