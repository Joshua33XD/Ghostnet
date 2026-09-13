// DetectionToast — top-right spring notification when the backend flags an anomaly
import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, ShieldAlert } from 'lucide-react'
import { SPRING } from '../motion.js'
import { getEventIcon, formatRelativeTime } from '../utils.js'

const WATCH = ['SUSPICIOUS', 'ATTACK', 'THREAT', 'QUARANTINE', 'WARN', 'ANOMALY']

function toastMeta(tag) {
  const t = (tag ?? '').toUpperCase()
  if (t.startsWith('THREAT') || t.includes('ATTACK')) {
    return { icon: ShieldAlert, color: 'var(--status-danger)', title: 'Threat detected' }
  }
  if (t.includes('QUARANTINE')) {
    return { icon: ShieldAlert, color: 'var(--status-danger)', title: 'Node quarantined' }
  }
  return { icon: AlertTriangle, color: 'var(--status-warn)', title: 'Suspicious behaviour detected' }
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

  return (
    <div style={{ position: 'fixed', top: 68, right: 20, zIndex: 1200, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
      <AnimatePresence>
        {current && (
          <motion.div
            key={current._id ?? 'detect-toast'}
            className="detection-toast"
            initial={{ x: 60, opacity: 0, scale: 0.95 }}
            animate={{ x: 0, opacity: 1, scale: 1 }}
            exit={{ x: 40, opacity: 0, scale: 0.97 }}
            transition={SPRING.snappy}
            style={{ ['--toast-color']: toastMeta(current.tag ?? current.event_type).color }}
          >
            <div
              className="detection-toast-icon"
              style={{ color: toastMeta(current.tag ?? current.event_type).color }}
            >
              {(() => { const { icon: Icon } = toastMeta(current.tag ?? current.event_type); return <Icon size={15} /> })()}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
              <div className="detection-toast-title">
                {toastMeta(current.tag ?? current.event_type).title}
              </div>
              <div className="detection-toast-msg">
                {current.node_id ? `${current.node_id} · ` : ''}
                {String(current.message ?? current.tag ?? '').slice(0, 70)}
              </div>
              <div className="detection-toast-time">
                {getEventIcon(current.tag)} {formatRelativeTime(current._received, current.ts)}
              </div>
            </div>
            {current.node_id && (
              <span className="detection-toast-tag">{current.node_id}</span>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}