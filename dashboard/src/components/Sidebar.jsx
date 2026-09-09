// Sidebar v5 — animated with layoutId sliding indicator
import { motion } from 'framer-motion'
import { Shield, Map, Radio, AlertTriangle, Cpu, Server, FileText, Settings } from 'lucide-react'
import { stagger, slideInLeft } from '../motion.js'

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

      <motion.nav
        className="sidebar-nav"
        variants={stagger(0.03)}
        initial="hidden"
        animate="visible"
      >
        {NAV.map(item => {
          const Icon = item.icon
          const isActive = currentView === item.id
          const badge = item.id === 'threats' && quarantinedCount > 0 ? quarantinedCount
                      : item.id === 'events' && eventCount > 0 ? Math.min(eventCount, 99)
                      : null
          return (
            <motion.button
              key={item.id}
              className={`sidebar-item${isActive ? ' active' : ''}`}
              onClick={() => onViewChange(item.id)}
              aria-current={isActive ? 'page' : undefined}
              variants={slideInLeft}
              whileHover={{ x: 2, transition: { duration: 0.15 } }}
              whileTap={{ scale: 0.97 }}
              style={{ position: 'relative' }}
            >
              {isActive && (
                <motion.div
                  layoutId="sidebar-active-bg"
                  className="sidebar-active-indicator"
                  transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                />
              )}
              <Icon size={15} style={{ flexShrink: 0, position: 'relative', zIndex: 1 }} />
              <span style={{ position: 'relative', zIndex: 1 }}>{item.label}</span>
              {badge && <span className="sidebar-item-badge" style={{ position: 'relative', zIndex: 1 }}>{badge}</span>}
            </motion.button>
          )
        })}
      </motion.nav>

      <div className="sidebar-footer">
        <div className="sidebar-footer-text">
          Secure · Monitor · Heal<br />
          <span style={{ opacity:0.6 }}>GhostNet keeps your IoT network<br />safe and self-reliant.</span>
        </div>
      </div>
    </aside>
  )
}
