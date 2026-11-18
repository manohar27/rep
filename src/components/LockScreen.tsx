import { motion, useAnimationControls } from 'framer-motion'
import { useCallback, useEffect, useRef, useState } from 'react'
import { isWeak } from '../../shared/passcode'
import { createPasscode, openApp, unlock, type AuthResult } from '../lib/auth'
import { haptic } from '../lib/store'

type Step = 'enter' | 'create' | 'confirm'
const LEN = 6
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'] as const

const mins = (s: number) => Math.max(1, Math.ceil(s / 60))

export function LockScreen({ mode }: { mode: 'setup' | 'locked' }) {
  const [step, setStep] = useState<Step>(mode === 'setup' ? 'create' : 'enter')
  const [code, setCode] = useState('')
  const [first, setFirst] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [success, setSuccess] = useState(false)
  const [lockedUntil, setLockedUntil] = useState(0)
  const [now, setNow] = useState(Date.now())
  const dots = useAnimationControls()

  useEffect(() => { setStep(mode === 'setup' ? 'create' : 'enter'); setCode(''); setFirst(''); setMsg(null) }, [mode])
  useEffect(() => {
    if (!lockedUntil) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [lockedUntil])
  const locked = lockedUntil > now

  const reject = useCallback((m: string) => {
    haptic([30, 50, 30])
    setMsg(m)
    void dots.start({ x: [0, -12, 12, -9, 9, -4, 4, 0], transition: { duration: 0.45 } })
    setTimeout(() => setCode(''), 250)
  }, [dots])

  const handle = useCallback(async (full: string) => {
    if (step === 'create') {
      if (isWeak(full)) return reject('Too easy to guess — try another')
      setFirst(full); setCode(''); setMsg(null); setStep('confirm'); haptic(8)
      return
    }
    if (step === 'confirm' && full !== first) {
      setStep('create'); setFirst('')
      return reject("Codes didn't match — start again")
    }
    setBusy(true)
    const r: AuthResult = step === 'enter' ? await unlock(full) : await createPasscode(full)
    setBusy(false)
    if (r.ok) { setSuccess(true); haptic([10, 40, 10, 40, 30]); setTimeout(openApp, 520); return }
    if (r.error === 'wrong') return reject(r.remaining === 1 ? 'Wrong passcode · 1 try left' : `Wrong passcode · ${r.remaining} tries left`)
    if (r.error === 'locked') { setLockedUntil(Date.now() + (r.retryAfter ?? 900) * 1000); setNow(Date.now()); return reject('Too many attempts') }
    if (r.error === 'weak') { setStep('create'); setFirst(''); return reject('Too easy to guess — try another') }
    if (r.error === 'taken') return reject('A passcode is already set — enter it')
    reject("Can't reach the server — check your connection")
  }, [step, first, reject])

  const press = useCallback((k: string) => {
    if (busy || success || locked) return
    if (k === 'del') { haptic(4); setCode((c) => c.slice(0, -1)); return }
    if (!/^\d$/.test(k)) return
    haptic(6)
    setMsg(null)
    setCode((c) => {
      if (c.length >= LEN) return c
      const next = c + k
      if (next.length === LEN) setTimeout(() => void handle(next), 120) // let the last dot land
      return next
    })
  }, [busy, success, locked, handle])

  // Physical keyboard support (desktop, or phones with a hardware keyboard).
  const pressRef = useRef(press)
  pressRef.current = press
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) pressRef.current(e.key)
      else if (e.key === 'Backspace') pressRef.current('del')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const title = step === 'create' ? 'Create a passcode' : step === 'confirm' ? 'Confirm passcode' : 'Enter passcode'
  const sub = locked ? `Too many attempts · try again in ${mins((lockedUntil - now) / 1000)} min`
    : msg ?? (step === 'create' ? '6 digits. Protects sync and AI features.' : step === 'confirm' ? 'Enter it once more' : 'Welcome back')

  return (
    <motion.div className="lock" role="dialog" aria-modal="true" aria-label={title}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 1.04, transition: { duration: 0.35 } }}>
      <div className="lock-top">
        <div className="h1" style={{ fontSize: 28 }}>rep<span style={{ color: 'var(--accent)' }}>.</span></div>
        <motion.div key={step} className="lock-title" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 500, damping: 32 }}>{title}</motion.div>
        <div className={`lock-sub ${msg || locked ? 'err' : ''}`} aria-live="polite">{sub}</div>
        <motion.div className="lock-dots" animate={dots}>
          {Array.from({ length: LEN }, (_, i) => {
            const filled = i < code.length || success
            return (
              <motion.span key={i} className={`lock-dot ${filled ? 'on' : ''} ${success ? 'ok' : ''}`}
                animate={success ? { scale: [1, 1.35, 1] } : { scale: filled ? [1, 1.3, 1] : 1 }}
                transition={success ? { delay: i * 0.05, duration: 0.3 } : { type: 'spring', stiffness: 600, damping: 30 }} />
            )
          })}
        </motion.div>
      </div>
      <div className="lock-pad" aria-disabled={busy || locked}>
        {KEYS.map((k, i) => k === '' ? <span key={i} /> : (
          <motion.button key={i} className={`lock-key ${k === 'del' ? 'del' : ''}`} whileTap={{ scale: 0.88 }}
            onClick={() => press(k)} disabled={locked || busy} aria-label={k === 'del' ? 'Delete' : k}>
            {k === 'del' ? (
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 5H9l-6 7 6 7h12a1 1 0 001-1V6a1 1 0 00-1-1zM17 9l-5 6M12 9l5 6" /></svg>
            ) : k}
          </motion.button>
        ))}
      </div>
    </motion.div>
  )
}
