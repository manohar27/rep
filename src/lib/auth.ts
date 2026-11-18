import { create } from 'zustand'

// Auth gates server features (sync, AI) and locks the UI when the server can be reached.
// Workout data stays local, so if the server is unreachable, has no database, or setup isn't
// enabled yet, the app opens anyway — offline-first beats a lock screen you can't get past.

export type Phase = 'checking' | 'setup' | 'locked' | 'open'
const KEY = 'rep-auth-open' // remembers the last verified state so returning users skip any flash

const remembered = () => { try { return localStorage.getItem(KEY) === '1' } catch { return false } }
const remember = (open: boolean) => { try { open ? localStorage.setItem(KEY, '1') : localStorage.removeItem(KEY) } catch { /* noop */ } }

interface AuthState {
  phase: Phase
  available: boolean // the server has auth configured: show the Lock button
  notice: string | null // one-off message for the lock screen (e.g. after a passcode reset)
}
export const useAuth = create<AuthState>(() => ({ phase: remembered() ? 'open' : 'checking', available: false, notice: null }))
const setPhase = (phase: Phase, extra: Partial<AuthState> = {}) => { useAuth.setState({ phase, ...extra }); remember(phase === 'open') }

async function api(path: string, body?: unknown, timeoutMs = 6000) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
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

export async function checkAuth(notice: string | null = null) {
  try {
    // Short timeout: on a stalled gym connection, open the app rather than show a blank screen.
    const { status, data } = await api('status', undefined, 3000)
    // No database yet, server error, or no API at all (e.g. HTML fallback): don't block local use.
    if (status !== 200 || typeof data.configured !== 'boolean') return setPhase('open', { available: false })
    if (!data.configured) return setPhase(data.setup ? 'setup' : 'open', { available: false, notice })
    setPhase(data.authenticated ? 'open' : 'locked', { available: true, notice })
  } catch {
    setPhase('open', { available: useAuth.getState().available }) // offline
  }
}

export type AuthError = 'wrong' | 'bad_key' | 'weak' | 'locked' | 'invalid' | 'taken' | 'reset' | 'network'
export type AuthResult = { ok: true } | { ok: false; error: AuthError; remaining?: number; retryAfter?: number; global?: boolean }

async function submit(path: 'setup' | 'login', body: Record<string, string>): Promise<AuthResult> {
  try {
    const { status, data } = await api(path, body)
    if (status === 200) return { ok: true } // caller opens the app after its success animation
    if (status === 429) return { ok: false, error: 'locked', retryAfter: Number(data.retryAfter) || 900, global: !!data.global }
    if (data.error === 'not_configured') { void checkAuth('Passcode was reset — create a new one'); return { ok: false, error: 'reset' } }
    if (status === 409) { void checkAuth('A passcode is already set — enter it'); return { ok: false, error: 'taken' } }
    if (data.error === 'wrong' || data.error === 'bad_key') return { ok: false, error: data.error, remaining: Number(data.remaining) }
    if (data.error === 'weak') return { ok: false, error: 'weak' }
    return { ok: false, error: status === 400 ? 'invalid' : 'network' }
  } catch {
    return { ok: false, error: 'network' }
  }
}

export const openApp = () => setPhase('open', { available: true, notice: null })
export const checkSetupKey = (setupKey: string) => submit('setup', { setupKey })
export const createPasscode = (setupKey: string, passcode: string) => submit('setup', { setupKey, passcode })
export const unlock = (passcode: string) => submit('login', { passcode })

export type LockResult = 'locked' | 'offline' | 'unavailable'
export async function lock(): Promise<LockResult> {
  try {
    const { status } = await api('logout', {})
    if (status !== 200) return 'unavailable'
    setPhase('locked', { notice: null })
    return 'locked'
  } catch {
    return 'offline' // locking offline would strand the user behind a screen they can't pass
  }
}
