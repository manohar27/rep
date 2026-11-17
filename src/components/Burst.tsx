import { motion } from 'framer-motion'
import { useMemo } from 'react'

const COLORS = ['#c6ff3d', '#f4f4f5', '#8bffcf', '#c6ff3d', '#ffd23d']
export function Burst({ seed }: { seed: number }) {
  const bits = useMemo(() => Array.from({ length: 48 }, (_, i) => {
    const a = (Math.PI * 2 * i) / 48 + Math.random() * 0.3
    const d = 140 + Math.random() * 220
    return { x: Math.cos(a) * d, y: Math.sin(a) * d - 80, r: Math.random() * 720 - 360, c: COLORS[i % COLORS.length], s: 0.6 + Math.random() * 0.8 }
  }), [seed])
  return (
    <div className="burst" aria-hidden>
      {bits.map((b, i) => (
        <motion.i key={`${seed}-${i}`} style={{ background: b.c }}
          initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: b.s }}
          animate={{ x: b.x, y: [0, b.y, b.y + 260], opacity: [1, 1, 0], rotate: b.r }}
          transition={{ duration: 1.4, ease: [0.2, 0.7, 0.4, 1] }} />
      ))}
    </div>
  )
}
