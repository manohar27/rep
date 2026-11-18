import { motion } from 'framer-motion'
import { forwardRef } from 'react'
import { Trophy } from './Icons'

// Gold, not lime: lime is reserved for the primary action. Pops in with a tilt and a one-off shine.
export const PRChip = forwardRef<HTMLSpanElement, { label: string; delay?: number; big?: boolean }>(({ label, delay = 0, big }, ref) => (
  <motion.span ref={ref} className={`pr-chip ${big ? 'big' : ''}`}
    initial={{ scale: 0, rotate: -18, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }}
    transition={{ type: 'spring', stiffness: 520, damping: 18, delay }}>
    <Trophy width={big ? 14 : 11} height={big ? 14 : 11} />{label}
  </motion.span>
))
