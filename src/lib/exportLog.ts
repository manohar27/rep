import type { Exercise } from '../data/exercises'
import { fmtW, isWarmup, prTitle } from './records'
import { getExercise, volumeOf, workingSets, type CompletedSession, type SetEntry } from './store'

// Plain-Markdown workout log meant to be pasted into an AI chat for analysis. It is explicit
// (units, set types, dates) and includes each exercise's previous session for progress context.

const date = (t: number) => new Date(t).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
const time = (t: number) => new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
const mins = (ms: number) => `${Math.max(1, Math.round(ms / 60000))} min`

export function setText(x: SetEntry, ex: Exercise) {
  if (ex.kind === 'time') return `${x.weight || 0} min ${x.reps || 0} s`
  if (ex.kind === 'bodyweight' || !x.weight || x.weight === '0') return x.weight && x.weight !== '0' ? `bodyweight +${x.weight} kg × ${x.reps || 0}` : `${x.reps || 0} reps`
  return `${fmtW(parseFloat(x.weight))} kg × ${x.reps || 0}`
}

export function sessionToText(s: CompletedSession, history: CompletedSession[], custom: Exercise[]) {
  const prs = s.prs ?? []
  const out: string[] = [
    `# Workout: ${s.name}`,
    `- Date: ${date(s.startedAt)}, ${time(s.startedAt)}–${time(s.finishedAt)} (${mins(s.finishedAt - s.startedAt)})`,
    `- Working sets: ${workingSets(s, false)} · Volume: ${Math.round(volumeOf(s, false)).toLocaleString('en-GB')} kg (warm-ups excluded)`,
  ]
  if (prs.length) out.push(`- Personal records: ${prs.length}`)
  for (const se of s.exercises) {
    const ex = getExercise(se.exerciseId, custom)
    out.push('', `## ${ex.name} (${ex.equipment} · ${ex.muscle})`)
    let n = 0, w = 0
    for (const x of se.sets) {
      const tags: string[] = []
      if (x.type === 'failure') tags.push('to failure')
      const pr = prs.find((p) => p.setId === x.id)
      if (pr) tags.push(`PR: ${prTitle(pr)}`)
      const label = isWarmup(x) ? `Warm-up ${++w}` : `Set ${++n}`
      out.push(`- ${label}: ${setText(x, ex)}${tags.length ? ` (${tags.join('; ')})` : ''}`)
    }
    const vol = prs.find((p) => p.exerciseId === se.exerciseId && p.kind === 'volume')
    if (vol) out.push(`- PR: ${prTitle(vol)} (${vol.detail})`)
    const prev = history.find((h) => h.finishedAt < s.startedAt && h.exercises.some((e) => e.exerciseId === se.exerciseId))
    if (prev) {
      const sets = prev.exercises.filter((e) => e.exerciseId === se.exerciseId).flatMap((e) => e.sets).filter((x) => !isWarmup(x))
      out.push(`- Previous (${date(prev.startedAt)}): ${sets.map((x) => setText(x, ex)).join(', ') || 'warm-ups only'}`)
    }
  }
  return out.join('\n')
}

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Fallback for browsers/webviews without async clipboard permission.
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    return ok
  }
}
