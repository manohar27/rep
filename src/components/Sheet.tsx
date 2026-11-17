import { AnimatePresence, motion, useDragControls, type PanInfo } from 'framer-motion'
import type { ReactNode } from 'react'

export function Sheet({ open, onClose, children, tall }: { open: boolean; onClose: () => void; children: ReactNode; tall?: boolean }) {
  const controls = useDragControls()
  const onDragEnd = (_: unknown, info: PanInfo) => { if (info.offset.y > 120 || info.velocity.y > 600) onClose() }
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div key="scrim" className="scrim" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          <motion.div
            key="sheet"
            className="sheet"
            style={tall ? { height: 'calc(100dvh - var(--safe-top) - 24px)' } : undefined}
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 340 }}
            drag="y" dragControls={controls} dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: 0.7 }}
            onDragEnd={onDragEnd}
          >
            <div onPointerDown={(e) => controls.start(e)} style={{ touchAction: 'none', cursor: 'grab' }}>
              <div className="sheet-grab" />
            </div>
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
