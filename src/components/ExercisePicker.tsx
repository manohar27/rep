import { AnimatePresence, motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import { EXERCISES, MUSCLES, type Equipment, type Muscle } from '../data/exercises'
import { haptic, useStore } from '../lib/store'
import { Check, Plus, Search, X } from './Icons'
import { Sheet } from './Sheet'

const EQUIP: Equipment[] = ['Barbell', 'Dumbbell', 'Machine', 'Cable', 'Bodyweight', 'Kettlebell', 'Band', 'Smith', 'EZ Bar', 'Trap Bar', 'Other']

export function ExercisePicker({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: (ids: string[]) => void }) {
  const custom = useStore((s) => s.custom)
  const addCustom = useStore((s) => s.addCustom)
  const [q, setQ] = useState('')
  const [muscle, setMuscle] = useState<Muscle | 'All'>('All')
  const [sel, setSel] = useState<string[]>([])
  const [creating, setCreating] = useState(false)

  const all = useMemo(() => [...custom, ...EXERCISES], [custom])
  const list = useMemo(() => {
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean)
    return all.filter((e) =>
      (muscle === 'All' || e.muscle === muscle) &&
      terms.every((t) => `${e.name} ${e.muscle} ${e.equipment}`.toLowerCase().includes(t)))
  }, [all, q, muscle])

  const grouped = useMemo(() => {
    const m = new Map<string, typeof list>()
    for (const e of list) { const k = e.muscle; m.set(k, [...(m.get(k) ?? []), e]) }
    return [...m.entries()]
  }, [list])

  const toggle = (id: string) => { haptic(6); setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id])) }
  const close = () => { setSel([]); setQ(''); setMuscle('All'); setCreating(false); onClose() }
  const submit = () => { onAdd(sel); haptic([10, 40, 10]); close() }

  return (
    <Sheet open={open} onClose={close} tall>
      <div className="sheet-head">
        <div className="sheet-title">Add exercises</div>
        <button className="icon-btn" onClick={close} aria-label="Close"><X /></button>
      </div>
      {creating ? (
        <CreateCustom initial={q} onCancel={() => setCreating(false)} onCreate={(name, m, eq) => {
          const ex = addCustom(name, m, eq)
          setSel((s) => [...s, ex.id]); setCreating(false); setQ('')
        }} />
      ) : (
        <>
          <div className="search">
            <Search />
            <input placeholder={`Search ${all.length} exercises`} value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="chips">
            {(['All', ...MUSCLES] as const).map((m) => (
              <motion.button key={m} whileTap={{ scale: 0.92 }} className={`chip ${muscle === m ? 'on' : ''}`} onClick={() => { haptic(4); setMuscle(m) }}>
                {muscle === m && <motion.div layoutId="chip-bg" className="chip-bg" transition={{ type: 'spring', stiffness: 500, damping: 35 }} />}
                <span>{m}</span>
              </motion.button>
            ))}
          </div>
          <div className="lib">
            {grouped.map(([g, items]) => (
              <div key={g}>
                <div className="lib-group">{g}</div>
                {items.map((e) => {
                  const on = sel.includes(e.id)
                  return (
                    <motion.button key={e.id} className={`lib-item ${on ? 'on' : ''}`} onClick={() => toggle(e.id)} whileTap={{ scale: 0.98 }}>
                      <motion.div className="lib-av" animate={{ scale: on ? [1, 1.18, 1] : 1, rotate: on ? [0, -8, 0] : 0 }} transition={{ duration: 0.3 }}>
                        {on ? <Check width={18} height={18} /> : e.name.split(/\s|-/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()}
                      </motion.div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="lib-name">{e.name}</div>
                        <div className="lib-sub">{e.equipment} · {e.muscle}{e.id.startsWith('custom-') ? ' · Custom' : ''}</div>
                      </div>
                      {on && <motion.span className="mono" style={{ color: 'var(--accent)', fontWeight: 700, fontSize: 13 }} initial={{ scale: 0 }} animate={{ scale: 1 }}>{sel.indexOf(e.id) + 1}</motion.span>}
                    </motion.button>
                  )
                })}
              </div>
            ))}
            <div style={{ padding: '16px 8px' }}>
              {list.length === 0 && <div className="muted" style={{ textAlign: 'center', marginBottom: 12 }}>No match for “{q}”.</div>}
              <button className="btn btn-block" onClick={() => setCreating(true)}><Plus width={18} /> Create custom exercise</button>
            </div>
          </div>
          <AnimatePresence>
            {sel.length > 0 && (
              <motion.div className="lib-cta" initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }} transition={{ type: 'spring', stiffness: 420, damping: 32 }}>
                <motion.button whileTap={{ scale: 0.97 }} className="btn btn-primary btn-block" style={{ height: 54, boxShadow: '0 10px 30px rgba(198,255,61,.25)' }} onClick={submit}>
                  Add <motion.span key={sel.length} initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="mono">{sel.length}</motion.span> exercise{sel.length > 1 ? 's' : ''}
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </Sheet>
  )
}

function CreateCustom({ initial, onCancel, onCreate }: { initial: string; onCancel: () => void; onCreate: (n: string, m: Muscle, e: Equipment) => void }) {
  const [name, setName] = useState(initial)
  const [m, setM] = useState<Muscle>('Chest')
  const [eq, setEq] = useState<Equipment>('Barbell')
  return (
    <motion.div className="sheet-body" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }}>
      <div className="field"><label>Name</label><input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Pin Squat" /></div>
      <div className="field"><label>Muscle</label><select value={m} onChange={(e) => setM(e.target.value as Muscle)}>{MUSCLES.map((x) => <option key={x}>{x}</option>)}</select></div>
      <div className="field"><label>Equipment</label><select value={eq} onChange={(e) => setEq(e.target.value as Equipment)}>{EQUIP.map((x) => <option key={x}>{x}</option>)}</select></div>
      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <button className="btn" style={{ flex: 1 }} onClick={onCancel}>Back</button>
        <button className="btn btn-primary" style={{ flex: 2 }} disabled={!name.trim()} onClick={() => onCreate(name, m, eq)}>Create & select</button>
      </div>
    </motion.div>
  )
}
