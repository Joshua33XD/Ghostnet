// Header — premium branded header with live clock
import { useState, useEffect } from 'react'

export default function Header({ wsStatus }) {
  const [time, setTime] = useState(() => new Date().toLocaleTimeString())

  useEffect(() => {
    const t = setInterval(() => setTime(new Date().toLocaleTimeString()), 1000)
    return () => clearInterval(t)
  }, [])

  return (
    <header className="header">
      <div className="header-brand">
        <div className="header-logo">◉</div>
        <div>
          <h1>GhostNet</h1>
          <span className="subtitle">IoT Anomaly Detection Engine</span>
        </div>
      </div>

      <div className="header-right">
        <span className="header-time">{time}</span>
        <div className={`ws-badge ${wsStatus}`}>
          <div className="ws-dot" />
          {wsStatus === 'connected' ? 'Live' : wsStatus === 'connecting' ? 'Connecting' : 'Offline'}
        </div>
      </div>
    </header>
  )
}
