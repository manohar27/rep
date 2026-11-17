import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { haptic } from '../lib/store'
import { Timer, X } from './Icons'

export function RestTimer({ endsAt, total, onChange, onClose }: { endsAt: number | null; total: number; onChange: (endsAt: number, total: number) => void; onClose: () => void }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!endsAt) return
    const t = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(t)
  }, [endsAt])
  const left = endsAt ? Math.max(0, Math.ceil((endsAt - now) / 1000)) : 0
  useEffect(() => { if (endsAt && left === 0) { haptic([60, 80, 60]); const t = setTimeout(onClose, 1200); return () => clearTimeout(t) } }, [left, endsAt, onClose])
  const pct = endsAt ? Math.min(1, left / total) : 0
  const R = 13, C = 2 * Math.PI * R
  return (
    <AnimatePresence>
      {endsAt && (
        <motion.div className="rest" initial={{ y: 30, x: '-50%', opacity: 0, scale: 0.8 }} animate={{ y: 0, x: '-50%', opacity: 1, scale: left === 0 ? [1, 1.08, 1] : 1 }} exit={{ y: 30, x: '-50%', opacity: 0, scale: 0.8 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }}>
          <svg width="32" height="32" viewBox="0 0 32 32" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="16" cy="16" r={R} stroke="var(--line)" strokeWidth="3" fill="none" />
            <circle cx="16" cy="16" r={R} stroke="var(--accent)" strokeWidth="3" fill="none" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - pct)} style={{ transition: 'stroke-dashoffset .25s linear' }} />
          </svg>
          <span className="rest-t" style={{ color: left === 0 ? 'var(--accent)' : undefined }}>{left === 0 ? 'Go!' : `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`}</span>
          <button className="btn btn-sm" onClick={() => endsAt && onChange(Math.max(Date.now(), endsAt - 15000), total)}>−15</button>
          <button className="btn btn-sm" onClick={() => endsAt && onChange(endsAt + 15000, total + 15)}>+15</button>
          <button className="icon-btn" onClick={onClose} aria-label="Skip rest"><X width={18} /></button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
export { Timer }
