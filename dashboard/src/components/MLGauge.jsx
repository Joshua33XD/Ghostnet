export default function MLGauge({ nodes }) {
  const list = Object.values(nodes)
  const avg = list.length
    ? list.reduce((s, n) => s + (n.anomaly_score ?? 0), 0) / list.length
    : 0
  const trust = Math.round((1 - avg) * 100)
  const r = 52
  const circ = 2 * Math.PI * r
  const color = trust >= 75 ? 'var(--status-healthy)' : trust >= 50 ? 'var(--status-warn)' : 'var(--status-danger)'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <svg width={130} height={130} viewBox="0 0 130 130">
        <circle cx={65} cy={65} r={r} fill="none" stroke="var(--border)" strokeWidth={8} />
        <circle cx={65} cy={65} r={r} fill="none"
          stroke={color} strokeWidth={8}
          strokeDasharray={`${circ * trust / 100} ${circ}`}
          strokeLinecap="round"
          transform="rotate(-90 65 65)"
          style={{ transition: 'stroke-dasharray 0.8s ease' }}
        />
        <text x={65} y={60} textAnchor="middle" fill="var(--text-primary)"
          fontSize={22} fontWeight="700" fontFamily="var(--font-mono)">{trust}%</text>
        <text x={65} y={76} textAnchor="middle" fill="var(--text-muted)"
          fontSize={9}>Anomaly Score</text>
        <text x={65} y={90} textAnchor="middle" fill={color}
          fontSize={9} fontWeight="700">Model: Isolation Forest</text>
      </svg>
      <div className="ml-gauge-label">
        Avg anomaly: {avg.toFixed(4)}<br />
        {trust >= 75 ? '✓ Network healthy' : trust >= 50 ? '⚠ Elevated risk' : '⛔ Critical threat level'}
      </div>
    </div>
  )
}
