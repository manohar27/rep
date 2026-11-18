import { setLong } from './format'
import { isWarmup, prTitle } from './records'
import { getExercise, volumeOf, workingSets, type CompletedSession } from './store'
import type { Exercise } from '../data/exercises'

// Plain-Markdown workout log meant to be pasted into an AI chat for analysis. It is explicit
// (units, set types, full dates with year) and includes each exercise's previous session for
// progress context. An exercise logged in several blocks is merged into one section.

const date = (t: number) => new Date(t).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
const time = (t: number) => new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
const mins = (ms: number) => `${Math.max(1, Math.round(ms / 60000))} min`

export function sessionToText(s: CompletedSession, history: CompletedSession[], custom: Exercise[]) {
  const prs = s.prs ?? []
  const out: string[] = [
    `# Workout: ${s.name}`,
    `- Date: ${date(s.startedAt)}, ${time(s.startedAt)}–${time(s.finishedAt)} (${mins(s.finishedAt - s.startedAt)})`,
    `- Working sets: ${workingSets(s, false)} · Volume: ${Math.round(volumeOf(s, false)).toLocaleString('en-GB')} kg (warm-ups excluded)`,
  ]
  if (prs.length) out.push(`- Personal records: ${prs.length}`)
  const ids = [...new Set(s.exercises.map((se) => se.exerciseId))]
  for (const id of ids) {
    const ex = getExercise(id, custom)
    out.push('', `## ${ex.name} (${ex.equipment} · ${ex.muscle})`)
    let n = 0, w = 0
    for (const x of s.exercises.filter((se) => se.exerciseId === id).flatMap((se) => se.sets)) {
      const tags: string[] = []
      if (x.type === 'failure') tags.push('to failure')
      const pr = prs.find((p) => p.setId === x.id)
      if (pr) tags.push(`PR: ${prTitle(pr)}`)
      out.push(`- ${isWarmup(x) ? `Warm-up ${++w}` : `Set ${++n}`}: ${setLong(x, ex)}${tags.length ? ` (${tags.join('; ')})` : ''}`)
    }
    const vol = prs.find((p) => p.exerciseId === id && p.kind === 'volume')
    if (vol) out.push(`- PR: ${prTitle(vol)} (${vol.detail})`)
    const prev = history.find((h) => h.finishedAt < s.startedAt && h.exercises.some((e) => e.exerciseId === id))
    if (prev) {
      const sets = prev.exercises.filter((e) => e.exerciseId === id).flatMap((e) => e.sets).filter((x) => !isWarmup(x))
      out.push(`- Previous (${date(prev.startedAt)}): ${sets.map((x) => setLong(x, ex)).join(', ') || 'warm-ups only'}`)
    }
  }
  return out.join('\n')
}

// Must be called synchronously from the tap handler: iOS only allows clipboard writes inside the
// user gesture, so the legacy path runs first (synchronously) when the async API is unavailable.
export function copyText(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText && window.isSecureContext) return navigator.clipboard.writeText(text).then(() => true, () => false)
  const ta = document.createElement('textarea')
  ta.value = text
  ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0'
  document.body.appendChild(ta)
  ta.focus()
  ta.setSelectionRange(0, text.length) // iOS ignores select()
  let ok = false
  try { ok = document.execCommand('copy') } catch { ok = false }
  ta.remove()
  return Promise.resolve(ok)
}
