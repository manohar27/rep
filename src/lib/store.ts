import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { EXERCISE_BY_ID, type Exercise, type Muscle, type Equipment } from '../data/exercises'

export type SetType = 'normal' | 'warmup' | 'failure'
// `type` is optional so sessions persisted before set types existed still load as normal sets.
export interface SetEntry { id: string; weight: string; reps: string; done: boolean; type?: SetType }
export interface SessionExercise { id: string; exerciseId: string; sets: SetEntry[] }
export interface Session { id: string; name: string; startedAt: number; exercises: SessionExercise[]; templateId?: string }
export interface CompletedSession extends Session { finishedAt: number }
export interface TemplateExercise { exerciseId: string; sets: { weight: string; reps: string; type?: SetType }[] }
export interface Template { id: string; name: string; exercises: TemplateExercise[]; createdAt: number; lastUsedAt?: number }

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
const newSet = (weight = '', reps = '', type: SetType = 'normal'): SetEntry => ({ id: uid(), weight, reps, done: false, type })

interface State {
  active: Session | null
  templates: Template[]
  history: CompletedSession[]
  custom: Exercise[]
  startEmpty: () => void
  startFromTemplate: (id: string) => void
  renameSession: (name: string) => void
  addExercises: (ids: string[]) => void
  removeExercise: (seId: string) => void
  moveExercise: (seId: string, dir: -1 | 1) => void
  addSet: (seId: string) => void
  removeSet: (seId: string, setId: string) => void
  updateSet: (seId: string, setId: string, patch: Partial<SetEntry>) => void
  finish: () => CompletedSession | null
  discard: () => void
  saveTemplate: (name: string, from?: Session) => Template
  deleteTemplate: (id: string) => void
  addCustom: (name: string, muscle: Muscle, equipment: Equipment) => Exercise
}

const mapEx = (s: Session, seId: string, fn: (se: SessionExercise) => SessionExercise): Session => ({
  ...s, exercises: s.exercises.map((se) => (se.id === seId ? fn(se) : se)),
})

const greeting = () => {
  const h = new Date().getHours()
  return h < 11 ? 'Morning session' : h < 16 ? 'Midday session' : h < 21 ? 'Evening session' : 'Night session'
}

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      active: null,
      templates: [],
      history: [],
      custom: [],
      startEmpty: () => set({ active: { id: uid(), name: greeting(), startedAt: Date.now(), exercises: [] } }),
      startFromTemplate: (id) => {
        const t = get().templates.find((x) => x.id === id)
        if (!t) return
        set({
          active: {
            id: uid(), name: t.name, startedAt: Date.now(), templateId: t.id,
            exercises: t.exercises.map((te) => ({
              id: uid(), exerciseId: te.exerciseId,
              sets: te.sets.length ? te.sets.map((s) => newSet(s.weight, s.reps, s.type)) : [newSet()],
            })),
          },
          templates: get().templates.map((x) => (x.id === id ? { ...x, lastUsedAt: Date.now() } : x)),
        })
      },
      renameSession: (name) => set((st) => (st.active ? { active: { ...st.active, name } } : st)),
      addExercises: (ids) => set((st) => {
        if (!st.active) return st
        const last = lastSetsFor(st.history)
        const added = ids.map((exerciseId) => {
          const prev = last[exerciseId]
          return { id: uid(), exerciseId, sets: prev ? prev.map((p) => newSet(p.weight, p.reps, p.type)) : [newSet()] }
        })
        return { active: { ...st.active, exercises: [...st.active.exercises, ...added] } }
      }),
      removeExercise: (seId) => set((st) => st.active ? { active: { ...st.active, exercises: st.active.exercises.filter((e) => e.id !== seId) } } : st),
      moveExercise: (seId, dir) => set((st) => {
        if (!st.active) return st
        const arr = [...st.active.exercises]
        const i = arr.findIndex((e) => e.id === seId)
        const j = i + dir
        if (i < 0 || j < 0 || j >= arr.length) return st
        ;[arr[i], arr[j]] = [arr[j], arr[i]]
        return { active: { ...st.active, exercises: arr } }
      }),
      addSet: (seId) => set((st) => st.active ? {
        active: mapEx(st.active, seId, (se) => {
          const prev = se.sets[se.sets.length - 1]
          return { ...se, sets: [...se.sets, newSet(prev?.weight ?? '', prev?.reps ?? '')] }
        }),
      } : st),
      removeSet: (seId, setId) => set((st) => st.active ? {
        active: mapEx(st.active, seId, (se) => ({ ...se, sets: se.sets.filter((s) => s.id !== setId) })),
      } : st),
      updateSet: (seId, setId, patch) => set((st) => st.active ? {
        active: mapEx(st.active, seId, (se) => ({ ...se, sets: se.sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)) })),
      } : st),
      finish: () => {
        const a = get().active
        if (!a) return null
        const done: CompletedSession = {
          ...a,
          finishedAt: Date.now(),
          exercises: a.exercises
            // Only checked sets are real: unchecked ones may just be pre-filled from a template or history.
            .map((se) => ({ ...se, sets: se.sets.filter((s) => s.done) }))
            .filter((se) => se.sets.length),
        }
        // Nothing checked off: there's no workout to record, so just close the session.
        if (!done.exercises.length) { set({ active: null }); return null }
        set((st) => ({ active: null, history: [done, ...st.history] }))
        return done
      },
      discard: () => set({ active: null }),
      saveTemplate: (name, from) => {
        const src = from ?? get().active
        const t: Template = {
          id: uid(), name: name.trim() || 'Untitled', createdAt: Date.now(),
          exercises: (src?.exercises ?? []).map((se) => ({
            exerciseId: se.exerciseId, sets: se.sets.map((s) => ({ weight: s.weight, reps: s.reps, type: s.type ?? 'normal' })),
          })),
        }
        set((st) => ({ templates: [t, ...st.templates] }))
        return t
      },
      deleteTemplate: (id) => set((st) => ({ templates: st.templates.filter((t) => t.id !== id) })),
      addCustom: (name, muscle, equipment) => {
        const ex: Exercise = { id: 'custom-' + uid(), name: name.trim(), muscle, equipment, kind: equipment === 'Bodyweight' ? 'bodyweight' : 'weight' }
        set((st) => ({ custom: [ex, ...st.custom] }))
        return ex
      },
    }),
    { name: 'rep-store-v1' },
  ),
)

function lastSetsFor(history: CompletedSession[]) {
  const out: Record<string, SetEntry[]> = {}
  for (const s of history) for (const se of s.exercises) if (!out[se.exerciseId]) out[se.exerciseId] = se.sets
  return out
}

export const usePrevious = (exerciseId: string) =>
  useStore((st) => {
    for (const s of st.history) {
      const se = s.exercises.find((e) => e.exerciseId === exerciseId)
      if (se) return se.sets
    }
    return null
  })

export const getExercise = (id: string, custom: Exercise[]): Exercise =>
  EXERCISE_BY_ID[id] ?? custom.find((c) => c.id === id) ?? { id, name: 'Unknown exercise', muscle: 'Full Body', equipment: 'Other', kind: 'weight' }

export const isWarmup = (s: SetEntry) => s.type === 'warmup'
// Time-based exercises store minutes/seconds in weight/reps, so they never count toward kg volume.
const isTimed = (exerciseId: string) => EXERCISE_BY_ID[exerciseId]?.kind === 'time'

// Warm-ups are logged but excluded from working volume and set counts.
export const volumeOf = (s: Session, onlyDone = true) =>
  s.exercises.reduce((v, se) => isTimed(se.exerciseId) ? v : v + se.sets.reduce((a, x) =>
    a + ((!onlyDone || x.done) && !isWarmup(x) ? (parseFloat(x.weight) || 0) * (parseInt(x.reps) || 0) : 0), 0), 0)

export const workingSets = (s: Session, onlyDone = true) =>
  s.exercises.reduce((a, se) => a + se.sets.filter((x) => (!onlyDone || x.done) && !isWarmup(x)).length, 0)

// Free-form numeric input: accepts "," as decimal separator (EU keyboards), one dot, up to 2 decimals.
// If both "," and "." appear, "," is a thousands separator and is dropped ("1,000.5" -> "1000.5").
export const sanitizeWeight = (raw: string) => {
  let v = raw.includes('.') ? raw.replace(/,/g, '') : raw.replace(',', '.')
  v = v.replace(/[^0-9.]/g, '')
  const i = v.indexOf('.')
  const int = (i >= 0 ? v.slice(0, i) : v).slice(0, 4)
  if (i < 0) return int
  return (int || '0') + '.' + v.slice(i + 1).replace(/\./g, '').slice(0, 2)
}
export const sanitizeReps = (raw: string) => raw.replace(/\D/g, '').slice(0, 4)

export const haptic = (ms: number | number[] = 8) => { try { navigator.vibrate?.(ms) } catch { /* noop */ } }
