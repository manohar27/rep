import { AnimatePresence, motion, useAnimationControls } from 'framer-motion'
import { useCallback, useEffect, useRef, useState } from 'react'
import { isWeak } from '../../shared/passcode'
import { checkSetupKey, createPasscode, openApp, unlock, useAuth, type AuthResult } from '../lib/auth'
import { haptic } from '../lib/store'
import { Backspace } from './Icons'
import { Wordmark } from './Wordmark'

type Step = 'key' | 'create' | 'confirm' | 'enter'
const LEN = 6
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'] as const
const SPRING = { type: 'spring', stiffness: 500, damping: 32 } as const

const mins = (s: number) => Math.max(1, Math.ceil(s / 60))
const tries = (n?: number) => (n === 1 ? '1 try left' : `${n ?? 0} tries left`)

export function LockScreen({ mode }: { mode: 'setup' | 'locked' }) {
  const notice = useAuth((s) => s.notice)
  const [step, setStep] = useState<Step>(mode === 'setup' ? 'key' : 'enter')
  const [code, setCode] = useState('')
  const [first, setFirst] = useState('')
  const [setupKey, setSetupKey] = useState('')
  const [msg, setMsg] = useState<string | null>(notice)
  const [busy, setBusy] = useState(false)
  const [success, setSuccess] = useState(false)
  const [lockedUntil, setLockedUntil] = useState(0)
  const [now, setNow] = useState(Date.now())
  const dots = useAnimationControls()

  // Switching mode (e.g. the server says a passcode was reset) restarts the flow but keeps the
  // server's notice so the user knows why.
  useEffect(() => { setStep(mode === 'setup' ? 'key' : 'enter'); setCode(''); setFirst(''); setMsg(useAuth.getState().notice) }, [mode])

  useEffect(() => {
    if (!lockedUntil) return
    const t = setInterval(() => {
      setNow(Date.now())
      if (Date.now() >= lockedUntil) { setLockedUntil(0); setMsg(null) }
    }, 1000)
    return () => clearInterval(t)
  }, [lockedUntil])
  const locked = lockedUntil > now

  const reject = useCallback((m: string) => {
    haptic([30, 50, 30])
    setMsg(m)
    // Keyframe shake: a gesture a single spring can't express (CLAUDE.md allows these).
    void dots.start({ x: [0, -12, 12, -9, 9, -4, 4, 0], transition: { duration: 0.45 } })
    setTimeout(() => setCode(''), 250)
  }, [dots])

  const fail = useCallback((r: Extract<AuthResult, { ok: false }>) => {
    if (r.error === 'wrong') return reject(`Wrong passcode · ${tries(r.remaining)}`)
    if (r.error === 'bad_key') { setStep('key'); return reject(`Wrong setup key · ${tries(r.remaining)}`) }
    if (r.error === 'locked') {
      setLockedUntil(Date.now() + (r.retryAfter ?? 900) * 1000); setNow(Date.now())
      return reject(r.global ? 'Sign-in paused after many failed attempts' : 'Too many attempts')
    }
    if (r.error === 'weak') { setStep('create'); setFirst(''); return reject('Too easy to guess — try another') }
    if (r.error === 'reset' || r.error === 'taken') return // checkAuth switches mode and supplies the notice
    if (r.error === 'invalid') return reject('Enter all 6 digits')
    if (r.error === 'server') return reject('Server problem — try again shortly')
    reject("Can't reach the server — check your connection")
  }, [reject])

  const done = useCallback(() => { setSuccess(true); haptic([10, 40, 10, 40, 30]); setTimeout(openApp, 520) }, [])

  const submitCode = useCallback(async (full: string) => {
    if (step === 'create') {
      if (isWeak(full)) return reject('Too easy to guess — try another')
      setFirst(full); setCode(''); setMsg(null); setStep('confirm'); haptic(8)
      return
    }
    if (step === 'confirm' && full !== first) { setStep('create'); setFirst(''); return reject("Codes didn't match — start again") }
    setBusy(true)
    const r = step === 'enter' ? await unlock(full) : await createPasscode(setupKey, full)
    setBusy(false)
    if (r.ok) done()
    else fail(r)
  }, [step, first, setupKey, reject, done, fail])

  // The 6th digit triggers submit from an effect, never from inside a state updater (updaters can
  // run twice under StrictMode/concurrent rendering, which would double-submit).
  const submitted = useRef('')
  useEffect(() => {
    if (code.length < LEN) { submitted.current = ''; return }
    if (submitted.current === code) return
    submitted.current = code
    const t = setTimeout(() => void submitCode(code), 120) // let the last dot land
    return () => clearTimeout(t)
  }, [code, submitCode])

  const press = useCallback((k: string) => {
    if (busy || success || locked || step === 'key') return
    if (k === 'del') { haptic(4); setCode((c) => c.slice(0, -1)); return }
    if (!/^\d$/.test(k)) return
    haptic(6)
    setMsg(null)
    setCode((c) => (c.length >= LEN ? c : c + k))
  }, [busy, success, locked, step])

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

  const submitKey = async () => {
    if (!setupKey.trim() || busy || locked) return
    setBusy(true)
    const r = await checkSetupKey(setupKey.trim())
    setBusy(false)
    if (r.ok) { haptic(8); setMsg(null); setStep('create') }
    else fail(r)
  }

  const title = { key: 'Set up rep', create: 'Create a passcode', confirm: 'Confirm passcode', enter: 'Enter passcode' }[step]
  const sub = locked ? `${msg ?? 'Too many attempts'} · try again in ${mins((lockedUntil - now) / 1000)} min`
    : msg ?? { key: 'Enter the setup key you saved in Vercel', create: '6 digits. Protects sync and AI features.', confirm: 'Enter it once more', enter: 'Welcome back' }[step]

  return (
    <motion.div className="lock" role="dialog" aria-modal="true" aria-label={title}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 1.04, transition: SPRING }}>
      <div className="lock-top">
        <Wordmark size={28} />
        <motion.div key={step} className="lock-title" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={SPRING}>{title}</motion.div>
        <div className={`lock-sub ${msg || locked ? 'err' : ''}`} aria-live="polite">{sub}</div>
        {step !== 'key' && (
          <motion.div className="lock-dots" animate={dots}>
            {Array.from({ length: LEN }, (_, i) => {
              const filled = i < code.length || success
              return (
                <motion.span key={i} className={`lock-dot ${filled ? 'on' : ''} ${success ? 'ok' : ''}`}
                  initial={false} animate={{ scale: success ? 1.25 : 1 }}
                  transition={{ type: 'spring', stiffness: 600, damping: 30, delay: success ? i * 0.05 : 0 }} />
              )
            })}
          </motion.div>
        )}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {step === 'key' ? (
          <motion.form key="key" className="lock-keyform" onSubmit={(e) => { e.preventDefault(); void submitKey() }}
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={SPRING}>
            <motion.input animate={dots} className="lock-keyinput" type="password" autoComplete="off" autoFocus placeholder="Setup key"
              value={setupKey} onChange={(e) => { setSetupKey(e.target.value); setMsg(null) }} disabled={locked} aria-label="Setup key" />
            <motion.button whileTap={{ scale: 0.97 }} className="btn btn-primary btn-block" style={{ height: 54 }} disabled={!setupKey.trim() || busy || locked}>
              Continue
            </motion.button>
          </motion.form>
        ) : (
          <motion.div key="pad" className="lock-pad" aria-disabled={busy || locked}
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={SPRING}>
            {KEYS.map((k, i) => k === '' ? <span key={i} /> : (
              <motion.button key={i} className={`lock-key ${k === 'del' ? 'del' : ''}`} whileTap={{ scale: 0.88 }}
                onClick={() => press(k)} disabled={locked || busy} aria-label={k === 'del' ? 'Delete' : k}>
                {k === 'del' ? <Backspace /> : k}
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
