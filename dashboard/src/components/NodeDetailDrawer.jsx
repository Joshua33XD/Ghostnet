// NodeDetailDrawer — slide-in detail panel for a single node
import { useEffect, useRef } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts'
import { getStatusIcon, formatElapsed, formatRate, formatBytes } from '../utils.js'

const TIMELINE_TAGS = new Set(['QUARANTINE', 'RECOVERED', 'RECOVERY-CHECK', 'SELF-HEAL', 'PROTECT'])

/* ── Custom chart tooltip ──────────────────────────────────── */
function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: '#0a1020',
      border: '1px solid rgba(34,211,238,0.2)',
      borderRadius: 6, padding: '5px 10px',
      fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: '#e2e8f8',
    }}>
      score: <strong>{payload[0]?.value?.toFixed(4)}</strong>
    </div>
  )
}

function dotClass(tag) {
  if (tag === 'QUARANTINE') return 'QUARANTINE'
  if (tag === 'RECOVERED' || tag === 'SELF-HEAL') return 'RECOVERED'
  if (tag === 'RECOVERY-CHECK') return 'RECOVERY-CHECK'
  return 'default'
}

function scoreColor(score) {
  if (score >= 0.75) return '#ff3d6e'
  if (score >= 0.5)  return '#ff8c42'
  if (score >= 0.25) return '#ffd166'
  return '#00ff9d'
}

/* ── Component ─────────────────────────────────────────────── */
export default function NodeDetailDrawer({ node, history, events, onClose, onRelease }) {
  const drawerRef = useRef(null)

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  useEffect(() => { drawerRef.current?.focus() }, [])

  const nodeEvents   = events.filter(e => e.node_id === node.node_id)
  const timelineEvts = nodeEvents.filter(e => TIMELINE_TAGS.has(e.tag)).slice(0, 12)
  const mqttSamples  = nodeEvents.slice(0, 6)

  const chartData = (history || []).map((h, i) => ({
    i,
    score: h.score,
    ts: new Date(h.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
  }))

  const color    = scoreColor(node.anomaly_score ?? 0)
  const hasChart = chartData.length >= 2

  return (
    <div
      className="drawer-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Node detail: ${node.node_id}`}
    >
      <div
        className="drawer"
        ref={drawerRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ─────────────────────────────────────── */}
        <div className="drawer-header">
          <span style={{ fontSize: 15 }}>{getStatusIcon(node.status)}</span>
          <span className="drawer-node-id">{node.node_id}</span>
          <span className={`node-status-pill ${node.status}`}>{node.status}</span>
          <button className="drawer-close" onClick={onClose} aria-label="Close drawer">✕</button>
        </div>

        {/* ── Scrollable body ────────────────────────────── */}
        <div className="drawer-body">

          {/* 1 — Score history chart */}
          <div className="drawer-section">
            <div className="drawer-section-title">EWMA Score History</div>
            {hasChart ? (
              <ResponsiveContainer width="100%" height={155}>
                <LineChart data={chartData} margin={{ top: 4, right: 6, bottom: 0, left: -22 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis
                    dataKey="ts"
                    tick={{ fontSize: 7.5, fill: '#3d4d6e', fontFamily: 'JetBrains Mono' }}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    domain={[0, 1]}
                    tick={{ fontSize: 7.5, fill: '#3d4d6e', fontFamily: 'JetBrains Mono' }}
                    tickLine={false}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <ReferenceLine y={0.75} stroke="rgba(239,68,68,0.35)" strokeDasharray="4 2" />
                  <Line
                    type="monotone" dataKey="score"
                    stroke={color} strokeWidth={2} dot={false}
                    isAnimationActive={false}
                    style={{ filter: `drop-shadow(0 0 5px ${color}88)` }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: 155, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 11 }}>
                Collecting data — waiting for more score points…
              </div>
            )}
          </div>

          {/* 2 — Stats grid */}
          <div className="drawer-section">
            <div className="drawer-section-title">Node Statistics</div>
            <div className="drawer-stats-grid">
              <div className="drawer-stat">
                <div className="drawer-stat-label">Anomaly Score</div>
                <div className="drawer-stat-value" style={{ color }}>{(node.anomaly_score ?? 0).toFixed(4)}</div>
              </div>
              <div className="drawer-stat">
                <div className="drawer-stat-label">Msg Rate</div>
                <div className="drawer-stat-value">{formatRate(node.ewma_rate)}</div>
              </div>
              <div className="drawer-stat">
                <div className="drawer-stat-label">Avg Payload</div>
                <div className="drawer-stat-value">{formatBytes(node.ewma_payload)}</div>
              </div>
              <div className="drawer-stat">
                <div className="drawer-stat-label">Total Messages</div>
                <div className="drawer-stat-value">{(node.message_count ?? 0).toLocaleString()}</div>
              </div>
              <div className="drawer-stat">
                <div className="drawer-stat-label">Last Seen</div>
                <div className="drawer-stat-value">{formatElapsed(node.last_seen)}</div>
              </div>
              <div className="drawer-stat">
                <div className="drawer-stat-label">Heartbeat</div>
                <div className="drawer-stat-value">{formatElapsed(node.last_heartbeat)}</div>
              </div>
              {node.last_cpu_pct != null && (
                <div className="drawer-stat">
                  <div className="drawer-stat-label">CPU</div>
                  <div className="drawer-stat-value" style={{ color: node.last_cpu_pct > 80 ? 'var(--red)' : 'inherit' }}>
                    {node.last_cpu_pct.toFixed(0)}%
                  </div>
                </div>
              )}
              {node.last_ram_pct != null && (
                <div className="drawer-stat">
                  <div className="drawer-stat-label">RAM</div>
                  <div className="drawer-stat-value" style={{ color: node.last_ram_pct > 85 ? 'var(--red)' : 'inherit' }}>
                    {node.last_ram_pct.toFixed(0)}%
                  </div>
                </div>
              )}
              {node.last_storage_pct != null && (
                <div className="drawer-stat">
                  <div className="drawer-stat-label">Storage</div>
                  <div className="drawer-stat-value" style={{ color: node.last_storage_pct > 90 ? 'var(--red)' : 'inherit' }}>
                    {node.last_storage_pct.toFixed(0)}%
                  </div>
                </div>
              )}
              {node.last_firmware_hash && (
                <div className="drawer-stat" style={{ gridColumn: 'span 3' }}>
                  <div className="drawer-stat-label">Firmware Integrity</div>
                  <div className="drawer-stat-value" style={{ fontSize: 9.5, color: (node.active_threats ?? []).includes('firmware_tamper') ? 'var(--red)' : 'var(--green)' }}>
                    {(node.active_threats ?? []).includes('firmware_tamper') ? '⚠ TAMPERED' : '✓ VERIFIED'}
                    &nbsp;·&nbsp;{node.last_firmware_hash.slice(0, 20)}…
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 3 — Quarantine timeline */}
          <div className="drawer-section">
            <div className="drawer-section-title">Quarantine Timeline</div>
            {timelineEvts.length === 0 ? (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', padding: '8px 0' }}>
                No quarantine events recorded for this node.
              </div>
            ) : (
              <div className="drawer-timeline">
                {timelineEvts.map(evt => (
                  <div key={evt._id} className="timeline-entry">
                    <div className={`timeline-dot ${dotClass(evt.tag)}`} />
                    <div className="timeline-content">
                      <div className="timeline-tag">{evt.tag}</div>
                      <div className="timeline-msg">{evt.message}</div>
                    </div>
                    <div className="timeline-ts">{evt.ts}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 4 — Recent event samples */}
          <div className="drawer-section">
            <div className="drawer-section-title">
              Recent Events&nbsp;
              <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>({mqttSamples.length})</span>
            </div>
            {mqttSamples.length === 0 ? (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', padding: '8px 0' }}>
                No events received for this node yet.
              </div>
            ) : (
              mqttSamples.map(evt => (
                <div key={evt._id} className="mqtt-sample">
                  <div className="mqtt-sample-tag">[{evt.tag}]&nbsp;&nbsp;{evt.ts}</div>
                  {evt.message}
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── Footer release action ───────────────────────── */}
        {node.status === 'QUARANTINED' && onRelease && (
          <div className="drawer-actions">
            <button
              className="release-btn"
              style={{ margin: 0, flex: 1 }}
              onClick={() => { onRelease(node.node_id); onClose() }}
            >
              ⚡ Release from Quarantine
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
