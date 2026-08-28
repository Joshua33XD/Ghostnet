// ThreatRadar — multi-node anomaly score timeline
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ReferenceLine, ResponsiveContainer
} from 'recharts'

const COLORS = ['#00c8ff', '#00ff9d', '#ffd166', '#ff8c42', '#ff3d6e', '#7b8fff', '#c084fc']

const THRESHOLD = 0.75

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: '#0d1526',
      border: '1px solid rgba(0,200,255,0.2)',
      borderRadius: 8,
      padding: '8px 12px',
      fontSize: 11,
      fontFamily: 'JetBrains Mono, monospace',
    }}>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, marginBottom: 2 }}>
          {p.name}: <strong>{p.value?.toFixed(4)}</strong>
        </div>
      ))}
    </div>
  )
}

export default function ThreatRadar({ nodes }) {
  const nodeList = Object.values(nodes)
  if (nodeList.length === 0) return null

  // Build a combined series: each node is a line
  // We show the current anomaly score as a single-point summary bar
  return (
    <div className="threat-radar-card">
      <div className="threat-radar-header">
        <span className="threat-radar-title">◉ Live Threat Level</span>
        <span className="threat-radar-sub">EWMA Anomaly Score per Node</span>
      </div>

      <div className="threat-radar-bars">
        {nodeList.map((node, i) => {
          const score = node.anomaly_score ?? 0
          const pct = Math.min(score * 100, 100)
          const color = score >= 0.75 ? '#ff3d6e' : score >= 0.5 ? '#ff8c42' : score >= 0.25 ? '#ffd166' : '#00ff9d'
          return (
            <div key={node.node_id} className="threat-node-row">
              <div className="threat-node-name" style={{ color: COLORS[i % COLORS.length] }}>
                {node.node_id}
              </div>
              <div className="threat-bar-track">
                <div
                  className="threat-bar-fill"
                  style={{
                    width: `${pct}%`,
                    background: `linear-gradient(90deg, ${color}88, ${color})`,
                    boxShadow: score > 0.5 ? `0 0 8px ${color}` : 'none',
                  }}
                />
                {/* Threshold marker */}
                <div className="threat-threshold-line" />
              </div>
              <div className="threat-score-val" style={{ color }}>
                {score.toFixed(3)}
              </div>
              <span className={`node-status-pill ${node.status}`} style={{ fontSize: 9, padding: '2px 6px' }}>
                {node.status}
              </span>
            </div>
          )
        })}
      </div>

      <div className="threat-radar-legend">
        <span style={{ color: '#00ff9d' }}>● Normal</span>
        <span style={{ color: '#ffd166' }}>● Elevated</span>
        <span style={{ color: '#ff8c42' }}>● High</span>
        <span style={{ color: '#ff3d6e' }}>● Critical (&gt;0.75 → quarantine)</span>
      </div>
    </div>
  )
}
