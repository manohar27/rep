import { AnimatePresence, motion } from 'framer-motion'
import { create } from 'zustand'
import { Check } from './Icons'

// A tiny queue: toasts fired in the same moment (e.g. a set PR and a volume PR from one ✓ tap)
// play one after another instead of the later one silently replacing the earlier.
const useToast = create<{ msg: string | null; key: number }>(() => ({ msg: null, key: 0 }))
const queue: string[] = []
let timer: ReturnType<typeof setTimeout> | undefined

function next() {
  const msg = queue.shift() ?? null
  useToast.setState((s) => ({ msg, key: s.key + 1 }))
  if (msg) timer = setTimeout(next, queue.length ? 1500 : 2200)
  else timer = undefined
}

export const toast = (msg: string) => {
  if (queue.length >= 3) queue.shift() // never build up a backlog
  queue.push(msg)
  if (!timer) next()
}

export function Toaster() {
  const { msg, key } = useToast()
  return (
    <AnimatePresence mode="wait">
      {msg && (
        <motion.div key={key} className="toast" initial={{ y: -40, x: '-50%', opacity: 0, scale: 0.9 }} animate={{ y: 0, x: '-50%', opacity: 1, scale: 1 }} exit={{ y: -40, x: '-50%', opacity: 0 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }}>
          <Check width={16} height={16} /> {msg}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
