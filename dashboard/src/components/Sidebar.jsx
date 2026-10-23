// Sidebar — 3-view navigation for Network IDS
import React from 'react'
import { motion } from 'framer-motion'
import { Shield, AlertTriangle, Server } from 'lucide-react'
import { stagger, slideInLeft } from '../motion.js'

const NAV = [
  { id: 'overview', label: 'Overview', icon: Shield },
  { id: 'alerts', label: 'Alerts', icon: AlertTriangle },
  { id: 'devices', label: 'Devices', icon: Server },
]

export default function Sidebar({ currentView, onViewChange, devices = [], alertCount = 0 }) {
  const devList = Array.isArray(devices) ? devices : Object.values(devices || {})
  const quarantinedCount = devList.filter(d => (d.status || '').toUpperCase() === 'QUARANTINED').length

  return (
    <aside className="app-sidebar" aria-label="Main Navigation">
      <div className="sidebar-logo sidebar-logo--nav">
        <div className="sidebar-logo-icon">
          <Shield size={16} aria-hidden="true" />
        </div>
        <div className="sidebar-logo-text">
          <span className="sidebar-logo-title">GhostNet IDS</span>
          <span className="sidebar-logo-sub">Suricata · Live Network</span>
        </div>
      </div>

      <motion.nav
        className="sidebar-nav"
        variants={stagger(0.04)}
        initial="hidden"
        animate="visible"
      >
        {NAV.map(item => {
          const Icon = item.icon
          const isActive = currentView === item.id
          let badge = null
          if (item.id === 'alerts' && alertCount > 0) {
            badge = alertCount > 99 ? '99+' : alertCount
          } else if (item.id === 'devices' && quarantinedCount > 0) {
            badge = `${quarantinedCount} quarantined`
          }

          return (
            <motion.button
              key={item.id}
              className={`sidebar-item${isActive ? ' active' : ''}`}
              onClick={() => onViewChange(item.id)}
              aria-current={isActive ? 'page' : undefined}
              variants={slideInLeft}
              whileHover={{ x: 2, transition: { duration: 0.15 } }}
              whileTap={{ scale: 0.98 }}
              style={{ position: 'relative' }}
            >
              {isActive && (
                <motion.div
                  layoutId="sidebar-active-bg"
                  className="sidebar-active-indicator"
                  transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                />
              )}
              <Icon size={16} style={{ flexShrink: 0, position: 'relative', zIndex: 1 }} aria-hidden="true" />
              <span style={{ position: 'relative', zIndex: 1 }}>{item.label}</span>
              {badge && (
                <span
                  className={`sidebar-item-badge ${item.id === 'devices' && quarantinedCount > 0 ? 'badge-danger' : ''}`}
                  style={{ position: 'relative', zIndex: 1 }}
                >
                  {badge}
                </span>
              )}
            </motion.button>
          )
        })}
      </motion.nav>

      <div className="sidebar-footer">
        <div className="sidebar-footer-text">
          Network IDS Engine<br />
          <span style={{ opacity: 0.7 }}>Powered by Suricata EVE telemetry</span>
        </div>
      </div>
    </aside>
  )
}
