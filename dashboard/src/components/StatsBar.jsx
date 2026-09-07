// StatsBar — summary counters with trend deltas and status filter
import { getTrustScore } from '../utils.js'

function TrendIndicator({ current, prev, isGoodUp = false }) {
  if (prev == null || prev === current) return <span className="stat-trend neutral">—</span>
  const delta = current - prev
  const up    = delta > 0
  // Semantics: for healthy, up is good; for suspicious/quarantined/offline, up is bad
  const cls   = isGoodUp
    ? (up ? 'good-up' : 'good-down')
    : (up ? 'bad-up'  : 'bad-down')
  return (
    <span className={`stat-trend ${cls}`}>
      {up ? '▲' : '▼'} {Math.abs(delta)}
    </span>
  )
}

export default function StatsBar({ nodes, prevCounts, activeFilter, onFilterStatus }) {
  const list        = Object.values(nodes)
  const total       = list.length
  const healthy     = list.filter(n => n.status === 'HEALTHY').length
  const suspicious  = list.filter(n => n.status === 'SUSPICIOUS').length
  const quarantined = list.filter(n => n.status === 'QUARANTINED').length
  const offline     = list.filter(n => n.status === 'OFFLINE').length

  const p = prevCounts // shorthand; null when no snapshot yet

  const cell = (label, value, colorClass, status, prev, isGoodUp = false) => (
    <div
      className={`stat-cell${activeFilter === status ? ' active' : ''}`}
      onClick={() => onFilterStatus?.(status)}
      title={status ? `Filter by ${status}` : 'Show all'}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onFilterStatus?.(status)}
      aria-pressed={activeFilter === status}
    >
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${colorClass}`}>{value}</div>
      <TrendIndicator current={value} prev={p?.[prev]} isGoodUp={isGoodUp} />
    </div>
  )

  const avgTrust = list.length === 0
    ? null
    : list.reduce((acc, n) => acc + getTrustScore(n.anomaly_score), 0) / list.length

  return (
    <div className="stats-bar">
      {cell('Total Nodes',  total,       'cyan',   null,          'total')}
      {cell('Healthy',      healthy,     'green',  'HEALTHY',     'healthy',     true)}
      {cell('Suspicious',   suspicious,  'yellow', 'SUSPICIOUS',  'suspicious')}
      {cell('Quarantined',  quarantined, 'red',    'QUARANTINED', 'quarantined')}
      {cell('Offline',      offline,     'orange', 'OFFLINE',     'offline')}
      {avgTrust != null && (
        <div
          className="stat-cell"
          title="Average Trust Score across all monitored nodes (Trust = 1 - anomaly_score)"
          style={{ cursor: 'default' }}
        >
          <div className="stat-label">Avg Trust</div>
          <div
            className="stat-value"
            style={{
              color: avgTrust >= 0.75 ? 'var(--green)' : avgTrust >= 0.5 ? 'var(--yellow)' : 'var(--red)'
            }}
          >
            {(avgTrust * 100).toFixed(0)}%
          </div>
          <span className="stat-trend neutral">—</span>
        </div>
      )}
    </div>
  )
}


