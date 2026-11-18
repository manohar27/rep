import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { copyText, sessionToText, setText } from '../lib/exportLog'
import { isWarmup, prLabel, prTitle } from '../lib/records'
import { getExercise, haptic, useStore, volumeOf, workingSets, type CompletedSession } from '../lib/store'
import { fmtDur } from '../screens/SessionScreen'
import { Check, Copy } from './Icons'
import { PRChip } from './PRChip'
import { Sheet } from './Sheet'

const when = (t: number) => new Date(t).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })

// The workout summary card: shown right after finishing (`fresh`) and when opening a past workout.
export function SessionSummary({ session, fresh, onClose }: { session: CompletedSession | null; fresh?: boolean; onClose: () => void }) {
  const history = useStore((s) => s.history)
  const custom = useStore((s) => s.custom)
  const [copied, setCopied] = useState(false)
  useEffect(() => { setCopied(false) }, [session?.id])
  const prs = session?.prs ?? []

  const copy = async () => {
    if (!session) return
    const ok = await copyText(sessionToText(session, history, custom))
    haptic(ok ? [10, 30, 10] : 40)
    setCopied(ok)
    if (ok) setTimeout(() => setCopied(false), 2200)
  }

  return (
    <Sheet open={!!session} onClose={onClose}>
      {session && (
        <>
          <div className="sheet-head">
            <div style={{ minWidth: 0 }}>
              <motion.div className="sheet-title" initial={fresh ? { scale: 0.85, opacity: 0 } : false} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }}>
                {fresh ? (prs.length ? `Workout done · ${prs.length} PR${prs.length === 1 ? '' : 's'}` : 'Workout done') : session.name}
              </motion.div>
              <div className="muted" style={{ fontSize: 13 }}>{fresh ? `${session.name} · ` : ''}{when(session.startedAt)}</div>
            </div>
          </div>
          <div className="sheet-body">
            <div className="summary" style={{ marginTop: 0 }}>
              <div className="stat"><div className="stat-v">{fmtDur(session.finishedAt - session.startedAt)}</div><div className="stat-l">Time</div></div>
              <div className="stat"><div className="stat-v">{workingSets(session, false)}</div><div className="stat-l">Sets</div></div>
              <div className="stat"><div className="stat-v">{Math.round(volumeOf(session, false)).toLocaleString()}</div><div className="stat-l">kg</div></div>
            </div>

            {prs.length > 0 && (
              <div className="pr-list">
                {prs.map((p, i) => (
                  <motion.div key={`${p.exerciseId}-${p.setId ?? p.kind}`} className="pr-item"
                    initial={fresh ? { opacity: 0, x: -20 } : false} animate={{ opacity: 1, x: 0 }} transition={{ type: 'spring', stiffness: 450, damping: 30, delay: 0.15 + i * 0.07 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700 }}>{getExercise(p.exerciseId, custom).name}</div>
                      <div className="muted" style={{ fontSize: 13 }}>{prTitle(p)} · <span className="mono">{p.detail}</span></div>
                    </div>
                    <PRChip big label={prLabel(p)} delay={fresh ? 0.25 + i * 0.07 : 0} />
                  </motion.div>
                ))}
              </div>
            )}

            {session.exercises.map((se) => {
              const ex = getExercise(se.exerciseId, custom)
              const prIds = new Set(prs.map((p) => p.setId))
              return (
                <div key={se.id} className="past">
                  <div className="past-date"><span style={{ color: 'var(--text)', fontWeight: 600 }}>{ex.name}</span><span>{se.sets.filter((x) => !isWarmup(x)).length} sets</span></div>
                  <div className="past-sets">
                    {se.sets.map((x) => (
                      <span key={x.id} className={`past-set ${isWarmup(x) ? 'warm' : ''} ${prIds.has(x.id) ? 'pr' : ''}`}>
                        {isWarmup(x) ? 'W ' : x.type === 'failure' ? 'F ' : ''}{setText(x, ex).replace(' kg × ', '×').replace('bodyweight ', '')}
                      </span>
                    ))}
                  </div>
                </div>
              )
            })}

            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <motion.button whileTap={{ scale: 0.96 }} className="btn" style={{ flex: 1, height: 54 }} onClick={copy} aria-live="polite">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span key={copied ? 'y' : 'n'} style={{ display: 'inline-flex', gap: 8, alignItems: 'center', color: copied ? 'var(--accent)' : undefined }}
                    initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -10, opacity: 0, transition: { duration: 0.08 } }} transition={{ type: 'spring', stiffness: 700, damping: 34 }}>
                    {copied ? <><Check width={18} height={18} /> Copied</> : <><Copy /> Copy for AI</>}
                  </motion.span>
                </AnimatePresence>
              </motion.button>
              <motion.button whileTap={{ scale: 0.97 }} className="btn btn-primary" style={{ flex: 1, height: 54 }} onClick={onClose}>Done</motion.button>
            </div>
          </div>
        </>
      )}
    </Sheet>
  )
}
