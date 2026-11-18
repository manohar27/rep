import { motion } from 'framer-motion'
import { prLabel, prTitle } from '../lib/records'
import type { CompletedSession } from '../lib/store'
import { getExercise, useStore } from '../lib/store'
import { PRChip } from './PRChip'
import { Sheet } from './Sheet'

// Shown after finishing a workout that set at least one PR.
export function PRSummary({ session, onClose }: { session: CompletedSession | null; onClose: () => void }) {
  const custom = useStore((s) => s.custom)
  const prs = session?.prs ?? []
  return (
    <Sheet open={!!session && prs.length > 0} onClose={onClose}>
      <div className="sheet-head">
        <div>
          <motion.div className="sheet-title" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }}>
            {prs.length} new PR{prs.length === 1 ? '' : 's'}
          </motion.div>
          <div className="muted" style={{ fontSize: 13 }}>{session?.name}</div>
        </div>
      </div>
      <div className="sheet-body">
        <div className="pr-list">
          {prs.map((p, i) => (
            <motion.div key={`${p.exerciseId}-${p.setId ?? p.kind}`} className="pr-item"
              initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ type: 'spring', stiffness: 450, damping: 30, delay: 0.15 + i * 0.07 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700 }}>{getExercise(p.exerciseId, custom).name}</div>
                <div className="muted" style={{ fontSize: 13 }}>{prTitle(p)} · <span className="mono">{p.detail}</span></div>
              </div>
              <PRChip big label={prLabel(p)} delay={0.25 + i * 0.07} />
            </motion.div>
          ))}
        </div>
        <motion.button whileTap={{ scale: 0.97 }} className="btn btn-primary btn-block" style={{ marginTop: 12, height: 54 }} onClick={onClose}>Nice</motion.button>
      </div>
    </Sheet>
  )
}
