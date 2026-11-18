import { motion } from 'framer-motion'
import { forwardRef } from 'react'
import { Trophy } from './Icons'

// Gold, not lime: lime is reserved for the primary action. Pops in with a tilt and a one-off shine.
// Without a label it renders as a compact icon badge that always fits a set row.
export const PRChip = forwardRef<HTMLSpanElement, { label?: string; title?: string; delay?: number; big?: boolean }>(({ label, title, delay = 0, big }, ref) => (
  <motion.span ref={ref} className={`pr-chip ${big ? 'big' : ''} ${label ? '' : 'icon'}`} aria-label={title ?? label} title={title}
    initial={{ scale: 0, rotate: -18, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }}
    transition={{ type: 'spring', stiffness: 520, damping: 30, delay }}>
    <Trophy width={big ? 14 : label ? 11 : 13} height={big ? 14 : label ? 11 : 13} />{label}
  </motion.span>
))
