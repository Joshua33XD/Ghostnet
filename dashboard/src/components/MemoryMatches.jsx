// MemoryMatches.jsx — immune memory match list
// Displays similar historical incidents from immune memory.
import React from 'react'

function simBar(sim) {
  const pct = Math.round(sim * 100)
  const color = sim >= 0.9 ? '#ef4444' : sim >= 0.8 ? '#f97316' : '#eab308'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ flex: 1, height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.07)' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 2 }} />
      </div>
      <span style={{ fontSize: 9, color, fontWeight: 700, minWidth: 28 }}>{pct}%</span>
    </div>
  )
}

function timeAgo(ts) {
  const diff = (Date.now() / 1000) - ts
  if (diff < 60)   return `${Math.floor(diff)}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  return `${Math.floor(diff / 3600)}h ago`
}

export default function MemoryMatches({ matches = [] }) {
  if (!matches || matches.length === 0) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{
        fontSize: 10, fontWeight: 700, color: 'var(--text-muted)',
        textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2,
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <span style={{ color: '#f59e0b' }}>🧬</span>
        Immune Memory Matches ({matches.length})
      </div>

      {matches.map((m, i) => (
        <div key={m.incident_id ?? i} style={{
          padding: '6px 10px', borderRadius: 6,
          background: 'rgba(245,158,11,0.08)',
          border: '1px solid rgba(245,158,11,0.2)',
          display: 'flex', flexDirection: 'column', gap: 4,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b' }}>
              #{m.incident_id} — {m.attack_category}
            </span>
            <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>
              {m.osi_layer ? `L${m.osi_layer}` : '?'} · {timeAgo(m.timestamp)}
            </span>
          </div>
          <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 2 }}>
            node: {m.node_id}
          </div>
          {simBar(m.similarity)}
        </div>
      ))}
    </div>
  )
}
