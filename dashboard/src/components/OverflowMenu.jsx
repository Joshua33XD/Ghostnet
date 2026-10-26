import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { FileSearch, MoreHorizontal, Plug } from 'lucide-react'
import { getApiUrl, setApiUrl } from '../apiConfig.js'

export default function OverflowMenu({ onOpenCapture }) {
  const [open, setOpen] = useState(false)
  const [endpoint, setEndpoint] = useState(getApiUrl())
  const reduced = useReducedMotion()
  const ref = useRef(null)

  useEffect(() => {
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const saveEndpoint = () => {
    setApiUrl(endpoint)
    window.location.reload()
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        className="wf-icon-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="More actions"
        onClick={() => setOpen(v => !v)}
      >
        <MoreHorizontal size={16} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="wf-menu"
            role="menu"
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
          >
            <button type="button" role="menuitem" onClick={() => { onOpenCapture(''); setOpen(false) }}>
              <FileSearch size={14} aria-hidden="true" /> Packet drill-down
            </button>
            <div style={{ padding: 10, display: 'grid', gap: 8 }}>
              <label className="wf-kicker" htmlFor="api-url"><Plug size={11} /> API endpoint</label>
              <input
                id="api-url"
                className="wf-field"
                value={endpoint}
                onChange={e => setEndpoint(e.target.value)}
                aria-label="GhostNet API URL"
              />
              <button type="button" className="tactile-btn tactile-btn--default tactile-btn--sm" onClick={saveEndpoint}>
                Save and reload
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
