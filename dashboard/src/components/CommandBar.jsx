import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Shield, Radio, AlertTriangle, Server, Terminal, Volume2, VolumeX, Sun, Moon, Sparkles, Activity } from 'lucide-react'
import OverflowMenu from './OverflowMenu.jsx'

export default function CommandBar({
  currentView,
  onViewChange,
  wsStatus,
  nodeCount = 0,
  alertCount = 0,
  quarantinedCount = 0,
  suspiciousCount = 0,
  theme,
  onThemeSelect,
  networkState = 'healthy',
  audioEnabled = false,
  onToggleAudio,
  stats = {},
  onOpenCapture,
}) {
  const [clock, setClock] = useState('')

  useEffect(() => {
    const tick = () => {
      const now = new Date()
      setClock(now.toLocaleTimeString('en-GB', { hour12: false }))
    }
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [])

  const navItems = [
    { id: 'overview', label: 'Radar & Overview', icon: Radio },
    { id: 'alerts', label: 'Threat Ledger', icon: AlertTriangle, count: alertCount, danger: alertCount > 0 },
    { id: 'devices', label: 'Host Mesh', icon: Server, count: quarantinedCount, danger: quarantinedCount > 0 },
    { id: 'pcap', label: 'PCAP Studio', icon: Terminal },
  ]

  const formatBps = (bps = 0) => {
    if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(1)} MB/s`
    if (bps >= 1_000) return `${(bps / 1_000).toFixed(1)} KB/s`
    return `${Math.round(bps)} B/s`
  }

  return (
    <header className="wf-mast">
      {/* Brand & Logo */}
      <div className="wf-brand">
        <div className="wf-brand-icon">
          <Shield size={18} />
          <div className="wf-brand-icon-pulse" />
        </div>
        <div className="wf-brand-text">
          <span className="wf-brand-title">GHOSTNET</span>
          <span className="wf-brand-subtitle">CYBER IDS v3.0</span>
        </div>
      </div>

      {/* Main Navigation Tabs */}
      <nav className="wf-mast-nav">
        <div className="wf-nav-tabs">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = currentView === item.id
            return (
              <button
                key={item.id}
                onClick={() => onViewChange(item.id)}
                className={`wf-nav-tab ${isActive ? 'is-active' : ''}`}
              >
                {isActive && (
                  <motion.div
                    layoutId="wf-nav-pill-active"
                    className="wf-nav-pill"
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}
                <Icon size={14} />
                <span>{item.label}</span>
                {item.count > 0 && (
                  <span className={`wf-nav-badge ${item.danger ? 'is-danger' : ''}`}>
                    {item.count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </nav>

      {/* Right HUD Telemetry & Actions */}
      <div className="wf-mast-tools">
        {/* HUD Quick Telemetry Chips */}
        <div className="wf-hud-chips">
          {/* Wire Rate Chip */}
          <div className="wf-hud-chip" title="Live aggregate network throughput">
            <Activity size={13} style={{ color: 'var(--wf-cyan)' }} />
            <span>WIRE:</span>
            <span className="wf-hud-chip-val">{formatBps(stats.total_bps || 0)}</span>
          </div>

          {/* Node Summary Pill */}
          <div className="wf-hud-chip" title="Active hosts status on network segment">
            <span className="wf-live-dot" />
            <span>{nodeCount} HOSTS</span>
            {quarantinedCount > 0 && (
              <span style={{ color: 'var(--wf-stop)', fontWeight: 700, marginLeft: 2 }}>
                ({quarantinedCount} ISOLATED)
              </span>
            )}
          </div>
        </div>

        {/* Audio Alert Toggle */}
        <button
          onClick={onToggleAudio}
          className={`wf-tool-btn ${audioEnabled ? 'is-active' : ''}`}
          title={audioEnabled ? 'Threat audio siren active (click to mute)' : 'Threat audio muted (click to enable)'}
          aria-label="Toggle threat audio alert"
        >
          {audioEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
        </button>

        {/* Theme Switcher Toggle */}
        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: 2, border: '1px solid var(--wf-line)' }}>
          <button
            onClick={() => onThemeSelect('dark')}
            className={`wf-tool-btn ${theme === 'dark' ? 'is-active' : ''}`}
            style={{ width: 28, height: 28, border: 'none' }}
            title="Obsidian Dark Theme"
          >
            <Moon size={13} />
          </button>
          <button
            onClick={() => onThemeSelect('light')}
            className={`wf-tool-btn ${theme === 'light' ? 'is-active' : ''}`}
            style={{ width: 28, height: 28, border: 'none' }}
            title="Titanium White Light Theme"
          >
            <Sun size={13} />
          </button>
          <button
            onClick={() => onThemeSelect('colorful')}
            className={`wf-tool-btn ${theme === 'colorful' ? 'is-active' : ''}`}
            style={{ width: 28, height: 28, border: 'none' }}
            title="Neon Synthwave Grid Theme"
          >
            <Sparkles size={13} />
          </button>
        </div>

        {/* Clock */}
        <div style={{ fontFamily: 'var(--wf-mono)', fontSize: 12, color: 'var(--wf-ink-soft)', paddingLeft: 4 }}>
          {clock}
        </div>

        {/* Overflow Menu */}
        <OverflowMenu onOpenCapture={onOpenCapture} />
      </div>
    </header>
  )
}
