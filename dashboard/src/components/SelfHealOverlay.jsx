// SelfHealOverlay — cinematic DETECT → ISOLATE → RECONFIGURE → RECOVER
// Plays automatically when GhostNet quarantines a node.
import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Radar, Ban, Route, CheckCircle2, ShieldCheck } from 'lucide-react'
import { SPRING } from '../motion.js'

const PHASES = [
  { id: 'DETECT',     title: 'Anomaly detected',       sub: 'Amber indicator · ML + rule engines agree',   icon: Radar,        color: '#f59e0b', dur: 950 },
  { id: 'ISOLATE',    title: 'Isolating compromised node', sub: 'Traffic halted · firewall rules applied',   icon: Ban,          color: '#ef4444', dur: 1200 },
  { id: 'RECONFIGURE',title: 'Calculating alternative path', sub: 'Re-routing around the isolated node…',     icon: Route,        color: '#8b5cf6', dur: 2200 },
  { id: 'RECOVER',    title: 'Network recovered',       sub: 'Service restored via the new path',            icon: ShieldCheck,  color: '#22c55e', dur: 2600 },
]

export default function SelfHealOverlay({ nodes, events }) {
  const nodeList = Object.values(nodes)
  const quarantined = nodeList.filter(n => n.status === 'QUARANTINED')
  const healEvent = (events ?? []).find(e =>
    ['QUARANTINE', 'RECOVERED', 'SELF-HEAL', 'RECOVERY-CHECK'].includes(e.tag))

  const [phaseIdx, setPhaseIdx] = useState(-1)
  const [visible, setVisible] = useState(false)
  const timersRef = useRef([])
  const lastRunRef = useRef(null)
  const runKey = healEvent?._id ?? (quarantined.length > 0 ? 'q' : null)

  useEffect(() => {
    if (quarantined.length === 0 && !healEvent) {
      if (visible) { setVisible(false); setPhaseIdx(-1) }
      return
    }
    if (runKey === lastRunRef.current) return
    lastRunRef.current = runKey
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []
    setVisible(true)
    setPhaseIdx(0)

    let idx = 0
    const schedule = () => {
      if (idx >= PHASES.length) {
        setVisible(false)
        return
      }
      const t = setTimeout(() => {
        idx += 1
        setPhaseIdx(idx)
        if (idx < PHASES.length) schedule()
        else {
          const end = setTimeout(() => setVisible(false), PHASES[idx - 1].dur)
          timersRef.current.push(end)
        }
      }, PHASES[idx].dur)
      timersRef.current.push(t)
    }
    schedule()
    const clearWatch = setTimeout(() => {
      if (quarantined.length === 0) setPhaseIdx(PHASES.length - 1)
    }, 2000)
    timersRef.current.push(clearWatch)
    return () => { timersRef.current.forEach(clearTimeout); timersRef.current = [] }
  }, [runKey, quarantined.length, healEvent, visible])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="selfheal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <motion.div
            className="selfheal-card"
            initial={{ scale: 0.94, y: 16, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.97, y: 10, opacity: 0 }}
            transition={SPRING.bouncy}
          >
            {/* Title bar */}
            <div className="selfheal-top">
              <span style={{ fontSize: 10, letterSpacing: '0.2em', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                GHOSTNET · SELF-HEALING PROTOCOL
              </span>
              {quarantined.length > 0 && (
                <span className="selfheal-qcount">QUARANTINED {quarantined.length}</span>
              )}
            </div>

            {/* Stage bar */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 26 }}>
              {PHASES.map((p, i) => {
                const state = i < phaseIdx || (phaseIdx === PHASES.length) ? 'done' : i === phaseIdx ? 'active' : 'idle'
                return (
                  <div key={p.id} style={{ flex: 1, height: 3, borderRadius: 2, overflow: 'hidden', background: 'var(--border)' }}>
                    <motion.div
                      style={{ height: '100%', borderRadius: 2, background: p.color }}
                      animate={{ width: state === 'active' ? '100%' : state === 'done' ? '100%' : '0%' }}
                      transition={{ duration: state === 'active' ? p.dur / 1000 : 0.3, ease: 'easeInOut' }}
                    />
                  </div>
                )
              })}
            </div>

            <AnimatePresence mode="wait">
              {phaseIdx >= 0 && phaseIdx < PHASES.length && (
                <motion.div
                  key={PHASES[phaseIdx].id}
                  style={{ textAlign: 'center' }}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={SPRING.gentle}
                >
                  <div
                    style={{
                      width: 58, height: 58, margin: '0 auto 16px', borderRadius: 16,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: `${PHASES[phaseIdx].color}16`, border: `1px solid ${PHASES[phaseIdx].color}45`,
                      color: PHASES[phaseIdx].color,
                    }}
                  >
                    {(() => { const Icon = PHASES[phaseIdx].icon; return <Icon size={26} /> })()}
                  </div>

                  <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', letterSpacing: '0.05em' }}>
                    {PHASES[phaseIdx].title.toUpperCase()}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                    {PHASES[phaseIdx].sub}
                  </div>
                  <AnimatePresence>
                    {phaseIdx === 2 && (
                      <motion.div
                        className="selfheal-dots"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                      >
                        {[0, 1, 2, 3, 4].map(i => (
                          <motion.span
                            key={i}
                            className="selfheal-dot"
                            style={{ background: i < 3 ? '#8b5cf6' : i === 3 ? '#8b5cf655' : 'transparent', border: '1px solid #8b5cf6' }}
                            animate={{ opacity: [0.25, 1, 0.25], scale: [0.85, 1, 0.85] }}
                            transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.22 }}
                          />
                        ))}
                        <span className="selfheal-dot-label">FOUND ALTERNATIVE PATH</span>
                      </motion.div>
                    )}
                    {phaseIdx === 3 && (
                      <motion.div
                        style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 7, alignItems: 'center' }}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ ...SPRING.gentle, delay: 0.2 }}
                      >
                        {[
                          'Network recovered',
                          quarantined.length > 0 ? 'Compromised node isolated' : 'Node released back to network',
                          'Traffic re-routed through the alternative path',
                        ].map(line => (
                          <div key={line} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11, color: 'var(--status-healthy)', fontFamily: 'var(--font-mono)' }}>
                            <CheckCircle2 size={12} /> {line}
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}