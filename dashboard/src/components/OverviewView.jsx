import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { ShieldAlert, ShieldCheck, AlertTriangle, Activity, ArrowUpRight, Radio, ExternalLink, Zap, Terminal } from 'lucide-react'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts'
import NetworkTopologyRadar from './NetworkTopologyRadar.jsx'

function formatBps(bps = 0) {
  if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(1)} MB/s`
  if (bps >= 1_000) return `${(bps / 1_000).toFixed(1)} KB/s`
  return `${Math.round(bps)} B/s`
}

export default function OverviewView({
  devices = [],
  stats = {},
  alerts = [],
  events = [],
  onNavigate,
  onSelectDevice,
  isLoading,
}) {
  const quarantinedCount = devices.filter(d => (d.status || '').toUpperCase() === 'QUARANTINED').length
  const suspiciousCount = devices.filter(d => (d.status || '').toUpperCase() === 'SUSPICIOUS').length
  const healthyCount = devices.filter(d => (d.status || '').toUpperCase() === 'HEALTHY').length

  const verdict = useMemo(() => {
    if (quarantinedCount > 0) {
      return {
        title: 'AUTOMATED CONTAINMENT ACTIVE',
        subtitle: `${quarantinedCount} rogue host(s) isolated by Suricata Severity 1–2 rules. Lateral movement blocked.`,
        tone: 'is-quarantined',
        badge: 'CONTAINMENT ACTIVE',
        badgeClass: 'status-quarantined',
        icon: ShieldAlert,
      }
    }
    if (suspiciousCount > 0) {
      return {
        title: 'ANOMALOUS ACTIVITY DETECTED',
        subtitle: `${suspiciousCount} host(s) flagged for elevated recon/scan signatures. Monitoring flow anomalies.`,
        tone: 'is-suspicious',
        badge: 'WATCH CONDITION',
        badgeClass: 'status-suspicious',
        icon: AlertTriangle,
      }
    }
    return {
      title: 'NETWORK PERIMETER CLEAR',
      subtitle: 'Zero high-severity intrusion signatures detected in current surveillance window.',
      tone: 'is-healthy',
      badge: 'PERIMETER HEALTHY',
      badgeClass: 'status-healthy',
      icon: ShieldCheck,
    }
  }, [quarantinedCount, suspiciousCount])

  // Process minute trend for Recharts
  const chartData = useMemo(() => {
    const raw = stats.alerts_per_minute || []
    if (raw.length === 0) {
      return [
        { time: '12:00', count: 4 },
        { time: '12:05', count: 12 },
        { time: '12:10', count: 8 },
        { time: '12:15', count: 19 },
        { time: '12:20', count: 15 },
        { time: '12:25', count: 22 },
      ]
    }
    return raw.map(pt => ({
      time: (pt.minute || '').slice(11, 16) || pt.minute,
      count: pt.count,
    }))
  }, [stats.alerts_per_minute])

  const topSignatures = stats.top_signatures || []
  const sevCounts = stats.severity_counts || { 1: 0, 2: 0, 3: 0 }
  const totalAlerts = (sevCounts[1] || 0) + (sevCounts[2] || 0) + (sevCounts[3] || 0) || 1
  const sev1Pct = Math.round(((sevCounts[1] || 0) / totalAlerts) * 100)
  const sev2Pct = Math.round(((sevCounts[2] || 0) / totalAlerts) * 100)
  const sev3Pct = Math.max(0, 100 - sev1Pct - sev2Pct)

  return (
    <div className="soc-overview">
      {/* 1. Incident Status Verdict Banner */}
      <div className={`soc-verdict-banner ${verdict.tone}`}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: quarantinedCount > 0 ? 'rgba(255, 51, 102, 0.2)' : 'rgba(0, 242, 254, 0.15)',
            border: `1px solid ${quarantinedCount > 0 ? 'var(--wf-stop)' : 'var(--wf-cyan)'}`,
            display: 'grid',
            placeItems: 'center',
            color: quarantinedCount > 0 ? 'var(--wf-stop)' : 'var(--wf-cyan)',
          }}>
            <verdict.icon size={26} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <span className={`soc-verdict-badge ${verdict.badgeClass}`}>{verdict.badge}</span>
              <span style={{ fontFamily: 'var(--wf-mono)', fontSize: 11, color: 'var(--wf-mute)' }}>
                SURICATA 7.0 EVE TAILER
              </span>
            </div>
            <h1 style={{ fontFamily: 'var(--wf-mono)', fontSize: 20, fontWeight: 700, margin: 0, letterSpacing: '0.04em' }}>
              {verdict.title}
            </h1>
            <p style={{ margin: '4px 0 0', color: 'var(--wf-ink-soft)', fontSize: 13 }}>
              {verdict.subtitle}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {quarantinedCount > 0 && (
            <button
              onClick={() => onNavigate('devices')}
              className="soc-btn soc-btn-danger"
            >
              Review Isolated Nodes ({quarantinedCount}) <ArrowUpRight size={14} />
            </button>
          )}
          <button
            onClick={() => onNavigate('alerts')}
            className="soc-btn soc-btn-ghost"
          >
            Threat Ledger <ArrowUpRight size={14} />
          </button>
        </div>
      </div>

      {/* 2. Top Hero Grid: Topology Radar + Alerts Timeline */}
      <div className="soc-grid-hero">
        {/* Left: Network Topology Radar */}
        <div className="soc-card soc-card-glow-cyan" style={{ padding: 16 }}>
          <div className="soc-card-header">
            <div className="soc-card-title">
              <Radio size={14} style={{ color: 'var(--wf-cyan)' }} />
              Network Segment Topology Radar
            </div>
            <span className="soc-card-tag">Real-Time Mesh</span>
          </div>

          <NetworkTopologyRadar devices={devices} onSelectDevice={onSelectDevice} />
        </div>

        {/* Right: Telemetry & Threat Dynamics */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Alerts per minute Area Chart */}
          <div className="soc-card" style={{ flex: 1, padding: 16 }}>
            <div className="soc-card-header">
              <div className="soc-card-title">
                <Activity size={14} style={{ color: 'var(--wf-cyan)' }} />
                Alert Ingestion Rate (Past 20m)
              </div>
              <span className="soc-card-tag">{stats.total_alerts || alerts.length} Total Alerts</span>
            </div>

            <div style={{ width: '100%', height: 180 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <defs>
                    <linearGradient id="alertGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00f2fe" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#00f2fe" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="time"
                    stroke="var(--wf-mute)"
                    fontSize={10}
                    fontFamily="var(--wf-mono)"
                    tickLine={false}
                  />
                  <YAxis
                    stroke="var(--wf-mute)"
                    fontSize={10}
                    fontFamily="var(--wf-mono)"
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'rgba(19, 23, 34, 0.95)',
                      borderColor: 'var(--wf-line-strong)',
                      borderRadius: 8,
                      fontFamily: 'var(--wf-mono)',
                      fontSize: 12,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="#00f2fe"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#alertGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Severity Mix Progress Bar */}
            <div style={{ marginTop: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontFamily: 'var(--wf-mono)', marginBottom: 6 }}>
                <span style={{ color: 'var(--wf-stop)' }}>CRITICAL: {sev1Pct}% ({sevCounts[1] || 0})</span>
                <span style={{ color: 'var(--wf-watch)' }}>MEDIUM: {sev2Pct}% ({sevCounts[2] || 0})</span>
                <span style={{ color: '#c084fc' }}>LOW: {sev3Pct}% ({sevCounts[3] || 0})</span>
              </div>
              <div style={{ height: 6, width: '100%', borderRadius: 999, background: 'rgba(255,255,255,0.06)', overflow: 'hidden', display: 'flex' }}>
                <div style={{ width: `${sev1Pct}%`, background: 'var(--wf-stop)', transition: 'width 0.4s ease' }} />
                <div style={{ width: `${sev2Pct}%`, background: 'var(--wf-watch)', transition: 'width 0.4s ease' }} />
                <div style={{ width: `${sev3Pct}%`, background: '#a855f7', transition: 'width 0.4s ease' }} />
              </div>
            </div>
          </div>

          {/* Top Signatures Card */}
          <div className="soc-card" style={{ padding: 16 }}>
            <div className="soc-card-header" style={{ marginBottom: 10 }}>
              <div className="soc-card-title">
                <Zap size={14} style={{ color: 'var(--wf-stop)' }} />
                Active Attack Signatures
              </div>
              <button
                onClick={() => onNavigate('alerts')}
                className="soc-btn soc-btn-ghost soc-btn-xs"
              >
                View All
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {topSignatures.slice(0, 3).map((sig, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    padding: '6px 10px',
                    background: 'rgba(255, 255, 255, 0.02)',
                    borderRadius: 6,
                    border: '1px solid var(--wf-line)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                    <span className={`soc-badge ${sig.severity === 1 ? 'soc-badge-sev1' : sig.severity === 2 ? 'soc-badge-sev2' : 'soc-badge-sev3'}`}>
                      SEV {sig.severity}
                    </span>
                    <span style={{ fontFamily: 'var(--wf-mono)', fontSize: 11, color: 'var(--wf-ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {sig.signature}
                    </span>
                  </div>
                  <span style={{ fontFamily: 'var(--wf-mono)', fontSize: 11, color: 'var(--wf-mute)', flexShrink: 0 }}>
                    {sig.count}x
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Global Telemetry Metric Boxes */}
      <div className="soc-grid-metrics">
        <div className="soc-card">
          <div className="soc-metric-box">
            <span className="soc-metric-label">Wire Throughput</span>
            <span className="soc-metric-val" style={{ color: 'var(--wf-cyan)' }}>
              {formatBps(stats.total_bps || 0)}
            </span>
            <span className="soc-metric-sub">
              {stats.total_pps || 0} packets/sec active
            </span>
          </div>
        </div>

        <div className="soc-card">
          <div className="soc-metric-box">
            <span className="soc-metric-label">Suricata Alerts</span>
            <span className="soc-metric-val">
              {(stats.total_alerts || alerts.length).toLocaleString()}
            </span>
            <span className="soc-metric-sub" style={{ color: 'var(--wf-stop)' }}>
              {sevCounts[1] || 0} critical signatures
            </span>
          </div>
        </div>

        <div className="soc-card">
          <div className="soc-metric-box">
            <span className="soc-metric-label">Quarantined Hosts</span>
            <span className="soc-metric-val" style={{ color: quarantinedCount > 0 ? 'var(--wf-stop)' : 'var(--wf-ink)' }}>
              {quarantinedCount}
            </span>
            <span className="soc-metric-sub">
              {quarantinedCount > 0 ? 'Automated iptables/firewall drop' : 'No hosts currently isolated'}
            </span>
          </div>
        </div>

        <div className="soc-card">
          <div className="soc-metric-box">
            <span className="soc-metric-label">Monitored Endpoints</span>
            <span className="soc-metric-val" style={{ color: '#10b981' }}>
              {devices.length}
            </span>
            <span className="soc-metric-sub">
              {healthyCount} healthy, {suspiciousCount} watch
            </span>
          </div>
        </div>
      </div>

      {/* 4. Live EVE Event Tape / Console Ticker */}
      <div className="soc-card" style={{ padding: 18 }}>
        <div className="soc-card-header">
          <div className="soc-card-title">
            <Terminal size={14} style={{ color: 'var(--wf-cyan)' }} />
            Live EVE Telemetry Tape
          </div>
          <span className="soc-card-tag">WebSocket Ingestion</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
          {events.length > 0 ? (
            events.slice(0, 8).map((evt) => {
              const isAlert = evt.event_type === 'alert' || evt.tag?.startsWith('THREAT') || evt.tag === 'QUARANTINE'
              return (
                <div
                  key={evt._id || Math.random()}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: 6,
                    background: isAlert ? 'rgba(255, 51, 102, 0.05)' : 'rgba(255, 255, 255, 0.02)',
                    border: `1px solid ${isAlert ? 'rgba(255, 51, 102, 0.2)' : 'var(--wf-line)'}`,
                    fontFamily: 'var(--wf-mono)',
                    fontSize: 12,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden' }}>
                    <span className="soc-badge" style={{
                      background: isAlert ? 'rgba(255,51,102,0.15)' : 'rgba(0,242,254,0.1)',
                      color: isAlert ? 'var(--wf-stop)' : 'var(--wf-cyan)',
                      fontSize: 10,
                    }}>
                      {evt.tag || evt.event_type || 'FLOW'}
                    </span>
                    <span style={{ color: 'var(--wf-ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {evt.alert?.signature || evt.message || `Flow ${evt.src_ip || 'host'} → ${evt.dest_ip || 'dest'}`}
                    </span>
                  </div>
                  <span style={{ color: 'var(--wf-mute)', fontSize: 11, flexShrink: 0 }}>
                    {evt.timestamp ? new Date(evt.timestamp).toLocaleTimeString() : 'Live'}
                  </span>
                </div>
              )
            })
          ) : (
            <div style={{ color: 'var(--wf-mute)', fontFamily: 'var(--wf-mono)', fontSize: 12, padding: 12 }}>
              Awaiting real-time EVE events on WebSocket feed...
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
