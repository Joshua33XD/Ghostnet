import { TrendingDown } from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RTooltip, Legend, ResponsiveContainer
} from 'recharts'
import { getTrustScore } from '../utils.js'

export default function TrustTrendChart({ scoreHistory, height = 160 }) {
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
    <ResponsiveContainer width="100%" height={height}>
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
