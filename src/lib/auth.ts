import { create } from 'zustand'

// Auth gates server features (sync, AI) and locks the UI when the server can be reached.
// Workout data stays local, so if the server is unreachable or has no database yet, the app
// opens anyway — offline-first beats a lock screen you can't get past.

export type Phase = 'checking' | 'setup' | 'locked' | 'open'
const KEY = 'rep-auth-open' // remembers the last verified state so returning users skip any flash

const remembered = () => { try { return localStorage.getItem(KEY) === '1' } catch { return false } }
const remember = (open: boolean) => { try { open ? localStorage.setItem(KEY, '1') : localStorage.removeItem(KEY) } catch { /* noop */ } }

export const useAuth = create<{ phase: Phase }>(() => ({ phase: remembered() ? 'open' : 'checking' }))
const setPhase = (phase: Phase) => { useAuth.setState({ phase }); remember(phase === 'open') }

async function api(path: string, body?: unknown) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 6000)
  try {
    const res = await fetch(`/api/auth/${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: ctrl.signal,
    })
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
    return { status: res.status, data }
  } finally {
    clearTimeout(t)
  }
}

export async function checkAuth() {
  try {
    const { status, data } = await api('status')
    // No database yet, server error, or no API at all (e.g. HTML fallback): don't block local use.
    if (status !== 200 || typeof data.configured !== 'boolean') return setPhase('open')
    setPhase(!data.configured ? 'setup' : data.authenticated ? 'open' : 'locked')
  } catch {
    setPhase('open') // offline
  }
}

export type AuthResult = { ok: true } | { ok: false; error: 'wrong' | 'weak' | 'locked' | 'invalid' | 'taken' | 'network'; remaining?: number; retryAfter?: number }

async function submit(path: 'setup' | 'login', passcode: string): Promise<AuthResult> {
  try {
    const { status, data } = await api(path, { passcode })
    if (status === 200) return { ok: true } // caller opens the app after its success animation
    if (status === 429) return { ok: false, error: 'locked', retryAfter: Number(data.retryAfter) || 900 }
    if (status === 409) { void checkAuth(); return { ok: false, error: 'taken' } }
    if (data.error === 'weak') return { ok: false, error: 'weak' }
    if (data.error === 'wrong') return { ok: false, error: 'wrong', remaining: Number(data.remaining) }
    return { ok: false, error: status === 400 ? 'invalid' : 'network' }
  } catch {
    return { ok: false, error: 'network' }
  }
}

export const openApp = () => setPhase('open')

export const createPasscode = (p: string) => submit('setup', p)
export const unlock = (p: string) => submit('login', p)

// Returns false when the server can't be reached: locking offline would strand the user.
export async function lock() {
  try {
    const { status } = await api('logout', {})
    if (status !== 200) return false
    setPhase('locked')
    return true
  } catch {
    return false
  }
}
