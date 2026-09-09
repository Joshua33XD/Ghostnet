import { TrendingDown } from 'lucide-react'
import { motion } from 'framer-motion'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RTooltip, Legend, ResponsiveContainer
} from 'recharts'
import { getTrustScore } from '../utils.js'
import { SPRING, stagger, fadeUp } from '../motion.js'

function TrustTrendChart({ scoreHistory }) {
  const nodeIds = Object.keys(scoreHistory).slice(0, 5)
  if (nodeIds.length === 0) return (
    <div className="glass-empty-state" style={{ padding: 24 }}>
      <TrendingDown size={24} style={{ opacity: 0.2 }} />
      <span style={{ fontSize: 'var(--text-xs)' }}>Collecting data…</span>
    </div>
  )
  const maxLen = Math.max(...nodeIds.map(id => scoreHistory[id]?.length ?? 0))
  const data = Array.from({ length: Math.min(maxLen, 20) }, (_, i) => {
    const entry = { idx: i }
    nodeIds.forEach(id => {
      const arr = scoreHistory[id] ?? []
      const pt = arr[arr.length - Math.min(maxLen, 20) + i]
      entry[id] = pt ? Math.round(getTrustScore(pt.score) * 100) : null
    })
    return entry
  })
  const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ef4444']
  return (
    <ResponsiveContainer width="100%" height={140}>
      <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
        <XAxis dataKey="idx" tick={{ fontSize: 9, fill: 'var(--text-muted)' }} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: 'var(--text-muted)' }} />
        <RTooltip
          contentStyle={{ background: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 11 }}
          formatter={v => [`${v}%`]}
        />
        <Legend wrapperStyle={{ fontSize: 10 }} />
        {nodeIds.map((id, i) => (
          <Line key={id} type="monotone" dataKey={id}
            stroke={COLORS[i % COLORS.length]}
            strokeWidth={1.5} dot={false}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

function AnomalyTable({ events }) {
  const anomalies = events
    .filter(e => {
      const t = (e.event_type ?? e.tag ?? '').toUpperCase()
      return ['QUARANTINE', 'ATTACK', 'SUSPICIOUS', 'WARN', 'ANOMALY', 'THREAT'].some(x => t.includes(x))
    })
    .slice(0, 6)

  if (anomalies.length === 0) return (
    <div style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)', textAlign: 'center', padding: 16 }}>
      No anomalies detected
    </div>
  )

  return (
    <motion.div variants={stagger(0.08)} initial="hidden" animate="visible">
      {anomalies.map((e, i) => {
        const t = (e.event_type ?? e.tag ?? '').toUpperCase()
        const actionClass = t.includes('QUARANTINE') ? 'investigating' : t.includes('RECOVERED') ? 'resolved' : 'monitoring'
        const actionLabel = t.includes('QUARANTINE') ? 'Investigating' : t.includes('RECOVERED') ? 'Resolved' : 'Monitoring'
        const time = e.timestamp
          ? new Date(e.timestamp * 1000).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
          : '—'
        return (
          <motion.div key={e.id ?? i} className="anomaly-row" variants={fadeUp}>
            <span className="anomaly-time">{time}</span>
            <span className="anomaly-node">{e.node_id ?? '—'}</span>
            <span className="anomaly-type">{e.message?.slice(0, 40) ?? t}</span>
            <span className={`anomaly-action ${actionClass}`}>{actionLabel}</span>
          </motion.div>
        )
      })}
    </motion.div>
  )
}

export function MLGauge({ nodes }) {
  const list = Object.values(nodes)
  const avg = list.length
    ? list.reduce((s, n) => s + (n.anomaly_score ?? 0), 0) / list.length
    : 0
  const trust = Math.round((1 - avg) * 100)
  const r = 52
  const color = trust >= 75 ? 'var(--status-healthy)' : trust >= 50 ? 'var(--status-warn)' : 'var(--status-danger)'
  return (
    <motion.div
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={SPRING.gentle}
    >
      <svg width={130} height={130} viewBox="0 0 130 130">
        <circle cx={65} cy={65} r={r} fill="none" stroke="var(--border)" strokeWidth={8} />
        <motion.circle
          cx={65} cy={65} r={r} fill="none"
          stroke={color} strokeWidth={8}
          strokeLinecap="round"
          transform="rotate(-90 65 65)"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: trust / 100 }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        />
        <text x={65} y={60} textAnchor="middle" fill="var(--text-primary)"
          fontSize={22} fontWeight="700" fontFamily="var(--font-mono)">
          <motion.tspan
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >{trust}%</motion.tspan>
        </text>
        <text x={65} y={76} textAnchor="middle" fill="var(--text-muted)"
          fontSize={9}>Anomaly Score</text>
        <text x={65} y={90} textAnchor="middle" fill={color}
          fontSize={9} fontWeight="700">Model: Isolation Forest</text>
      </svg>
      <div className="ml-gauge-label">
        Avg anomaly: {avg.toFixed(4)}<br />
        {trust >= 75 ? '✓ Network healthy' : trust >= 50 ? '⚠ Elevated risk' : '⛔ Critical threat level'}
      </div>
    </motion.div>
  )
}

export default function ThreatAnalysisPanel({ nodes, events, scoreHistory, compact = false }) {
  return (
    <div className={`threat-analysis-panel${compact ? ' threat-analysis-panel--compact' : ''}`}>
      <div className="threat-analysis-main">
        <div>
          <div className="panel-subtitle">Trust Score Trend</div>
          <TrustTrendChart scoreHistory={scoreHistory} />
        </div>
        <div className="threat-analysis-anomalies">
          <div className="panel-subtitle">Detected Anomalies</div>
          <AnomalyTable events={events} />
        </div>
      </div>
      {!compact && (
        <div className="threat-analysis-gauge">
          <div className="panel-subtitle">ML Analysis</div>
          <MLGauge nodes={nodes} />
        </div>
      )}
    </div>
  )
}
