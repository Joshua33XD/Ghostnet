export default function AnomalyTable({ events }) {
  const anomalies = events
    .filter(e => {
      const t = (e.event_type ?? e.tag ?? '').toUpperCase()
      return ['QUARANTINE', 'ATTACK', 'SUSPICIOUS', 'WARN', 'ANOMALY', 'THREAT'].some(x => t.includes(x))
    })
    .slice(0, 8)

  if (anomalies.length === 0) return (
    <div style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)', textAlign: 'center', padding: 16 }}>
      No anomalies detected
    </div>
  )

  return (
    <div>
      {anomalies.map((e, i) => {
        const t = (e.event_type ?? e.tag ?? '').toUpperCase()
        const actionClass = t.includes('QUARANTINE') ? 'investigating' : t.includes('RECOVERED') ? 'resolved' : 'monitoring'
        const actionLabel = t.includes('QUARANTINE') ? 'Investigating' : t.includes('RECOVERED') ? 'Resolved' : 'Monitoring'
        const time = e.timestamp
          ? new Date(e.timestamp * 1000).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
          : '—'
        return (
          <div key={e.id ?? i} className="anomaly-row">
            <span className="anomaly-time">{time}</span>
            <span className="anomaly-node">{e.node_id ?? '—'}</span>
            <span className="anomaly-type">{e.message?.slice(0, 40) ?? t}</span>
            <span className={`anomaly-action ${actionClass}`}>{actionLabel}</span>
          </div>
        )
      })}
    </div>
  )
}
