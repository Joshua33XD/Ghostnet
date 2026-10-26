import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Filter } from 'lucide-react'

export default function FilterMenu({
  options = [],
  value,
  onChange,
  label = 'Filter',
}) {
  const [open, setOpen] = useState(false)
  const reduced = useReducedMotion()
  const rootRef = useRef(null)
  const current = options.find(o => o.id === value) || options[0]

  useEffect(() => {
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  return (
    <div className="wf-filter" ref={rootRef}>
      {!open && (
        <motion.button
          type="button"
          className="tactile-btn tactile-btn--default"
          onClick={() => setOpen(true)}
          layoutId={reduced ? undefined : 'wf-filter-shell'}
          aria-haspopup="listbox"
          aria-expanded={false}
        >
          <Filter size={14} aria-hidden="true" />
          <span>{current?.label || label}</span>
        </motion.button>
      )}

      <AnimatePresence>
        {open && (
          <motion.div
            className="wf-filter-pop"
            layoutId={reduced ? undefined : 'wf-filter-shell'}
            role="listbox"
            aria-label={label}
            initial={reduced ? false : { opacity: 0.6 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {options.map((opt, index) => (
              <motion.button
                key={String(opt.id)}
                type="button"
                role="option"
                aria-selected={opt.id === value}
                className="wf-menu-item"
                initial={reduced ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                onClick={() => {
                  onChange(opt.id)
                  setOpen(false)
                }}
              >
                <span>{opt.label}</span>
                <span className="wf-subtle">{opt.count ?? ''}</span>
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
