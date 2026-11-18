import { motion, useReducedMotion } from 'framer-motion'
import { useMemo } from 'react'
import { create } from 'zustand'

interface Burst { id: number; x: number; y: number; n: number; spread: number; gravity: number }
const useBursts = create<{ bursts: Burst[] }>(() => ({ bursts: [] }))
let seq = 0

// Fire a particle burst from a screen point. Small (n≈14) for a set PR, large for finishing a workout.
export function celebrate(x: number, y: number, { n = 14, spread = 60, gravity = 40 } = {}) {
  const b = { id: ++seq, x, y, n, spread, gravity }
  useBursts.setState((s) => ({ bursts: [...s.bursts, b] }))
  setTimeout(() => useBursts.setState((s) => ({ bursts: s.bursts.filter((q) => q.id !== b.id) })), 1600)
}

export const celebrateFrom = (el: Element | null, opts?: Parameters<typeof celebrate>[2]) => {
  if (!el) return
  const r = el.getBoundingClientRect()
  celebrate(r.left + r.width / 2, r.top + r.height / 2, opts)
}

export const celebrateBig = () => celebrate(window.innerWidth / 2, window.innerHeight * 0.4, { n: 48, spread: 220, gravity: 260 })

const COLORS = ['#c6ff3d', '#f4f4f5', '#ffd23d', '#8bffcf', '#ffd23d']

export function Celebrations() {
  const bursts = useBursts((s) => s.bursts)
  // Particles are pure decoration: with reduced motion we skip them entirely (haptics/toasts still fire).
  if (useReducedMotion()) return null
  return <div className="burst" aria-hidden>{bursts.map((b) => <Particles key={b.id} {...b} />)}</div>
}

function Particles({ x, y, n, spread, gravity }: Burst) {
  const bits = useMemo(() => Array.from({ length: n }, (_, i) => {
    const a = (Math.PI * 2 * i) / n + Math.random() * 0.4
    const d = spread * (0.5 + Math.random() * 0.7)
    return { dx: Math.cos(a) * d, dy: Math.sin(a) * d - spread * 0.3, r: Math.random() * 720 - 360, c: COLORS[i % COLORS.length], s: 0.5 + Math.random() * 0.7 }
  }), [n, spread])
  const small = n < 24
  return (
    <>
      {bits.map((b, i) => (
        <motion.i key={i} style={{ left: x, top: y, background: b.c, width: small ? 6 : 8, height: small ? 6 : 14, borderRadius: small ? 3 : 2 }}
          initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: b.s }}
          animate={{ x: b.dx, y: [0, b.dy, b.dy + gravity], opacity: [1, 1, 0], rotate: b.r }}
          transition={{ duration: small ? 0.9 : 1.4, ease: [0.2, 0.7, 0.4, 1] }} />
      ))}
    </>
  )
}
