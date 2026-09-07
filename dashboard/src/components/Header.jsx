// Header v5 — search bar + system status + theme toggle
import { useState, useEffect } from 'react'
import { Shield, Search, Bell, Sun, Moon, Palette, User } from 'lucide-react'
import { THEME_LABELS } from '../utils/theme.js'

const THEME_ICONS = {
  dark: Moon,
  clean: Sun,
  colorful: Palette,
}

export default function Header({ wsStatus, nodeCount, eventCount, theme, onThemeToggle }) {
  const [clock, setClock] = useState('')
  const [sub, setSub] = useState('')

  useEffect(() => {
    const tick = () => {
      const now = new Date()
      setClock(now.toLocaleTimeString('en-GB', { hour12: false }))
      setSub(now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }))
    }
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [])

  const isConnected = wsStatus === 'connected'
  const ThemeIcon = THEME_ICONS[theme] ?? Sun
  const nextLabel = THEME_LABELS[theme] ?? theme

  return (
    <header className="app-header">
      <div style={{ width: 'calc(var(--sidebar-w) - 20px)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
        <div className="sidebar-logo-icon" style={{ width: 30, height: 30, borderRadius: 7 }}>
          <Shield size={16} />
        </div>
        <div className="sidebar-logo-text">
          <span className="sidebar-logo-title">GhostNet</span>
          <span className="sidebar-logo-sub">IoT Security</span>
        </div>
      </div>

      <div className="header-search">
        <Search size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        <input placeholder="Search device, IP, or feature…" />
        <kbd style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', flexShrink: 0, opacity: 0.7 }}>⌘ K</kbd>
      </div>

      <div className="header-right">
        {isConnected ? (
          <div className="system-status-pill">
            <span className="status-dot" />
            System Online
            <span style={{ fontSize: 9, opacity: 0.7 }}>· {nodeCount ?? 0} Nodes</span>
          </div>
        ) : (
          <div className="system-status-pill" style={{ color: 'var(--status-warn)', borderColor: 'var(--status-warn-border)', background: 'var(--status-warn-bg)' }}>
            <span className="status-dot" style={{ animationDelay: '0.5s' }} />
            {wsStatus === 'connecting' ? 'Connecting…' : 'Offline'}
          </div>
        )}

        <div>
          <div className="header-clock">{clock}</div>
          <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textAlign: 'right' }}>{sub}</div>
        </div>

        <div style={{ width: 1, height: 22, background: 'var(--border)', flexShrink: 0 }} />

        <button
          className={`theme-toggle-btn theme-toggle-btn--${theme}`}
          onClick={onThemeToggle}
          title={`Current: ${nextLabel}. Click to cycle themes.`}
        >
          <ThemeIcon size={13} />
          {nextLabel}
        </button>

        <button className="hud-icon-btn" title="Notifications">
          <Bell size={14} />
          {eventCount > 0 && (
            <span className="notification-badge">{eventCount > 9 ? '9+' : eventCount}</span>
          )}
        </button>

        <div className="avatar-btn" title="Account">GN</div>
      </div>
    </header>
  )
}
