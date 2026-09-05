// MLScore.jsx — ML anomaly score gauge
// Displays the Isolation Forest anomaly score with warmup state.
import React from 'react'

function getScoreColor(score, warmup) {
  if (warmup) return '#4b5563'
  if (score >= 0.75) return '#ef4444'
  if (score >= 0.50) return '#f97316'
  if (score >= 0.25) return '#eab308'
  return '#22c55e'
}

export default function MLScore({ mlScore = 0, mlAnomaly = false, mlConfidence = 0, mlWarmup = true, mlSampleCount = 0, mini = false }) {
  const color = getScoreColor(mlScore, mlWarmup)
  const pct   = Math.round(mlScore * 100)
  const conf  = Math.round(mlConfidence * 100)

  if (mini) {
    return (
      <span
        title={mlWarmup
          ? `ML: warming up (${mlSampleCount} samples collected)`
          : `ML score: ${pct}%  confidence: ${conf}%  anomaly: ${mlAnomaly}`}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 3,
          padding: '2px 7px', borderRadius: 10, fontSize: 10, fontWeight: 700,
          background: mlWarmup ? 'rgba(75,85,99,0.15)' : `${color}22`,
          border: `1px solid ${mlWarmup ? '#374151' : color}`,
          color: mlWarmup ? '#6b7280' : color,
          whiteSpace: 'nowrap', cursor: 'help',
        }}
      >
        {mlWarmup ? '⏳ ML' : `ML ${pct}%`}
      </span>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>
          ML Anomaly
        </span>
        {mlWarmup
          ? <span style={{ fontSize: 10, color: '#6b7280' }}>⏳ warming up ({mlSampleCount} samples)</span>
          : (
            <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {mlAnomaly && (
                <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: '#ef444420', color: '#ef4444', fontWeight: 700 }}>
                  ANOMALY
                </span>
              )}
              <span style={{ fontSize: 10, color: '#6b7280' }}>{conf}% conf</span>
            </span>
          )
        }
      </div>

      {/* Score bar */}
      <div style={{
        height: 5, borderRadius: 3,
        background: 'rgba(255,255,255,0.07)', overflow: 'hidden',
      }}>
        <div style={{
          height: '100%', borderRadius: 3,
          width: `${mlWarmup ? 0 : pct}%`,
          background: color,
          transition: 'width 0.4s ease, background 0.4s ease',
        }} />
      </div>

      <div style={{ fontSize: 11, fontWeight: 700, color }}>
        {mlWarmup ? '—' : `${pct}%`}
      </div>
    </div>
  )
}
