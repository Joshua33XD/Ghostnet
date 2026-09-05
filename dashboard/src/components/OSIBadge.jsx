// OSIBadge.jsx — OSI layer pill badge
// Displays the OSI layer number and name with a color-coded pill.
import React from 'react'

const LAYER_COLORS = {
  3: { bg: 'rgba(59,130,246,0.15)', border: 'rgba(59,130,246,0.5)', text: '#60a5fa' },  // blue
  4: { bg: 'rgba(168,85,247,0.15)', border: 'rgba(168,85,247,0.5)', text: '#c084fc' },  // purple
  7: { bg: 'rgba(249,115,22,0.15)', border: 'rgba(249,115,22,0.5)', text: '#fb923c' },  // orange
}

export default function OSIBadge({ layer, layerName, category, confidence, evidence = [], mini = false }) {
  if (!layer) return null
  const colors = LAYER_COLORS[layer] || {
    bg: 'rgba(100,100,100,0.15)', border: 'rgba(100,100,100,0.4)', text: '#9ca3af',
  }

  if (mini) {
    return (
      <span
        title={`L${layer} ${layerName} — ${category}\nConfidence: ${(confidence * 100).toFixed(0)}%\n${evidence.join('\n')}`}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '2px 7px', borderRadius: 10, fontSize: 10, fontWeight: 700,
          background: colors.bg, border: `1px solid ${colors.border}`,
          color: colors.text, whiteSpace: 'nowrap', cursor: 'help',
        }}
      >
        L{layer}
      </span>
    )
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 4,
      padding: '8px 12px', borderRadius: 8,
      background: colors.bg, border: `1px solid ${colors.border}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: colors.text }}>
          L{layer} {layerName}
        </span>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
          {(confidence * 100).toFixed(0)}% confidence
        </span>
      </div>
      <div style={{ fontSize: 11, color: colors.text, fontWeight: 600 }}>{category}</div>
      {evidence.length > 0 && (
        <div style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.5 }}>
          {evidence.slice(0, 2).map((e, i) => <div key={i}>• {e}</div>)}
        </div>
      )}
    </div>
  )
}
