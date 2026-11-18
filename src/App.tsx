import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { Celebrations, celebrateBig } from './components/Celebrate'
import { PRSummary } from './components/PRSummary'
import { Toaster, toast } from './components/Toast'
import { useStore, type CompletedSession } from './lib/store'
import { HomeScreen } from './screens/HomeScreen'
import { fmtDur, SessionScreen } from './screens/SessionScreen'

export default function App() {
  const active = useStore((s) => s.active)
  const [view, setView] = useState<'home' | 'session'>(active ? 'session' : 'home')
  const [summary, setSummary] = useState<CompletedSession | null>(null)
  const [now, setNow] = useState(Date.now())

  useEffect(() => { if (!active && view === 'session') setView('home') }, [active, view])
  useEffect(() => { if (!active || view === 'session') return; const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t) }, [active, view])
  useEffect(() => { window.scrollTo({ top: 0 }) }, [view])

  return (
    <div className="app">
      <AnimatePresence mode="wait">
        {view === 'session' && active ? (
          <SessionScreen key="session" onMinimize={() => setView('home')}
            onFinished={(s, tpl) => {
              celebrateBig()
              if (s.prs?.length) setTimeout(() => setSummary(s), 450) // let the screen transition land first
              else toast(tpl ? 'Workout & template saved' : 'Workout saved')
              setView('home')
            }} />
        ) : (
          <HomeScreen key="home" onStart={() => setView('session')} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {active && view === 'home' && (
          <motion.button className="resume" onClick={() => setView('session')}
            initial={{ y: 100, x: '-50%' }} animate={{ y: 0, x: '-50%' }} exit={{ y: 100, x: '-50%' }} whileTap={{ scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 400, damping: 32 }}>
            <span className="resume-dot" />
            <span style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
              <span style={{ fontWeight: 700, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{active.name}</span>
              <span className="mono muted" style={{ fontSize: 12 }}>{fmtDur(now - active.startedAt)} · {active.exercises.length} exercise{active.exercises.length === 1 ? "" : "s"}</span>
            </span>
            <span className="btn btn-primary btn-sm">Resume</span>
          </motion.button>
        )}
      </AnimatePresence>

      <PRSummary session={summary} onClose={() => setSummary(null)} />
      <Celebrations />
      <Toaster />
    </div>
  )
}
