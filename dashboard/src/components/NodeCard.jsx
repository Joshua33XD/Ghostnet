// NodeCard — full visual upgrade with sparkline + radial score gauge
import { getScoreClass, getStatusIcon, formatElapsed, formatRate, formatBytes } from '../utils.js'
import ThreatBadge from './ThreatBadge.jsx'
import {
  AreaChart, Area, ResponsiveContainer, Tooltip as RTooltip
} from 'recharts'

function RadialGauge({ score }) {
  const pct = Math.min(score, 1)
  const r = 28
  const circ = 2 * Math.PI * r
  const dash = circ * pct
  const color = pct >= 0.75 ? '#ff3d6e' : pct >= 0.5 ? '#ff8c42' : pct >= 0.25 ? '#ffd166' : '#00ff9d'
  const glow = pct >= 0.75 ? 'rgba(255,61,110,0.6)' : pct >= 0.5 ? 'rgba(255,140,66,0.5)' : 'rgba(0,255,157,0.4)'

  return (
    <svg width={72} height={72} viewBox="0 0 72 72">
      <defs>
        <filter id={`glow-${Math.round(pct * 100)}`}>
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      {/* Track */}
      <circle cx={36} cy={36} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={5} />
      {/* Fill */}
      <circle
        cx={36} cy={36} r={r}
        fill="none"
        stroke={color}
        strokeWidth={5}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        transform="rotate(-90 36 36)"
        style={{ filter: `drop-shadow(0 0 4px ${glow})`, transition: 'stroke-dasharray 0.6s ease' }}
      />
      {/* Label */}
      <text x={36} y={39} textAnchor="middle" fontSize={11} fontWeight={700}
        fontFamily="JetBrains Mono, monospace" fill={color}>
        {(pct * 100).toFixed(0)}%
      </text>
    </svg>
  )
}

function Sparkline({ history, status }) {
  if (!history || history.length < 2) {
    return <div style={{ height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.15)', fontSize: 10 }}>no data</div>
  }
  const color = status === 'QUARANTINED' ? '#ff3d6e' : status === 'SUSPICIOUS' ? '#ffd166' : '#00c8ff'
  const data = history.map((h, i) => ({ i, v: h.score }))
  return (
    <ResponsiveContainer width="100%" height={44}>
      <AreaChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={`sg-${status}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.4} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={1.5}
          fill={`url(#sg-${status})`}
          dot={false}
          isAnimationActive={false}
        />
        <RTooltip
          content={({ active, payload }) =>
            active && payload?.[0]
              ? <div style={{ background: '#0d1526', border: '1px solid rgba(0,200,255,0.2)', borderRadius: 4, padding: '2px 6px', fontSize: 10, color: '#e8f0ff', fontFamily: 'monospace' }}>{payload[0].value.toFixed(4)}</div>
              : null
          }
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

export default function NodeCard({ node, onRelease, history }) {
  const scoreClass = getScoreClass(node.anomaly_score)
  const threats = node.active_threats ?? []

  return (
    <div className={`node-card ${node.status}`}>
      {/* Animated background glow for quarantined */}
      {node.status === 'QUARANTINED' && <div className="card-threat-overlay" />}

      {/* Header row */}
      <div className="node-card-header">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span className="node-id">
            {getStatusIcon(node.status)}&nbsp;{node.node_id}
          </span>
          <span style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            {node.message_count?.toLocaleString() ?? 0} msgs · last {formatElapsed(node.last_seen)}
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <span className={`node-status-pill ${node.status}`}>{node.status}</span>
          <RadialGauge score={node.anomaly_score ?? 0} />
        </div>
      </div>

      {/* Active threat badges */}
      {threats.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
          {threats.map(t => <ThreatBadge key={t} threatName={t} />)}
        </div>
      )}

      {/* Score sparkline */}
      <div className="sparkline-wrap">
        <div className="sparkline-label">
          <span>EWMA Score History</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: scoreClass === 'critical' ? 'var(--red)' : scoreClass === 'high' ? 'var(--orange)' : 'var(--text-secondary)' }}>
            {(node.anomaly_score ?? 0).toFixed(4)}
          </span>
        </div>
        <Sparkline history={history} status={node.status} />
      </div>

      {/* Stats grid */}
      <div className="node-stats">
        <div className="node-stat">
          <div className="node-stat-label">Msg Rate</div>
          <div className="node-stat-value">{formatRate(node.ewma_rate)}</div>
        </div>
        <div className="node-stat">
          <div className="node-stat-label">Avg Payload</div>
          <div className="node-stat-value">{formatBytes(node.ewma_payload)}</div>
        </div>
        <div className="node-stat">
          <div className="node-stat-label">Total Msgs</div>
          <div className="node-stat-value">{(node.message_count ?? 0).toLocaleString()}</div>
        </div>
        <div className="node-stat">
          <div className="node-stat-label">Heartbeat</div>
          <div className="node-stat-value">{formatElapsed(node.last_heartbeat)}</div>
        </div>

        {node.last_cpu_pct != null && (
          <div className="node-stat">
            <div className="node-stat-label">CPU</div>
            <div className="node-stat-value" style={{ color: node.last_cpu_pct > 80 ? 'var(--red)' : node.last_cpu_pct > 60 ? 'var(--yellow)' : 'inherit' }}>
              {node.last_cpu_pct.toFixed(0)}%
            </div>
          </div>
        )}
        {node.last_ram_pct != null && (
          <div className="node-stat">
            <div className="node-stat-label">RAM</div>
            <div className="node-stat-value" style={{ color: node.last_ram_pct > 85 ? 'var(--red)' : 'inherit' }}>
              {node.last_ram_pct.toFixed(0)}%
            </div>
          </div>
        )}
        {node.last_storage_pct != null && (
          <div className="node-stat">
            <div className="node-stat-label">Storage</div>
            <div className="node-stat-value" style={{ color: node.last_storage_pct > 90 ? 'var(--red)' : 'inherit' }}>
              {node.last_storage_pct.toFixed(0)}%
            </div>
          </div>
        )}

        {node.last_firmware_hash && (
          <div className="node-stat" style={{ gridColumn: 'span 3' }}>
            <div className="node-stat-label">Firmware Integrity</div>
            <div className="node-stat-value" style={{ fontSize: 9, color: threats.includes('firmware_tamper') ? 'var(--red)' : 'var(--green)' }}>
              {threats.includes('firmware_tamper') ? '⚠ TAMPERED' : '✓ VERIFIED'}&nbsp;·&nbsp;{node.last_firmware_hash.slice(0, 16)}…
            </div>
          </div>
        )}
        {node.last_config_hash && (
          <div className="node-stat" style={{ gridColumn: 'span 3' }}>
            <div className="node-stat-label">Config Integrity</div>
            <div className="node-stat-value" style={{ fontSize: 9, color: threats.includes('config_tamper') ? 'var(--red)' : 'var(--green)' }}>
              {threats.includes('config_tamper') ? '⚠ TAMPERED' : '✓ VERIFIED'}&nbsp;·&nbsp;{node.last_config_hash.slice(0, 16)}…
            </div>
          </div>
        )}
      </div>

      {/* Quarantine metadata */}
      {node.status === 'QUARANTINED' && node.quarantine_time && (
        <div className="quarantine-tag">
          🔒 Quarantined {formatElapsed(node.quarantine_time)} ago
        </div>
      )}
      {node.recovery_time && node.status === 'HEALTHY' && (
        <div className="recovery-tag">
          ✓ Recovered {formatElapsed(node.recovery_time)} ago
        </div>
      )}

      {/* Manual release */}
      {node.status === 'QUARANTINED' && onRelease && (
        <button className="release-btn" onClick={() => onRelease(node.node_id)}>
          ⚡ Manual Release
        </button>
      )}
    </div>
  )
}
