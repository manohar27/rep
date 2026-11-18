import { AnimatePresence, motion, useMotionValue, useTransform, type PanInfo } from 'framer-motion'
import { useState } from 'react'
import { getExercise, haptic, sanitizeReps, sanitizeWeight, usePrevious, useStore, type SessionExercise, type SetEntry, type SetType } from '../lib/store'
import { Check, Dots, Down, Trash, Up } from './Icons'

export function ExerciseCard({ se, index, total, onSetDone }: { se: SessionExercise; index: number; total: number; onSetDone: () => void }) {
  const custom = useStore((s) => s.custom)
  const ex = getExercise(se.exerciseId, custom)
  const prev = usePrevious(se.exerciseId)
  const { addSet, removeExercise, moveExercise } = useStore.getState()
  const [menu, setMenu] = useState(false)
  const isTime = ex.kind === 'time'
  const doneCount = se.sets.filter((s) => s.done).length

  return (
    <motion.div layout className="card ex"
      initial={{ opacity: 0, y: 24, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: -60, scale: 0.95, transition: { duration: 0.2 } }}
      transition={{ type: 'spring', stiffness: 380, damping: 32 }} style={{ position: 'relative' }}>
      <div className="ex-head">
        <div className="ex-title">
          <div className="ex-name">{ex.name}</div>
          <div className="ex-tag">{ex.equipment} · {ex.muscle} · <span className="mono">{doneCount}/{se.sets.length}</span> sets</div>
        </div>
        <button className="icon-btn" onClick={() => setMenu((m) => !m)} aria-label="Exercise options"><Dots /></button>
      </div>
      <AnimatePresence>
        {menu && (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 4 }} onClick={() => setMenu(false)} />
            <motion.div className="menu" initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ type: 'spring', stiffness: 600, damping: 32 }}>
              <button disabled={index === 0} style={{ opacity: index === 0 ? 0.4 : 1 }} onClick={() => { moveExercise(se.id, -1); setMenu(false) }}><Up width={18} /> Move up</button>
              <button disabled={index === total - 1} style={{ opacity: index === total - 1 ? 0.4 : 1 }} onClick={() => { moveExercise(se.id, 1); setMenu(false) }}><Down width={18} /> Move down</button>
              <button className="danger" onClick={() => { haptic(20); removeExercise(se.id) }}><Trash /> Remove exercise</button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="sets">
        <div className="set-row labels">
          <span>Set</span><span>Prev</span><span>{isTime ? 'Min' : ex.kind === 'bodyweight' ? '+kg' : 'kg'}</span><span>{isTime ? 'Sec' : 'Reps'}</span><span>✓</span>
        </div>
        <AnimatePresence initial={false}>
          {se.sets.map((s, i) => (
            <SetRow key={s.id} seId={se.id} s={s} label={labelFor(se.sets, i)} prev={prev?.[i]} isTime={isTime} onDone={onSetDone} canDelete={se.sets.length > 1} />
          ))}
        </AnimatePresence>
      </div>
      <motion.button whileTap={{ scale: 0.97 }} className="add-set" onClick={() => { haptic(6); addSet(se.id) }}>+ Add set</motion.button>
    </motion.div>
  )
}

// Warm-ups read "W", failure sets "F"; only the remaining working sets are numbered.
function labelFor(sets: SetEntry[], i: number) {
  if (sets[i].type === 'warmup') return 'W'
  if (sets[i].type === 'failure') return 'F'
  return String(sets.slice(0, i + 1).filter((x) => (x.type ?? 'normal') === 'normal').length)
}

const TYPES: { t: SetType; badge: string; name: string; hint: string }[] = [
  { t: 'normal', badge: '1', name: 'Working set', hint: 'Counts toward volume' },
  { t: 'warmup', badge: 'W', name: 'Warm-up', hint: 'Excluded from volume' },
  { t: 'failure', badge: 'F', name: 'Failure', hint: 'Taken to failure · counts toward volume' },
]

function SetRow({ seId, s, label, prev, isTime, onDone, canDelete }: { seId: string; s: SetEntry; label: string; prev?: SetEntry; isTime: boolean; onDone: () => void; canDelete: boolean }) {
  const { updateSet, removeSet } = useStore.getState()
  const [typeMenu, setTypeMenu] = useState(false)
  const type = s.type ?? 'normal'
  // The red delete layer only fades in as the row is swiped, so it never bleeds through at rest.
  const x = useMotionValue(0)
  const delOpacity = useTransform(x, [-40, -4], [1, 0])
  const toggle = () => {
    const done = !s.done
    const patch: Partial<SetEntry> = { done }
    // Tapping ✓ on an empty row adopts the placeholder (previous) values.
    if (done && !s.reps && prev?.reps) patch.reps = prev.reps
    if (done && !s.weight && prev?.weight) patch.weight = prev.weight
    updateSet(seId, s.id, patch)
    haptic(done ? [12, 30, 18] : 6)
    // Warm-ups don't trigger the rest timer — you usually go straight to the next one.
    if (done && type !== 'warmup') onDone()
  }
  const setType = (t: SetType) => { haptic(8); updateSet(seId, s.id, { type: t }); setTypeMenu(false) }
  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (canDelete && (info.offset.x < -90 || info.velocity.x < -700)) { haptic(20); removeSet(seId, s.id) }
  }
  return (
    <motion.div className="set-wrap" layout
      initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0, x: -200, transition: { duration: 0.22 } }}
      transition={{ type: 'spring', stiffness: 500, damping: 38 }} style={{ zIndex: typeMenu ? 10 : 'auto' }}>
      <div className="set-clip">
      {canDelete && <motion.div className="set-del" style={{ opacity: delOpacity }}>Delete</motion.div>}
      <motion.div className={`set-row ${s.done ? 'done' : ''} t-${type}`} style={{ background: 'var(--card)', x }}
        drag={canDelete ? 'x' : false} dragDirectionLock dragConstraints={{ left: 0, right: 0 }} dragElastic={{ left: 0.5, right: 0 }} onDragEnd={onDragEnd}>
        <motion.div className="set-bg" initial={false} animate={{ scaleX: s.done ? 1 : 0, opacity: s.done ? 1 : 0 }} transition={{ type: 'spring', stiffness: 260, damping: 30 }} />
        <motion.button className="set-num" onClick={() => { haptic(4); setTypeMenu((v) => !v) }} whileTap={{ scale: 0.85 }} aria-label={`Set ${label}, change set type`}>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span key={label} initial={{ y: 8, opacity: 0, scale: 0.6 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: -8, opacity: 0, scale: 0.6 }} transition={{ type: 'spring', stiffness: 600, damping: 30 }}>
              {label}
            </motion.span>
          </AnimatePresence>
        </motion.button>
        <span className="set-prev">{prev ? (prev.weight ? `${prev.weight}×${prev.reps}` : prev.reps) : '—'}</span>
        <input className="set-in" inputMode="decimal" type="text" autoComplete="off" placeholder={prev?.weight || '0'} value={s.weight}
          onChange={(e) => updateSet(seId, s.id, { weight: sanitizeWeight(e.target.value) })} onFocus={(e) => e.target.select()} aria-label="Weight" />
        <input className="set-in" inputMode="numeric" type="text" autoComplete="off" placeholder={prev?.reps || '0'} value={s.reps}
          onChange={(e) => updateSet(seId, s.id, { reps: sanitizeReps(e.target.value) })} onFocus={(e) => e.target.select()} aria-label={isTime ? 'Seconds' : 'Reps'} />
        <motion.button className="set-check" onClick={toggle} whileTap={{ scale: 0.8 }}
          animate={s.done ? { scale: [1, 1.25, 1], rotate: [0, -10, 0] } : { scale: 1 }} transition={{ duration: 0.35 }} aria-label="Complete set">
          <Check width={18} height={18} />
        </motion.button>
      </motion.div>
      </div>
      <AnimatePresence>
        {typeMenu && (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 4 }} onClick={() => setTypeMenu(false)} />
            <motion.div className="menu type-menu" initial={{ opacity: 0, scale: 0.85, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ type: 'spring', stiffness: 600, damping: 32 }}>
              {TYPES.map((o) => (
                <button key={o.t} className={type === o.t ? 'on' : ''} onClick={() => setType(o.t)}>
                  <span className={`type-badge t-${o.t}`}>{o.badge}</span>
                  <span style={{ flex: 1 }}><span style={{ display: 'block' }}>{o.name}</span><span className="type-hint">{o.hint}</span></span>
                  {type === o.t && <Check width={16} height={16} />}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
