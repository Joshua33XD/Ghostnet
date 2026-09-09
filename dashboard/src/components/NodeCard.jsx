// NodeCard — trust-first hierarchy with Framer Motion micro-interactions
import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { getTrustScore, getTrustColor, formatElapsed, formatRate, formatBytes } from '../utils.js'
import ThreatBadge from './ThreatBadge.jsx'
import OSIBadge from './OSIBadge.jsx'
import MLScore from './MLScore.jsx'
import LifecycleStepper from './LifecycleStepper.jsx'
import { AreaChart, Area, ResponsiveContainer, Tooltip as RTooltip } from 'recharts'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { fadeUp, SPRING } from '../motion.js'

/* ── Skeleton ─────────────────────────────────────────────── */
export function NodeCardSkeleton() {
  return (
    <div className="skeleton-card">
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:12 }}>
        <div className="skeleton-block" style={{ height:13, width:'55%', borderRadius:4 }} />
        <div className="skeleton-block" style={{ height:20, width:'25%', borderRadius:4 }} />
      </div>
      <div className="skeleton-block" style={{ height:36, width:'40%', borderRadius:6, marginBottom:12 }} />
      <div className="skeleton-block" style={{ height:9, width:'70%', borderRadius:3, marginBottom:8 }} />
      <div className="skeleton-block" style={{ height:9, width:'50%', borderRadius:3 }} />
    </div>
  )
}

/* ── Status symbol for accessibility (not color-only) ─────── */
function statusSymbol(status) {
  if (status === 'HEALTHY')    return '●'
  if (status === 'SUSPICIOUS') return '▲'
  if (status === 'QUARANTINED') return '■'
  return '○'
}

/* ── Primary reason text from threats ──────────────────────── */
function getPrimaryReason(node) {
  if (!node) return null
  // prefer active_threats array if available
  const threats = node.active_threats ?? node.threat_details ?? []
  if (threats.length > 0) {
    const top = threats[0]
    if (typeof top === 'string') return top
    if (top.reason) return top.reason
    if (top.threat_type) return top.threat_type.replace(/_/g, ' ').toLowerCase()
    if (top.type) return top.type.replace(/_/g, ' ').toLowerCase()
  }
  // fallback: derive from status
  if (node.status === 'QUARANTINED') return 'Threat threshold exceeded — node isolated'
  if (node.status === 'SUSPICIOUS') {
    if (node.anomaly_score > 0.6) return 'ML anomaly score elevated'
    if ((node.msg_rate ?? 0) > 5) return 'Unusual outbound message rate'
    return 'Anomalous behaviour detected'
  }
  return null
}

/* ── Mini sparkline ─────────────────────────────────────────── */
function Sparkline({ history, color }) {
  if (!history || history.length < 2) return null
  const data = history.map(h => ({ v: Math.round((1 - (h.score ?? 0)) * 100) }))
  return (
    <ResponsiveContainer width="100%" height={32}>
      <AreaChart data={data} margin={{ top:2, right:0, left:0, bottom:0 }}>
        <defs>
          <linearGradient id={`sg-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone" dataKey="v"
          stroke={color} strokeWidth={1.5}
          fill={`url(#sg-${color.replace('#','')})`}
          isAnimationActive={false}
        />
        <RTooltip
          contentStyle={{ background:'var(--surface-overlay)', border:'1px solid var(--border)', borderRadius:6, fontSize:11 }}
          labelStyle={{ display:'none' }}
          formatter={v => [`Trust ${v}%`]}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

/* ── Main NodeCard ──────────────────────────────────────────── */
export default function NodeCard({ node, onRelease, onSelect, history }) {
  const [expanded, setExpanded] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [flash, setFlash] = useState(null)
  const prevStatus = useRef(node?.status)

  // Status-change feedback (quarantine flash / recovery sweep)
  useEffect(() => {
    if (!node) return
    if (prevStatus.current && prevStatus.current !== node.status) {
      if (node.status === 'QUARANTINED') setFlash('danger')
      else if (node.status === 'HEALTHY') setFlash('recover')
      else if (node.status === 'SUSPICIOUS') setFlash('warn')
      const t = setTimeout(() => setFlash(null), 900)
      prevStatus.current = node.status
      return () => clearTimeout(t)
    }
    prevStatus.current = node?.status
  }, [node])

  if (!node) return null

  const trustPct   = Math.round(getTrustScore(node.anomaly_score ?? 0) * 100)
  const trustColor = getTrustColor(node.anomaly_score ?? 0)
  const reason     = getPrimaryReason(node)
  const uptime     = formatElapsed(node.first_seen)

  // Build "details" items — all the technical depth
  const detailStats = [
    { label:'Anomaly',  value:(node.anomaly_score ?? 0).toFixed(4) },
    { label:'ML Score', value:(node.ml_score ?? 0).toFixed(3) },
    { label:'Fusion',   value:(node.fusion_score ?? node.anomaly_score ?? 0).toFixed(3) },
    { label:'Msg Rate', value:formatRate(node.ewma_rate ?? node.msg_rate) },
    { label:'Uptime',   value:uptime },
    { label:'Payload',  value:formatBytes(node.avg_payload ?? 0) },
  ]
  if (node.cpu_pct   != null) detailStats.push({ label:'CPU',     value:`${node.cpu_pct?.toFixed(0)}%` })
  if (node.ram_pct   != null) detailStats.push({ label:'RAM',     value:`${node.ram_pct?.toFixed(0)}%` })
  if (node.storage_pct != null) detailStats.push({ label:'Disk',  value:`${node.storage_pct?.toFixed(0)}%` })

  return (
    <motion.div
      className={`node-card ${node.status}`}
      onClick={() => onSelect?.(node)}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onSelect?.(node)}
      aria-label={`Node ${node.node_id} — ${node.status} — Trust ${trustPct}%`}
      variants={fadeUp}
      whileHover={{ y: -3, transition: SPRING.snappy }}
      whileTap={{ scale: 0.98 }}
      layout
    >
      {/* Status-change flash overlay */}
      <AnimatePresence>
        {flash && (
          <motion.div
            className="node-status-flash"
            style={{
              ['--flash-color']: flash === 'danger' ? 'var(--status-danger)' : flash === 'warn' ? 'var(--status-warn)' : 'var(--status-healthy)',
            }}
            initial={{ opacity: 0.55, scale: 0.99 }}
            animate={{ opacity: 0, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.9, ease: 'easeOut' }}
          />
        )}
      </AnimatePresence>
      {/* ── LEVEL 1: Identity + Status ─────────────────────── */}
      <div className="node-card-header">
        <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
          <span className="node-id">{node.node_id}</span>
          {node.ip_address && (
            <span style={{ fontSize:'var(--text-xs)', color:'var(--text-muted)', fontFamily:'var(--font-mono)' }}>
              {node.ip_address}
            </span>
          )}
        </div>
        <span className={`node-status-pill ${node.status}`}>
          {statusSymbol(node.status)} {node.status}
        </span>
      </div>

      {/* ── LEVEL 2: Trust Score (hero metric) ─────────────── */}
      <div style={{ display:'flex', alignItems:'flex-end', gap:8, marginBottom:8 }}>
        <span className="node-trust-score" style={{ color: trustColor }}>
          {trustPct}
        </span>
        <div style={{ paddingBottom:4 }}>
          <div className="node-trust-label">/ 100  TRUST</div>
        </div>
        {/* Compact sparkline */}
        <div style={{ flex:1, minWidth:0 }}>
          <Sparkline history={history} color={trustColor} />
        </div>
      </div>

      {/* ── LEVEL 3: Reason (only for non-healthy) ─────────── */}
      {reason && node.status !== 'HEALTHY' && (
        <div className="node-reason">{reason}</div>
      )}

      {/* ── Lifecycle Stepper (compact) ─────────────────────── */}
      <LifecycleStepper status={node.status} reroutePath={node.reroute_path} compact />

      {/* ── Reroute badge ────────────────────────────────────── */}
      {node.reroute_path && (
        <div style={{
          marginTop:6, display:'flex', alignItems:'center', gap:5,
          padding:'3px 8px', borderRadius:6, fontSize:'var(--text-xs)',
          background:'rgba(139,92,246,0.1)', border:'1px solid rgba(139,92,246,0.3)',
          color:'#c4b5fd', fontFamily:'var(--font-mono)', fontWeight:700,
        }}>
          ⇄ {node.reroute_path}
        </div>
      )}

      {/* ── LEVEL 4: Expandable details ──────────────────────── */}
      <button
        className="node-details-toggle"
        onClick={e => { e.stopPropagation(); setExpanded(v => !v) }}
        aria-expanded={expanded}
      >
        {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
        {expanded ? 'Hide details' : 'Show technical details'}
      </button>

      {expanded && (
        <div style={{ marginTop:8, display:'flex', flexDirection:'column', gap:8 }}>
          {/* Stats grid */}
          <div className="node-stats">
            {detailStats.map(s => (
              <div className="node-stat" key={s.label}>
                <span className="node-stat-label">{s.label}</span>
                <span className="node-stat-value">{s.value}</span>
              </div>
            ))}
          </div>

          {/* Integrity hashes */}
          {(node.firmware_hash || node.config_hash) && (
            <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
              {node.firmware_hash && (
                <div style={{ fontSize:'var(--text-xs)', color:'var(--text-muted)', fontFamily:'var(--font-mono)' }}>
                  FW {node.firmware_hash.slice(0,12)}…
                  {node.firmware_changed && <span style={{ color:'var(--status-warn)', marginLeft:4 }}>CHANGED</span>}
                </div>
              )}
              {node.config_hash && (
                <div style={{ fontSize:'var(--text-xs)', color:'var(--text-muted)', fontFamily:'var(--font-mono)' }}>
                  CFG {node.config_hash.slice(0,12)}…
                  {node.config_changed && <span style={{ color:'var(--status-warn)', marginLeft:4 }}>CHANGED</span>}
                </div>
              )}
            </div>
          )}

          {/* Active threats */}
          {(node.active_threats ?? []).length > 0 && (
            <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
              {(node.active_threats ?? []).slice(0,4).map((t,i) => (
                <ThreatBadge key={i} threat={typeof t === 'string' ? { type:t } : t} />
              ))}
            </div>
          )}

          {/* OSI layer + ML score row */}
          <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
            {node.osi_layer && <OSIBadge layer={node.osi_layer} />}
            {node.ml_score != null && <MLScore score={node.ml_score} />}
          </div>
        </div>
      )}

      {/* ── Quarantine action ────────────────────────────────── */}
      {node.status === 'QUARANTINED' && onRelease && (
        <div onClick={e => e.stopPropagation()}>
          {!confirming ? (
            <button className="release-btn" onClick={() => setConfirming(true)}>
              ⚡ Release from Quarantine
            </button>
          ) : (
            <div className="confirm-release-panel">
              <div className="confirm-release-msg">
                Release <strong>{node.node_id}</strong> back to monitored network?
              </div>
              <div className="confirm-release-btns">
                <button
                  className="confirm-yes-btn"
                  onClick={() => { onRelease(node.node_id); setConfirming(false) }}
                >
                  Confirm
                </button>
                <button className="confirm-cancel-btn" onClick={() => setConfirming(false)}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </motion.div>
  )
}
