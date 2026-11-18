import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { Dots, Lock, Play, Plus, Trash, Trophy } from '../components/Icons'
import { Wordmark } from '../components/Wordmark'
import { lock, useAuth } from '../lib/auth'
import { Sheet } from '../components/Sheet'
import { toast } from '../components/Toast'
import { getExercise, haptic, useStore, volumeOf, workingSets, type Template } from '../lib/store'
import { fmtDur } from './SessionScreen'

const container = { hidden: {}, show: { transition: { staggerChildren: 0.05, delayChildren: 0.05 } } }
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 400, damping: 30 } } }

const ago = (t: number) => {
  const d = Math.floor((Date.now() - t) / 86400000)
  return d === 0 ? 'Today' : d === 1 ? 'Yesterday' : d < 7 ? `${d} days ago` : new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function HomeScreen({ onStart }: { onStart: () => void }) {
  const templates = useStore((s) => s.templates)
  const history = useStore((s) => s.history)
  const custom = useStore((s) => s.custom)
  const active = useStore((s) => s.active)
  const authAvailable = useAuth((s) => s.available)
  const { startEmpty, startFromTemplate, deleteTemplate } = useStore.getState()
  const [preview, setPreview] = useState<Template | null>(null)
  const [menu, setMenu] = useState<string | null>(null)

  const begin = (fn: () => void) => {
    if (active) { onStart(); return }
    haptic([8, 30, 12]); fn(); onStart()
  }

  return (
    <motion.div className="screen" variants={container} initial="hidden" animate="show" exit={{ opacity: 0, scale: 0.98 }}>
      <motion.div variants={item}>
        <div className="eyebrow">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 style={{ margin: 0 }}><Wordmark /></h1>
          {authAvailable && (
            <motion.button className="icon-btn" whileTap={{ scale: 0.88 }} aria-label="Lock"
              onClick={async () => {
                haptic(8)
                const r = await lock()
                if (r === 'offline') toast("Can't lock while offline")
                else if (r === 'unavailable') toast("Can't lock right now")
              }}>
              <Lock />
            </motion.button>
          )}
        </div>
      </motion.div>

      <motion.button variants={item} className="hero" whileTap={{ scale: 0.97 }} whileHover={{ scale: 1.01 }} onClick={() => (active ? onStart() : begin(startEmpty))}>
        <svg className="hero-bars" width="200" height="200" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M3 10v4M6 7v10M18 7v10M21 10v4M6 12h12" /></svg>
        <div className="hero-sub">{active ? 'Session in progress' : 'Quick start'}</div>
        <div className="hero-title">{active ? <>Resume<br />{active.name}</> : <>Start empty<br />session</>}</div>
        <motion.div className="hero-plus" animate={{ rotate: active ? 0 : [0, 90, 90] }} transition={{ duration: 0.6, delay: 0.4 }}>
          {active ? <Play /> : <Plus width={26} height={26} />}
        </motion.div>
      </motion.button>

      <motion.div variants={item} className="h2"><span>Templates</span><span className="mono" style={{ color: 'var(--dim)' }}>{templates.length}</span></motion.div>
      {templates.length === 0 ? (
        <motion.div variants={item} className="empty">No templates yet. Log a session and tap <b style={{ color: 'var(--text)' }}>Save as template</b> to reuse it.</motion.div>
      ) : (
        <motion.div variants={item} className="tpl-grid">
          <AnimatePresence>
            {templates.map((t) => (
              <motion.div key={t.id} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} style={{ position: 'relative' }}>
                <motion.button className="card tpl" style={{ width: '100%' }} whileTap={{ scale: 0.96 }} onClick={() => { haptic(6); setPreview(t) }}>
                  <div className="tpl-name">{t.name}</div>
                  <div className="tpl-list">{t.exercises.map((e) => getExercise(e.exerciseId, custom).name).join(' · ')}</div>
                  <div className="tpl-meta">{t.exercises.length} exercise{t.exercises.length === 1 ? "" : "s"}{t.lastUsedAt ? ` · ${ago(t.lastUsedAt)}` : ''}</div>
                </motion.button>
                <button className="icon-btn tpl-menu" onClick={() => setMenu(menu === t.id ? null : t.id)} aria-label="Template options"><Dots width={18} /></button>
                <AnimatePresence>
                  {menu === t.id && (
                    <>
                      <div style={{ position: 'fixed', inset: 0, zIndex: 4 }} onClick={() => setMenu(null)} />
                      <motion.div className="menu" initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ type: 'spring', stiffness: 600, damping: 32 }}>
                        <button onClick={() => { setMenu(null); if (active) toast('Finish your current session first'); begin(() => startFromTemplate(t.id)) }}><Play width={16} /> Start</button>
                        <button className="danger" onClick={() => { setMenu(null); haptic(20); deleteTemplate(t.id); toast('Template deleted') }}><Trash /> Delete</button>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      <motion.div variants={item} className="h2"><span>History</span><span className="mono" style={{ color: 'var(--dim)' }}>{history.length}</span></motion.div>
      {history.length === 0 ? (
        <motion.div variants={item} className="empty">Your finished sessions show up here.</motion.div>
      ) : (
        history.slice(0, 20).map((h) => (
          <motion.div variants={item} key={h.id} className="card hist">
            <div style={{ minWidth: 0 }}>
              <div className="hist-name">{h.name}</div>
              <div className="hist-sub">{h.prs?.length ? <><span className="hist-pr"><Trophy width={12} height={12} />{h.prs.length}</span> · </> : null}{ago(h.finishedAt)} · {fmtDur(h.finishedAt - h.startedAt)} · {h.exercises.length} exercise{h.exercises.length === 1 ? "" : "s"}</div>
            </div>
            <div className="hist-stat"><b>{Math.round(volumeOf(h, false)).toLocaleString()}</b> kg<br /><b>{workingSets(h, false)}</b> sets</div>
          </motion.div>
        ))
      )}

      <Sheet open={!!preview} onClose={() => setPreview(null)}>
        {preview && (
          <>
            <div className="sheet-head"><div className="sheet-title">{preview.name}</div></div>
            <div className="sheet-body">
              {preview.exercises.map((e, i) => {
                const ex = getExercise(e.exerciseId, custom)
                return (
                  <motion.div key={i} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                    style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
                    <div><div style={{ fontWeight: 600 }}>{ex.name}</div><div className="muted" style={{ fontSize: 13 }}>{ex.equipment} · {ex.muscle}</div></div>
                    <div className="mono muted" style={{ fontSize: 13, textAlign: 'right' }}>{e.sets.length} × {e.sets.map((s) => s.reps || '–').join('/')}</div>
                  </motion.div>
                )
              })}
              <motion.button whileTap={{ scale: 0.97 }} className="btn btn-primary btn-block" style={{ marginTop: 18, height: 54 }}
                onClick={() => { const id = preview.id; setPreview(null); if (active) toast('Finish your current session first'); begin(() => startFromTemplate(id)) }}>
                <Play width={18} /> Start workout
              </motion.button>
            </div>
          </>
        )}
      </Sheet>
    </motion.div>
  )
}
