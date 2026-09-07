// StatsCards — 4 top KPI cards matching the reference
import { Monitor, ShieldCheck, AlertTriangle, ShieldX } from 'lucide-react'
import { getTrustScore } from '../utils.js'

export default function StatsCards({ nodes, activeFilter, onFilter }) {
  const list = Object.values(nodes)
  const total       = list.length
  const healthy     = list.filter(n => n.status === 'HEALTHY').length
  const suspicious  = list.filter(n => n.status === 'SUSPICIOUS').length
  const quarantined = list.filter(n => n.status === 'QUARANTINED').length
  const offline     = list.filter(n => n.status === 'OFFLINE').length

  const pct = (n) => total ? Math.round(n / total * 100) : 0

  const avgTrust = total
    ? Math.round(list.reduce((s, n) => s + getTrustScore(n.anomaly_score ?? 0) * 100, 0) / total)
    : 0

  const cards = [
    {
      label: 'Total Devices',
      value: total,
      sub: `${healthy} Online · ${offline} Offline`,
      icon: Monitor,
      iconClass: 'blue',
      filter: null,
      barColor: 'var(--accent)',
      barPct: 100,
    },
    {
      label: 'Trusted',
      value: healthy,
      sub: `${pct(healthy)}% of network`,
      icon: ShieldCheck,
      iconClass: 'green',
      filter: 'HEALTHY',
      barColor: 'var(--status-healthy)',
      barPct: pct(healthy),
    },
    {
      label: 'Suspicious',
      value: suspicious,
      sub: `${pct(suspicious)}% of network`,
      icon: AlertTriangle,
      iconClass: 'amber',
      filter: 'SUSPICIOUS',
      barColor: 'var(--status-warn)',
      barPct: pct(suspicious),
    },
    {
      label: 'Quarantined',
      value: quarantined,
      sub: `${pct(quarantined)}% isolated`,
      icon: ShieldX,
      iconClass: 'red',
      filter: 'QUARANTINED',
      barColor: 'var(--status-danger)',
      barPct: pct(quarantined),
    },
  ]

  return (
    <div className="stat-cards-row">
      {cards.map(c => {
        const Icon = c.icon
        const isActive = activeFilter === c.filter
        return (
          <div
            key={c.label}
            className="stat-card"
            onClick={() => c.filter && onFilter(c.filter)}
            style={isActive ? { borderColor:'var(--accent)', background:'var(--accent-bg)' } : {}}
          >
            <div className={`stat-card-icon ${c.iconClass}`}>
              <Icon size={20} />
            </div>
            <div className="stat-card-body">
              <div className="stat-card-label">{c.label}</div>
              <div className="stat-card-value">{c.value}</div>
              <div className="stat-card-sub">{c.sub}</div>
              <div className="stat-card-bar">
                <div className="stat-card-bar-fill" style={{ width:`${c.barPct}%`, background:c.barColor }} />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
