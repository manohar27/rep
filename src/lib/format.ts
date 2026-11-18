import type { Exercise } from '../data/exercises'
import type { SetEntry } from './store'

// Shared display formatting so every sheet shows dates and sets the same way.
export const fmtDay = (t: number) => new Date(t).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })

const hasWeight = (w: string) => (parseFloat(w) || 0) > 0

// Compact chip text for in-app set lists, e.g. "62.5×8", "+10×8", "12 reps", "20m 30s".
// Weight is shown exactly as typed (see CLAUDE.md), only checked for being non-zero.
export function setShort(x: SetEntry, ex: Exercise) {
  const prefix = x.type === 'warmup' ? 'W ' : x.type === 'failure' ? 'F ' : ''
  if (ex.kind === 'time') return `${prefix}${x.weight || 0}m ${x.reps || 0}s`
  if (!hasWeight(x.weight)) return `${prefix}${x.reps || 0} reps`
  return `${prefix}${ex.kind === 'bodyweight' ? '+' : ''}${x.weight}×${x.reps || 0}`
}

// Explicit long form for the AI export, e.g. "62.5 kg × 8", "bodyweight +10 kg × 8", "12 reps".
export function setLong(x: SetEntry, ex: Exercise) {
  if (ex.kind === 'time') return `${x.weight || 0} min ${x.reps || 0} s`
  if (!hasWeight(x.weight)) return `${x.reps || 0} reps`
  return `${ex.kind === 'bodyweight' ? 'bodyweight +' : ''}${x.weight} kg × ${x.reps || 0}`
}
