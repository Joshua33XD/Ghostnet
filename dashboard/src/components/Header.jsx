import React, { useState, useEffect } from 'react'
import { Shield, Layers, Activity, Zap, Volume2, VolumeX, Terminal, Cpu } from 'lucide-react'

export default function Header({ wsStatus, currentView, onViewChange, eventCount = 0, nodeCount = 0 }) {
  const [time, setTime] = useState(() => new Date().toLocaleTimeString())
  const [audioEnabled, setAudioEnabled] = useState(false)

  useEffect(() => {
    const t = setInterval(() => setTime(new Date().toLocaleTimeString()), 1000)
    return () => clearInterval(t)
  }, [])

  const toggleAudio = () => {
    setAudioEnabled(prev => !prev)
    if (!audioEnabled) {
      try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
        const osc = audioCtx.createOscillator()
        const gain = audioCtx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(880, audioCtx.currentTime)
        gain.gain.setValueAtTime(0.05, audioCtx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15)
        osc.connect(gain)
        gain.connect(audioCtx.destination)
        osc.start()
        osc.stop(audioCtx.currentTime + 0.15)
      } catch (e) {
        // audio context blocked
      }
    }
  }

  const views = [
    { id: 'pipeline', label: '1. Pipeline Architecture', icon: Layers },
    { id: 'narrator', label: '2. Transparent Telemetry', icon: Terminal },
    { id: 'matrix', label: '3. Node Matrix Grid', icon: Activity },
    { id: 'feature-radar', label: '4. Feature Vector Radar', icon: Cpu },
  ]

  return (
    <header className="futuristic-header">
      {/* Brand logo & identity */}
      <div className="header-brand-glass">
        <div className="brand-icon-shield">
          <Shield className="w-4 h-4 text-cyan-400" />
        </div>
        <div className="brand-text-col">
          <div className="flex items-center gap-1.5">
            <span className="brand-title">GHOSTNET</span>
            <span className="brand-v3-tag">v3.4 PIPELINE</span>
          </div>
          <span className="brand-subtitle">CYBER INTELLIGENCE DEFENSE</span>
        </div>
      </div>

      {/* Center Floating View Switcher Pills */}
      <div className="header-nav-pills">
        {views.map(v => {
          const Icon = v.icon
          const isActive = currentView === v.id
          return (
            <button
              key={v.id}
              className={`nav-pill-btn ${isActive ? 'active' : ''}`}
              onClick={() => onViewChange(v.id)}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{v.label}</span>
            </button>
          )
        })}
      </div>

      {/* Right HUD status items */}
      <div className="header-right-hud">
        {/* Live Audio alert toggle */}
        <button
          className={`hud-icon-btn ${audioEnabled ? 'active' : ''}`}
          onClick={toggleAudio}
          title={audioEnabled ? 'Audio alerts active' : 'Audio alerts muted'}
        >
          {audioEnabled ? <Volume2 className="w-3.5 h-3.5 text-cyan-400" /> : <VolumeX className="w-3.5 h-3.5 text-white/40" />}
        </button>

        {/* Real-time Clock */}
        <div className="hud-clock-pill">
          <span className="hud-clock-time">{time}</span>
        </div>

        {/* WebSocket Status Pill */}
        <div className={`ws-status-pill ${wsStatus}`}>
          <div className="ws-pulse-dot" />
          <span className="font-mono text-[10px] tracking-wider uppercase font-bold">
            {wsStatus === 'connected' ? 'LIVE LINK' : wsStatus === 'connecting' ? 'SYNCING' : 'OFFLINE'}
          </span>
        </div>
      </div>
    </header>
  )
}
