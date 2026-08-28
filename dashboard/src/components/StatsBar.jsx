// StatsBar — top summary statistics
export default function StatsBar({ nodes }) {
  const list = Object.values(nodes)
  const total       = list.length
  const healthy     = list.filter(n => n.status === 'HEALTHY').length
  const suspicious  = list.filter(n => n.status === 'SUSPICIOUS').length
  const quarantined = list.filter(n => n.status === 'QUARANTINED').length
  const offline     = list.filter(n => n.status === 'OFFLINE').length

  return (
    <div className="stats-bar">
      <div className="stat-cell">
        <div className="stat-label">Total Nodes</div>
        <div className="stat-value cyan">{total}</div>
      </div>
      <div className="stat-cell">
        <div className="stat-label">Healthy</div>
        <div className="stat-value green">{healthy}</div>
      </div>
      <div className="stat-cell">
        <div className="stat-label">Suspicious</div>
        <div className="stat-value yellow">{suspicious}</div>
      </div>
      <div className="stat-cell">
        <div className="stat-label">Quarantined</div>
        <div className="stat-value red">{quarantined}</div>
      </div>
      <div className="stat-cell">
        <div className="stat-label">Offline</div>
        <div className="stat-value orange">{offline}</div>
      </div>
    </div>
  )
}
