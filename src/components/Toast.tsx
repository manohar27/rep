import { AnimatePresence, motion } from 'framer-motion'
import { create } from 'zustand'
import { Check } from './Icons'

const useToast = create<{ msg: string | null; key: number }>(() => ({ msg: null, key: 0 }))
let t: ReturnType<typeof setTimeout> | undefined
export const toast = (msg: string) => {
  clearTimeout(t)
  useToast.setState((s) => ({ msg, key: s.key + 1 }))
  t = setTimeout(() => useToast.setState({ msg: null }), 2200)
}

export function Toaster() {
  const { msg, key } = useToast()
  return (
    <AnimatePresence>
      {msg && (
        <motion.div key={key} className="toast" initial={{ y: -40, x: '-50%', opacity: 0, scale: 0.9 }} animate={{ y: 0, x: '-50%', opacity: 1, scale: 1 }} exit={{ y: -40, x: '-50%', opacity: 0 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }}>
          <Check width={16} height={16} /> {msg}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
