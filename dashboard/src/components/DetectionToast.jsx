import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, ShieldAlert } from 'lucide-react'
import { SPRING } from '../motion.js'
import { formatRelativeTime } from '../utils.js'

const WATCH = ['SUSPICIOUS', 'ATTACK', 'THREAT', 'QUARANTINE', 'WARN', 'ANOMALY']

function toastMeta(tag) {
  const t = (tag ?? '').toUpperCase()
  if (t.startsWith('THREAT') || t.includes('ATTACK')) {
    return { icon: ShieldAlert, tone: 'danger', title: 'Threat detected' }
  }
  if (t.includes('QUARANTINE')) {
    return { icon: ShieldAlert, tone: 'danger', title: 'Host isolated' }
  }
  return { icon: AlertTriangle, tone: 'warn', title: 'Watch condition' }
}

export default function DetectionToast({ events }) {
  const [current, setCurrent] = useState(null)
  const lastIdRef = useRef(null)
  const timerRef = useRef(null)

  useEffect(() => {
    const hit = events.find(e => {
      const t = (e.tag ?? e.event_type ?? '').toUpperCase()
      return WATCH.some(w => t.includes(w))
    })
    if (!hit) return
    const id = hit._id ?? hit.id ?? hit.timestamp
    if (id != null && id === lastIdRef.current) return
    lastIdRef.current = id
    setCurrent(hit)
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setCurrent(null), 4200)
  }, [events])

  useEffect(() => () => clearTimeout(timerRef.current), [])

  const meta = current ? toastMeta(current.tag ?? current.event_type) : null
  const Icon = meta?.icon

  return (
    <div className="wf-toast-layer">
      <AnimatePresence>
        {current && meta && (
          <motion.div
            key={current._id ?? 'detect-toast'}
            className={`wf-toast wf-toast--${meta.tone}`}
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 16, opacity: 0 }}
            transition={SPRING.snappy}
            role="status"
          >
            <Icon size={16} aria-hidden="true" />
            <div>
              <div className="wf-toast-title">{meta.title}</div>
              <div className="wf-toast-msg">
                {current.node_id ? `${current.node_id} · ` : ''}
                {String(current.message ?? current.tag ?? '').slice(0, 70)}
              </div>
              <div className="wf-toast-time">{formatRelativeTime(current._received, current.ts)}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
