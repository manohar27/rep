import { animate, motion, useMotionValue, useTransform } from 'framer-motion'
import { useEffect } from 'react'

export function Ticker({ value, format = (n: number) => Math.round(n).toLocaleString() }: { value: number; format?: (n: number) => string }) {
  const mv = useMotionValue(value)
  const text = useTransform(mv, format)
  useEffect(() => { const c = animate(mv, value, { duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }); return c.stop }, [value, mv])
  return <motion.span>{text}</motion.span>
}
