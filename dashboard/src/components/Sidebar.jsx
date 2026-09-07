// Sidebar v5 — full labels + node health summary
import { Shield, Map, Radio, AlertTriangle, Cpu, Server, FileText, Settings } from 'lucide-react'

const NAV = [
  { id:'overview',   label:'Overview',       icon:Shield },
  { id:'network',    label:'Network Map',    icon:Map },
  { id:'comms',      label:'Communication',  icon:Radio },
  { id:'threats',    label:'Threat Analysis',icon:AlertTriangle },
  { id:'healing',    label:'Self-Healing',   icon:Cpu },
  { id:'devices',    label:'Devices',        icon:Server },
  { id:'events',     label:'Logs',           icon:FileText },
  { id:'settings',   label:'Settings',       icon:Settings },
]

export default function Sidebar({ currentView, onViewChange, nodes, eventCount }) {
  const nodeList = Object.values(nodes)
  const quarantinedCount = nodeList.filter(n => n.status === 'QUARANTINED').length

  return (
    <aside className="app-sidebar">
      <div className="sidebar-logo sidebar-logo--nav">
        <div className="sidebar-logo-icon">
          <Shield size={16} />
        </div>
        <div className="sidebar-logo-text">
          <span className="sidebar-logo-title">GhostNet</span>
          <span className="sidebar-logo-sub">Secure · Monitor · Heal</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {NAV.map(item => {
          const Icon = item.icon
          const badge = item.id === 'threats' && quarantinedCount > 0 ? quarantinedCount
                      : item.id === 'events' && eventCount > 0 ? Math.min(eventCount, 99)
                      : null
          return (
            <button
              key={item.id}
              className={`sidebar-item${currentView === item.id ? ' active' : ''}`}
              onClick={() => onViewChange(item.id)}
              aria-current={currentView === item.id ? 'page' : undefined}
            >
              <Icon size={15} style={{ flexShrink: 0 }} />
              {item.label}
              {badge && <span className="sidebar-item-badge">{badge}</span>}
            </button>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        <div className="sidebar-footer-text">
          Secure · Monitor · Heal<br />
          <span style={{ opacity:0.6 }}>GhostNet keeps your IoT network<br />safe and self-reliant.</span>
        </div>
      </div>
    </aside>
  )
}
