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
// The one definition of a set's working volume; store.volumeOf builds on it.
export const setVolume = (s: SetEntry) => (counts(s) ? num(s.weight) * int(s.reps) : 0)
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
  for (const s of history) {
    // An exercise can appear in several blocks of one session; volume and session count are per session.
    const vol = new Map<string, number>()
    for (const se of s.exercises) {
      if (isTimed(se.exerciseId)) continue
      const working = se.sets.filter((x) => counts(x) && int(x.reps) > 0)
      if (!working.length) continue // e.g. only warm-ups checked: not a baseline
      const b = map.get(se.exerciseId) ?? empty()
      for (const x of working) absorb(b, num(x.weight), int(x.reps))
      map.set(se.exerciseId, b)
      vol.set(se.exerciseId, (vol.get(se.exerciseId) ?? 0) + working.reduce((a, x) => a + setVolume(x), 0))
    }
    for (const [id, v] of vol) { const b = map.get(id)!; b.bestVolume = Math.max(b.bestVolume, v); b.sessions++ }
  }
  cache = { history, map }
  return map
}

// PRs set by one exercise block against all prior history *and* earlier blocks of the same exercise in
// this session (`blocks`), so adding an exercise twice can't double-award. Sets are judged in order: a
// later heavier set also counts, an equal one doesn't. An exercise's first ever session is the baseline
// and awards nothing (otherwise every set of a new exercise would be a "PR"). The session Volume PR is
// reported once, on the exercise's last block, using the volume of all its blocks.
export function exercisePRs(se: SessionExercise, history: CompletedSession[], blocks: SessionExercise[] = [se]): PRHit[] {
  if (isTimed(se.exerciseId)) return []
  const prev = bestsFrom(history).get(se.exerciseId)
  if (!prev) return []
  const same = blocks.filter((b) => b.exerciseId === se.exerciseId)
  const run = clone(prev)
  for (const b of same.slice(0, Math.max(0, same.findIndex((b) => b.id === se.id))))
    for (const x of b.sets) if (counts(x)) absorb(run, num(x.weight), int(x.reps))
  const hits: PRHit[] = []
  for (const s of se.sets) {
    if (!counts(s)) continue
    const w = num(s.weight), r = int(s.reps)
    if (r <= 0) continue
    // nRM needs a prior set of at least n reps to beat; a first-ever 8-rep back-off set isn't a record.
    const rmBar = bestAtLeast(run, r)
    let hit: [PRKind, string] | null = null
    if (w > 0 && w > run.maxWeight) hit = ['heaviest', 'Heaviest']
    else if (w > 0 && r <= 12 && rmBar > 0 && w > rmBar) hit = ['rm', `${r}RM`]
    else if (w > 0 && w * r > run.bestSet) hit = ['bestSet', 'Best set']
    else if (w === 0 && r > run.maxReps) hit = ['reps', 'Most reps']
    if (hit) hits.push({ exerciseId: se.exerciseId, setId: s.id, kind: hit[0], label: hit[1], detail: w > 0 ? `${fmtW(w)} kg × ${r}` : `${r} reps` })
    absorb(run, w, r)
  }
  const isLast = same[same.length - 1]?.id === se.id
  const vol = same.reduce((a, b) => a + b.sets.reduce((v, x) => v + setVolume(x), 0), 0)
  if (isLast && vol > 0 && prev.bestVolume > 0 && vol > prev.bestVolume)
    hits.push({ exerciseId: se.exerciseId, kind: 'volume', label: 'Volume', detail: `${Math.round(vol).toLocaleString()} kg` })
  return hits
}

export const sessionPRs = (exercises: SessionExercise[], history: CompletedSession[]) =>
  exercises.flatMap((se) => exercisePRs(se, history, exercises))
