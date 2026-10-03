import { useState } from 'react'
import { signIn, signUp, googleContinue } from '../lib/auth.js'

export default function Login({ onLogin, theme, onToggleTheme }) {
  const [mode, setMode] = useState('signin') // 'signin' | 'signup'
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setErr('')
    setBusy(true)
    try {
      const user = mode === 'signup' ? await signUp(email, pw, name) : await signIn(email, pw)
      onLogin(user)
    } catch (ex) {
      setErr(ex.message)
    } finally {
      setBusy(false)
    }
  }

  async function google() {
    setErr('')
    setBusy(true)
    try {
      onLogin(await googleContinue())
    } catch (ex) {
      setErr(ex.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-wrap">
      <button
        className="theme-toggle auth-toggle"
        onClick={onToggleTheme}
        title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      >
        {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
      </button>

      <form className="auth-card" onSubmit={submit}>
        <div className="auth-logo">🏢 My Office</div>
        <p className="auth-sub">Your private executive task manager — sign in to continue</p>

        <div className="auth-tabs">
          <button
            type="button"
            className={mode === 'signin' ? 'tab active' : 'tab'}
            onClick={() => { setMode('signin'); setErr('') }}
          >
            Sign in
          </button>
          <button
            type="button"
            className={mode === 'signup' ? 'tab active' : 'tab'}
            onClick={() => { setMode('signup'); setErr('') }}
          >
            Sign up
          </button>
        </div>

        {mode === 'signup' && (
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name (optional)"
            autoComplete="name"
          />
        )}
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email address"
          autoComplete="email"
          required
        />
        <input
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder="Password (min 6 characters)"
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          required
        />

        {err && <div className="auth-err">⚠ {err}</div>}

        <button className="btn primary auth-submit" disabled={busy}>
          {busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Sign in'}
        </button>

        <div className="auth-divider"><span>or</span></div>

        <button type="button" className="google-btn" onClick={google} disabled={busy}>
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6.1C12.3 13.2 17.6 9.5 24 9.5z" />
            <path fill="#4285F4" d="M46.98 24.5c0-1.6-.15-3.2-.44-4.7H24v9.1h12.9c-.56 2.9-2.2 5.4-4.7 7.1l7.6 5.9c4.5-4.1 7.18-10.2 7.18-17.4z" />
            <path fill="#FBBC05" d="M10.4 28.7a14.5 14.5 0 0 1 0-9.4l-7.8-6.1a24 24 0 0 0 0 21.6l7.8-6.1z" />
            <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.8 2.3-8.3 2.3-6.4 0-11.7-3.7-13.6-9.9l-7.8 6.1C6.5 42.6 14.6 48 24 48z" />
          </svg>
          Continue with Google
        </button>

        <p className="auth-note">
          Local account — data stays in this browser only.
          <br />
          AI runs on your machine via Ollama. No cloud calls.
        </p>
      </form>
    </div>
  )
}
