import { motion } from 'framer-motion'
import { useMemo } from 'react'
import { bestsFrom, fmtW, isWarmup } from '../lib/records'
import { getExercise, useStore } from '../lib/store'
import { PRChip } from './PRChip'
import { Sheet } from './Sheet'

const day = (t: number) => new Date(t).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })

export function ExerciseHistory({ exerciseId, onClose }: { exerciseId: string | null; onClose: () => void }) {
  const history = useStore((s) => s.history)
  const custom = useStore((s) => s.custom)
  const ex = exerciseId ? getExercise(exerciseId, custom) : null
  const b = exerciseId ? bestsFrom(history).get(exerciseId) : undefined
  const past = useMemo(() => !exerciseId ? [] : history.flatMap((s) => {
    const se = s.exercises.find((e) => e.exerciseId === exerciseId)
    return se ? [{ s, se, prIds: new Set((s.prs ?? []).filter((p) => p.exerciseId === exerciseId).map((p) => p.setId)) }] : []
  }), [history, exerciseId])
  const timed = ex?.kind === 'time'
  const rms = b ? Object.entries(b.repBest).map(([r, w]) => [Number(r), w] as const).filter(([r]) => r <= 12).sort((a, c) => a[0] - c[0]) : []

  const records = !b || timed ? [] : b.maxWeight > 0 ? [
    ['Heaviest', `${fmtW(b.maxWeight)} kg`], ['Est. 1RM', `${fmtW(Math.round(b.bestE1rm * 10) / 10)} kg`],
    ['Best set', `${Math.round(b.bestSet).toLocaleString()} kg`], ['Best volume', `${Math.round(b.bestVolume).toLocaleString()} kg`],
  ] : [['Most reps', String(b.maxReps)], ['Sessions', String(b.sessions)]]

  return (
    <Sheet open={!!exerciseId} onClose={onClose}>
      {ex && (
        <>
          <div className="sheet-head"><div><div className="sheet-title">{ex.name}</div><div className="muted" style={{ fontSize: 13 }}>{ex.equipment} · {ex.muscle} · {past.length} session{past.length === 1 ? '' : 's'}</div></div></div>
          <div className="sheet-body">
            {past.length === 0 && <div className="empty">No history yet — finish this session to set your baseline. PRs start from your next one.</div>}
            {records.length > 0 && (
              <div className="rec-grid">
                {records.map(([l, v], i) => (
                  <motion.div key={l} className="rec" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 450, damping: 32, delay: i * 0.04 }}>
                    <div className="rec-v">{v}</div><div className="rec-l">{l}</div>
                  </motion.div>
                ))}
              </div>
            )}
            {rms.length > 0 && (
              <>
                <div className="h2" style={{ marginTop: 0 }}>Rep maxes</div>
                <div className="rm-row">{rms.map(([r, w]) => <span key={r} className="rm"><b>{r}RM</b>{fmtW(w)}</span>)}</div>
              </>
            )}
            {past.length > 0 && <div className="h2" style={{ marginTop: 0 }}>History</div>}
            {past.map(({ s, se, prIds }, i) => (
              <motion.div key={s.id} className="past" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i, 8) * 0.03 }}>
                <div className="past-date"><span>{day(s.finishedAt)}</span><span>{s.name}</span></div>
                <div className="past-sets">
                  {se.sets.map((x) => (
                    <span key={x.id} className={`past-set ${isWarmup(x) ? 'warm' : ''} ${prIds.has(x.id) ? 'pr' : ''}`}>
                      {isWarmup(x) ? 'W ' : x.type === 'failure' ? 'F ' : ''}{timed ? `${x.weight || 0}m ${x.reps || 0}s` : x.weight ? `${x.weight}×${x.reps}` : `${x.reps} reps`}
                    </span>
                  ))}
                  {(s.prs ?? []).some((p) => p.exerciseId === exerciseId && p.kind === 'volume') && <PRChip label="Volume" />}
                </div>
              </motion.div>
            ))}
          </div>
        </>
      )}
    </Sheet>
  )
}
