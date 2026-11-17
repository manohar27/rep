import { AnimatePresence, LayoutGroup, motion } from 'framer-motion'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ExerciseCard } from '../components/ExerciseCard'
import { ExercisePicker } from '../components/ExercisePicker'
import { Bookmark, Down, Dumbbell, Plus, Trash } from '../components/Icons'
import { RestTimer } from '../components/RestTimer'
import { Sheet } from '../components/Sheet'
import { Ticker } from '../components/Ticker'
import { toast } from '../components/Toast'
import { haptic, useStore, volumeOf, type CompletedSession } from '../lib/store'

const REST = 90

export const fmtDur = (ms: number) => {
  const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`
}

export function SessionScreen({ onMinimize, onFinished }: { onMinimize: () => void; onFinished: (s: CompletedSession, savedTemplate: boolean) => void }) {
  // Keep the last live session so the exit animation can render after finish/discard clears it.
  const live = useStore((s) => s.active)
  const last = useRef(live)
  if (live) last.current = live
  const active = last.current!
  const { renameSession, addExercises, discard, finish, saveTemplate } = useStore.getState()
  const [picker, setPicker] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [savingTpl, setSavingTpl] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [now, setNow] = useState(Date.now())
  const [rest, setRest] = useState<{ endsAt: number; total: number } | null>(null)

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t) }, [])

  const doneSets = active.exercises.reduce((a, e) => a + e.sets.filter((s) => s.done).length, 0)
  const volume = volumeOf(active)
  const onSetDone = useCallback(() => setRest({ endsAt: Date.now() + REST * 1000, total: REST }), [])
  const closeRest = useCallback(() => setRest(null), [])

  return (
    <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 30 }}>
      <div className="s-head">
        <button className="icon-btn" onClick={onMinimize} aria-label="Minimize"><Down /></button>
        <input className="s-name" value={active.name} onChange={(e) => renameSession(e.target.value)} aria-label="Session name" />
        <motion.button whileTap={{ scale: 0.94 }} className="btn btn-primary btn-sm" onClick={() => { haptic(8); setFinishing(true) }}>Finish</motion.button>
      </div>
      <div className="s-stats">
        <div className="stat"><div className="stat-v">{fmtDur(now - active.startedAt)}</div><div className="stat-l">Time</div></div>
        <div className="stat"><div className="stat-v"><Ticker value={volume} /><span className="muted" style={{ fontSize: 12 }}> kg</span></div><div className="stat-l">Volume</div></div>
        <div className="stat"><div className="stat-v"><Ticker value={doneSets} /></div><div className="stat-l">Sets</div></div>
      </div>

      <div className="s-body">
        {active.exercises.length === 0 && (
          <motion.div className="s-empty" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
            <motion.div className="s-empty-ico" animate={{ rotate: [0, -12, 12, -6, 0] }} transition={{ duration: 1.2, delay: 0.3, repeat: Infinity, repeatDelay: 3 }}><Dumbbell width={32} height={32} /></motion.div>
            <div style={{ fontWeight: 800, fontSize: 20, letterSpacing: '-0.02em' }}>Empty session</div>
            <div className="muted" style={{ marginTop: 4 }}>Add your first exercise to get going.</div>
          </motion.div>
        )}
        <LayoutGroup>
          <AnimatePresence initial={false}>
            {active.exercises.map((se, i) => (
              <ExerciseCard key={se.id} se={se} index={i} total={active.exercises.length} onSetDone={onSetDone} />
            ))}
          </AnimatePresence>
          <motion.button layout whileTap={{ scale: 0.97 }} className="add-ex" onClick={() => { haptic(6); setPicker(true) }}>
            <Plus /> Add exercises
          </motion.button>
          <motion.div layout style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button className="btn btn-sm" style={{ flex: 1 }} disabled={!active.exercises.length} onClick={() => setSavingTpl(true)}><Bookmark /> Save as template</button>
            <button className="btn btn-sm btn-danger" style={{ flex: 1 }} onClick={() => setConfirmDiscard(true)}><Trash /> Discard</button>
          </motion.div>
        </LayoutGroup>
      </div>

      <RestTimer endsAt={rest?.endsAt ?? null} total={rest?.total ?? REST} onChange={(endsAt, total) => setRest({ endsAt, total })} onClose={closeRest} />

      <ExercisePicker open={picker} onClose={() => setPicker(false)} onAdd={addExercises} />

      <TemplateNameSheet open={savingTpl} defaultName={active.name} onClose={() => setSavingTpl(false)}
        onSave={(name) => { saveTemplate(name); setSavingTpl(false); toast(`Saved “${name}” as template`) }} />

      <Sheet open={confirmDiscard} onClose={() => setConfirmDiscard(false)}>
        <div className="sheet-head"><div className="sheet-title">Discard session?</div></div>
        <div className="sheet-body">
          <p className="muted" style={{ marginTop: 0 }}>All sets logged in this session will be lost.</p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn" style={{ flex: 1 }} onClick={() => setConfirmDiscard(false)}>Keep going</button>
            <button className="btn btn-danger" style={{ flex: 1 }} onClick={() => { haptic(30); discard() }}>Discard</button>
          </div>
        </div>
      </Sheet>

      <FinishSheet open={finishing} onClose={() => setFinishing(false)}
        duration={now - active.startedAt} sets={doneSets} volume={volume} name={active.name}
        hasExercises={active.exercises.length > 0} fromTemplate={!!active.templateId}
        onFinish={(tplName) => {
          if (tplName !== null) saveTemplate(tplName)
          const done = finish()
          if (done) onFinished(done, tplName !== null)
        }} />
    </motion.div>
  )
}

function TemplateNameSheet({ open, defaultName, onClose, onSave }: { open: boolean; defaultName: string; onClose: () => void; onSave: (n: string) => void }) {
  const [name, setName] = useState(defaultName)
  useEffect(() => { if (open) setName(defaultName) }, [open, defaultName])
  return (
    <Sheet open={open} onClose={onClose}>
      <div className="sheet-head"><div className="sheet-title">Save as template</div></div>
      <form className="sheet-body" onSubmit={(e) => { e.preventDefault(); if (name.trim()) onSave(name.trim()) }}>
        <div className="field"><label>Template name</label><input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Push Day" /></div>
        <button className="btn btn-primary btn-block" disabled={!name.trim()}><Bookmark /> Save template</button>
      </form>
    </Sheet>
  )
}

function FinishSheet({ open, onClose, duration, sets, volume, name, hasExercises, fromTemplate, onFinish }: {
  open: boolean; onClose: () => void; duration: number; sets: number; volume: number; name: string; hasExercises: boolean; fromTemplate: boolean; onFinish: (tplName: string | null) => void
}) {
  const [asTpl, setAsTpl] = useState(false)
  const [tplName, setTplName] = useState(name)
  useEffect(() => { if (open) { setAsTpl(false); setTplName(name) } }, [open, name])
  return (
    <Sheet open={open} onClose={onClose}>
      <div className="sheet-head"><div className="sheet-title">Finish workout</div></div>
      <div className="sheet-body">
        <div className="summary">
          <div className="stat"><div className="stat-v">{fmtDur(duration)}</div><div className="stat-l">Time</div></div>
          <div className="stat"><div className="stat-v">{sets}</div><div className="stat-l">Sets</div></div>
          <div className="stat"><div className="stat-v">{Math.round(volume).toLocaleString()}</div><div className="stat-l">kg</div></div>
        </div>
        {sets === 0 && <p className="muted" style={{ marginTop: 0, fontSize: 14 }}>No sets checked off yet — sets with reps entered will still be saved.</p>}
        {hasExercises && (
          <button className="toggle" onClick={() => { haptic(6); setAsTpl((v) => !v) }}>
            <div><div style={{ fontWeight: 700 }}>Save as template</div><div className="muted" style={{ fontSize: 13 }}>{fromTemplate ? 'Save a new copy with today’s numbers' : 'Reuse this workout later'}</div></div>
            <motion.div className={`switch ${asTpl ? 'on' : ''}`} layout><motion.div className="knob" layout transition={{ type: 'spring', stiffness: 700, damping: 35 }} /></motion.div>
          </button>
        )}
        <AnimatePresence>
          {asTpl && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
              <div className="field" style={{ marginTop: 12 }}><label>Template name</label><input value={tplName} onChange={(e) => setTplName(e.target.value)} /></div>
            </motion.div>
          )}
        </AnimatePresence>
        <motion.button whileTap={{ scale: 0.97 }} className="btn btn-primary btn-block" style={{ marginTop: 16, height: 54 }} onClick={() => onFinish(asTpl ? tplName.trim() || name : null)}>
          Finish & save
        </motion.button>
        <button className="btn btn-ghost btn-block" style={{ marginTop: 6 }} onClick={onClose}>Keep training</button>
      </div>
    </Sheet>
  )
}
