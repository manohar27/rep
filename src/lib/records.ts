import { EXERCISE_BY_ID } from '../data/exercises'
import type { CompletedSession, SessionExercise, SetEntry } from './store'

// Per-exercise history and personal records are derived from completed sessions — the single
// source of truth — so nothing can drift. Results are cached per `history` array identity.

export type PRKind = 'heaviest' | 'rm' | 'bestSet' | 'reps' | 'volume'
export interface PRHit { exerciseId: string; setId?: string; kind: PRKind; label: string; detail: string }

export interface Bests {
  maxWeight: number
  repBest: Record<number, number> // reps -> heaviest weight lifted for exactly that many reps
  bestSet: number // best single-set volume (kg × reps)
  maxReps: number
  bestE1rm: number
  bestVolume: number // best single-session volume for this exercise
  sessions: number
}

export const isWarmup = (s: SetEntry) => s.type === 'warmup'
export const counts = (s: SetEntry) => s.done && !isWarmup(s)
export const isTimed = (exerciseId: string) => EXERCISE_BY_ID[exerciseId]?.kind === 'time'
const num = (s: string) => parseFloat(s) || 0
const int = (s: string) => parseInt(s) || 0
export const fmtW = (w: number) => String(Math.round(w * 100) / 100)

// Epley estimate; a true single is its own 1RM.
export const e1rm = (w: number, r: number) => (w <= 0 || r <= 0 ? 0 : r === 1 ? w : w * (1 + r / 30))

const empty = (): Bests => ({ maxWeight: 0, repBest: {}, bestSet: 0, maxReps: 0, bestE1rm: 0, bestVolume: 0, sessions: 0 })
const clone = (b: Bests): Bests => ({ ...b, repBest: { ...b.repBest } })

function absorb(b: Bests, w: number, r: number) {
  if (r <= 0) return
  b.maxReps = Math.max(b.maxReps, r)
  if (w <= 0) return
  b.maxWeight = Math.max(b.maxWeight, w)
  b.repBest[r] = Math.max(b.repBest[r] ?? 0, w)
  b.bestSet = Math.max(b.bestSet, w * r)
  b.bestE1rm = Math.max(b.bestE1rm, e1rm(w, r))
}

// Heaviest weight ever lifted for at least `r` reps (an r-rep max).
export const bestAtLeast = (b: Bests, r: number) =>
  Object.entries(b.repBest).reduce((m, [k, w]) => (Number(k) >= r ? Math.max(m, w) : m), 0)

let cache: { history: CompletedSession[]; map: Map<string, Bests> } | null = null
export function bestsFrom(history: CompletedSession[]): Map<string, Bests> {
  if (cache?.history === history) return cache.map
  const map = new Map<string, Bests>()
  for (const s of history) for (const se of s.exercises) {
    if (isTimed(se.exerciseId)) continue
    const b = map.get(se.exerciseId) ?? empty()
    let vol = 0
    for (const x of se.sets) if (counts(x)) { const w = num(x.weight), r = int(x.reps); absorb(b, w, r); vol += w * r }
    b.bestVolume = Math.max(b.bestVolume, vol)
    b.sessions++
    map.set(se.exerciseId, b)
  }
  cache = { history, map }
  return map
}

// PRs set by one exercise block against all prior history. Sets are judged in order, so a later
// heavier set also counts but an equal one doesn't. The first time an exercise is logged sets the
// baseline and awards nothing (otherwise every set of a new exercise would be a "PR").
export function exercisePRs(se: SessionExercise, history: CompletedSession[]): PRHit[] {
  if (isTimed(se.exerciseId)) return []
  const prev = bestsFrom(history).get(se.exerciseId)
  if (!prev) return []
  const run = clone(prev)
  const hits: PRHit[] = []
  let vol = 0
  for (const s of se.sets) {
    if (!counts(s)) continue
    const w = num(s.weight), r = int(s.reps)
    if (r <= 0) continue
    let hit: [PRKind, string] | null = null
    if (w > 0 && w > run.maxWeight) hit = ['heaviest', 'Heaviest']
    else if (w > 0 && r <= 12 && w > bestAtLeast(run, r)) hit = ['rm', `${r}RM`]
    else if (w > 0 && w * r > run.bestSet) hit = ['bestSet', 'Best set']
    else if (w === 0 && r > run.maxReps) hit = ['reps', 'Most reps']
    if (hit) hits.push({ exerciseId: se.exerciseId, setId: s.id, kind: hit[0], label: hit[1], detail: w > 0 ? `${fmtW(w)} kg × ${r}` : `${r} reps` })
    absorb(run, w, r)
    vol += w * r
  }
  if (vol > 0 && prev.bestVolume > 0 && vol > prev.bestVolume)
    hits.push({ exerciseId: se.exerciseId, kind: 'volume', label: 'Volume', detail: `${Math.round(vol).toLocaleString()} kg` })
  return hits
}

export const sessionPRs = (exercises: SessionExercise[], history: CompletedSession[]) =>
  exercises.flatMap((se) => exercisePRs(se, history))
