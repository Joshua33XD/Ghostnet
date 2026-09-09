// EventLog — staggered entry animations
import { useRef, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { getEventIcon, isCriticalTag, isGoodTag, formatRelativeTime, formatExactTime } from '../utils.js'
import { stagger, fadeUp } from '../motion.js'

export default function EventLog({ events, onClear, wsStatus }) {
  const listRef = useRef(null)
  const [atBottom, setAtBottom] = useState(true)
  const [newCount, setNewCount] = useState(0)

  // Track whether user is scrolled to top (newest events are at top)
  useEffect(() => {
    if (events.length > 0 && !atBottom) {
      setNewCount(c => c + 1)
    }
  }, [events.length]) // eslint-disable-line

  const scrollToTop = () => {
    listRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
    setNewCount(0)
    setAtBottom(true)
  }

  const handleScroll = (e) => {
    const el = e.currentTarget
    setAtBottom(el.scrollTop < 80)
    if (el.scrollTop < 80) setNewCount(0)
  }

  return (
    <div className="right-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="event-log-header">
        <h3>⚡ Live Events</h3>
        <button className="event-log-clear" onClick={() => { onClear(); setNewCount(0) }}>
          Clear
        </button>
      </div>

      {wsStatus === 'connecting' && events.length === 0 ? (
        <EventLogSkeleton />
      ) : events.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📡</div>
          <h3>Waiting for events</h3>
          <p>Start GhostNet and connect a node to see live events here.</p>
        </div>
      ) : (
        <motion.div
          className="event-log-list"
          ref={listRef}
          onScroll={handleScroll}
          variants={stagger(0.04)}
          initial="hidden"
          animate="visible"
        >
          <AnimatePresence initial={false}>
            {events.map(evt => (
              <MotionEventItem key={evt._id} evt={evt} />
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {newCount > 0 && !atBottom && (
        <div className="new-events-banner" onClick={scrollToTop}>
          ↑ {newCount} new event{newCount > 1 ? 's' : ''} — scroll to top
        </div>
      )}
    </div>
  )
}

function MotionEventItem({ evt }) {
  const critical = isCriticalTag(evt.tag)
  const good = isGoodTag(evt.tag)

  const cls = [
    'event-item',
    critical ? 'critical' : '',
    good ? 'recovered' : '',
  ].filter(Boolean).join(' ')

  const tagClass = evt.tag?.replace(/\s+/g, '-') ?? 'INFO'

  return (
    <motion.div
      className={cls}
      variants={fadeUp}
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0, transition: { duration: 0.25 } }}
      exit={{ opacity: 0, x: -20, transition: { duration: 0.15 } }}
    >
      <span className="event-icon">{getEventIcon(evt.tag)}</span>

      <div className="event-meta">
        <span className={`event-tag ${tagClass}`}>{evt.tag}</span>
        {evt.node_id && (
          <span className="event-node">{evt.node_id}</span>
        )}
        <span
          className="event-ts"
          title={formatExactTime(evt._received, evt.ts)}
          style={{ cursor: 'default' }}
        >
          {formatRelativeTime(evt._received, evt.ts)}
        </span>
      </div>

      <div className="event-msg">{evt.message}</div>
    </motion.div>
  )
}

function EventLogSkeleton() {
  return (
    <div className="event-log-list" style={{ padding: '8px 5px' }}>
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '20px 1fr', gap: '0 7px', padding: '7px', marginBottom: 2 }}>
          <div className="skeleton-block" style={{ width: 14, height: 14, borderRadius: '50%', marginTop: 1 }} />
          <div>
            <div className="skeleton-block" style={{ height: 9, width: `${55 + i * 8}%`, borderRadius: 3, marginBottom: 6 }} />
            <div className="skeleton-block" style={{ height: 8, width: `${40 + i * 10}%`, borderRadius: 3 }} />
          </div>
        </div>
      ))}
    </div>
  )
}
