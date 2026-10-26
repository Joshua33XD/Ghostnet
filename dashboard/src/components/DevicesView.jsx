import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Server, ShieldAlert, ShieldCheck, AlertTriangle, Lock, Unlock, Search, Terminal, ArrowUpRight, Activity, Laptop, Camera, Thermometer, Radio, Cpu } from 'lucide-react'
import { AreaChart, Area, ResponsiveContainer } from 'recharts'

function formatBytes(bytes) {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(sizes.length - 1, Math.floor(Math.log(bytes) / Math.log(k)))
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${sizes[i]}`
}

function formatRate(bps) {
  if (!bps) return '0 B/s'
  if (bps >= 1048576) return `${(bps / 1048576).toFixed(1)} MB/s`
  if (bps >= 1024) return `${(bps / 1024).toFixed(1)} KB/s`
  return `${Math.round(bps)} B/s`
}


function getDeviceIcon(ip, role) {
  const r = (role || '').toLowerCase()
  if (ip === '192.168.1.105' || r.includes('attacker') || r.includes('rogue')) return Laptop
  if (r.includes('camera') || ip === '192.168.1.20') return Camera
  if (r.includes('thermostat') || ip === '192.168.1.10') return Thermometer
  if (r.includes('relay') || r.includes('plug') || ip === '192.168.1.30') return Radio
  if (r.includes('sensor') || ip === '192.168.1.40') return Cpu
  if (ip === '192.168.1.50' || r.includes('gateway') || r.includes('broker')) return Server
  return Radio
}

function MiniSparkline({ data = [], color = '#00f2fe' }) {
  if (!data || data.length < 2) {
    return <div style={{ height: 28, display: 'grid', placeItems: 'center', color: 'var(--wf-mute)', fontSize: 10 }}>No flow data</div>
  }
  const chartData = data.map((d, i) => ({ i, v: Number(d.score || 0) }))
  return (
    <div style={{ height: 28 }}>
      <ResponsiveContainer width="100%" height={28}>
        <AreaChart data={chartData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`spark-${color}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.4} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="v" stroke={color} fill={`url(#spark-${color})`} strokeWidth={1.5} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export default function DevicesView({
  devices = [],
  selectedIp,
  onRelease,
  onQuarantine,
  onOpenPacketDrillDown,
  isLoading = false,
}) {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [inspectingIp, setInspectingIp] = useState(selectedIp || null)
  const [confirmIp, setConfirmIp] = useState(null)
  const [actionType, setActionType] = useState(null) // 'quarantine' | 'release'

  const filteredDevices = useMemo(() => {
    return devices.filter(d => {
      const status = (d.status || '').toUpperCase()
      if (statusFilter !== 'ALL' && status !== statusFilter) return false
      if (searchTerm) {
        const term = searchTerm.toLowerCase()
        const ip = (d.ip || '').toLowerCase()
        const name = (d.name || '').toLowerCase()
        const nodeId = (d.node_id || '').toLowerCase()
        if (!ip.includes(term) && !name.includes(term) && !nodeId.includes(term)) return false
      }
      return true
    })
  }, [devices, statusFilter, searchTerm])

  const currentDevice = devices.find(d => d.ip === inspectingIp) || devices[0]

  const quarantinedCount = devices.filter(d => (d.status || '').toUpperCase() === 'QUARANTINED').length
  const suspiciousCount = devices.filter(d => (d.status || '').toUpperCase() === 'SUSPICIOUS').length
  const healthyCount = devices.filter(d => (d.status || '').toUpperCase() === 'HEALTHY').length

  const handleExecuteAction = () => {
    if (!confirmIp) return
    if (actionType === 'release') {
      onRelease?.(confirmIp)
    } else {
      onQuarantine?.(confirmIp, 'SOC operator manual containment')
    }
    setConfirmIp(null)
  }

  return (
    <div className="soc-devices-view">
      {/* Title Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h1 style={{ fontFamily: 'var(--wf-mono)', fontSize: 20, fontWeight: 700, margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Host Mesh & Endpoint Registry
          </h1>
          <span className="soc-badge" style={{ background: 'rgba(0,242,254,0.1)', color: 'var(--wf-cyan)', border: '1px solid rgba(0,242,254,0.3)' }}>
            192.168.1.0/24 SUBNET
          </span>
        </div>
        <p style={{ margin: '4px 0 0', color: 'var(--wf-ink-soft)', fontSize: 13 }}>
          Stateful endpoint registry with automated quarantine containment and live flow sparklines.
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div className="soc-card" style={{ padding: 16, marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
          <div className="soc-search-wrapper">
            <Search size={15} className="soc-search-icon" />
            <input
              type="text"
              placeholder="Search by IP address or device name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="soc-search-input"
            />
          </div>

          {/* Status Tabs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <button
              onClick={() => setStatusFilter('ALL')}
              className="soc-badge"
              style={{
                background: statusFilter === 'ALL' ? 'var(--wf-cyan)' : 'rgba(255,255,255,0.04)',
                color: statusFilter === 'ALL' ? '#08090d' : 'var(--wf-ink-soft)',
                border: statusFilter === 'ALL' ? 'none' : '1px solid var(--wf-line)',
                padding: '6px 12px',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              All Hosts ({devices.length})
            </button>
            <button
              onClick={() => setStatusFilter('QUARANTINED')}
              className="soc-badge soc-badge-sev1"
              style={{
                padding: '6px 12px',
                cursor: 'pointer',
                boxShadow: statusFilter === 'QUARANTINED' ? '0 0 14px rgba(255,51,102,0.4)' : 'none',
                borderWidth: statusFilter === 'QUARANTINED' ? 2 : 1,
              }}
            >
              Isolated ({quarantinedCount})
            </button>
            <button
              onClick={() => setStatusFilter('SUSPICIOUS')}
              className="soc-badge soc-badge-sev2"
              style={{
                padding: '6px 12px',
                cursor: 'pointer',
                boxShadow: statusFilter === 'SUSPICIOUS' ? '0 0 14px rgba(245,158,11,0.4)' : 'none',
                borderWidth: statusFilter === 'SUSPICIOUS' ? 2 : 1,
              }}
            >
              On Watch ({suspiciousCount})
            </button>
            <button
              onClick={() => setStatusFilter('HEALTHY')}
              className="soc-badge"
              style={{
                background: statusFilter === 'HEALTHY' ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.04)',
                color: '#10b981',
                border: statusFilter === 'HEALTHY' ? '2px solid #10b981' : '1px solid var(--wf-line)',
                padding: '6px 12px',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Healthy ({healthyCount})
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid: Devices Cards (Left) + Detailed Endpoint Profile (Right) */}
      <div style={{ display: 'grid', gridTemplateColumns: currentDevice ? '1.3fr 1fr' : '1fr', gap: 20 }}>
        {/* Device Cards Grid */}
        <div className="soc-devices-grid">
          {filteredDevices.map((dev) => {
            const status = (dev.status || '').toUpperCase()
            const isQuarantined = status === 'QUARANTINED'
            const isSuspicious = status === 'SUSPICIOUS'
            const isSelected = currentDevice?.ip === dev.ip
            const Icon = getDeviceIcon(dev.ip, dev.name)

            return (
              <motion.div
                key={dev.ip}
                onClick={() => setInspectingIp(dev.ip)}
                className={`soc-device-card ${isQuarantined ? 'is-quarantined' : isSuspicious ? 'is-suspicious' : ''}`}
                style={{
                  cursor: 'pointer',
                  borderColor: isSelected ? 'var(--wf-cyan)' : undefined,
                  boxShadow: isSelected ? '0 0 20px rgba(0, 242, 254, 0.2)' : undefined,
                }}
              >
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      background: isQuarantined ? 'rgba(255,51,102,0.15)' : 'rgba(0,242,254,0.1)',
                      border: `1px solid ${isQuarantined ? 'var(--wf-stop)' : 'rgba(0,242,254,0.3)'}`,
                      display: 'grid',
                      placeItems: 'center',
                      color: isQuarantined ? 'var(--wf-stop)' : 'var(--wf-cyan)',
                    }}>
                      <Icon size={18} />
                    </div>
                    <div>
                      <h3 style={{ fontFamily: 'var(--wf-mono)', fontSize: 14, fontWeight: 700, margin: 0, color: 'var(--wf-ink)' }}>
                        {dev.name || 'IoT Device'}
                      </h3>
                      <span style={{ fontFamily: 'var(--wf-mono)', fontSize: 12, color: 'var(--wf-ink-soft)' }}>
                        {dev.device_type === 'esp32' ? `ESP32 · ${dev.node_id || dev.ip}` : dev.ip}
                      </span>
                    </div>
                  </div>

                  <span className={`soc-badge ${isQuarantined ? 'soc-badge-sev1' : isSuspicious ? 'soc-badge-sev2' : ''}`} style={{
                    color: !isQuarantined && !isSuspicious ? '#10b981' : undefined,
                    background: !isQuarantined && !isSuspicious ? 'rgba(16,185,129,0.15)' : undefined,
                    border: !isQuarantined && !isSuspicious ? '1px solid rgba(16,185,129,0.3)' : undefined,
                  }}>
                    {status}
                  </span>
                </div>

                {/* Sparkline & Throughput */}
                <div style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px solid var(--wf-line)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                    <span style={{ fontFamily: 'var(--wf-mono)', fontSize: 10, color: 'var(--wf-mute)' }}>LIVE FLOW RATE</span>
                    <span style={{ fontFamily: 'var(--wf-mono)', fontSize: 12, fontWeight: 700, color: 'var(--wf-cyan)' }}>
                      {formatRate(dev.bps)}
                    </span>
                  </div>
                  <MiniSparkline data={dev.history_bps} color={isQuarantined ? '#ff3366' : '#00f2fe'} />
                </div>

                {/* Stats Summary */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontFamily: 'var(--wf-mono)', color: 'var(--wf-mute)' }}>
                  <span>In: <b style={{ color: 'var(--wf-ink-soft)' }}>{formatBytes(dev.bytes_in)}</b></span>
                  <span>Out: <b style={{ color: 'var(--wf-ink-soft)' }}>{formatBytes(dev.bytes_out)}</b></span>
                  <span>Flows: <b style={{ color: 'var(--wf-ink-soft)' }}>{dev.flow_count || 0}</b></span>
                </div>
              </motion.div>
            )
          })}
        </div>

        {/* Selected Endpoint Profile Drawer */}
        {currentDevice && (
          <div className="soc-card" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div className="soc-card-header" style={{ marginBottom: 0 }}>
              <div className="soc-card-title">
                <Server size={14} style={{ color: 'var(--wf-cyan)' }} />
                Endpoint Profile
              </div>
              <span className={`soc-badge ${(currentDevice.status || '').toUpperCase() === 'QUARANTINED' ? 'soc-badge-sev1' : ''}`} style={{
                color: (currentDevice.status || '').toUpperCase() === 'HEALTHY' ? '#10b981' : undefined,
              }}>
                {currentDevice.status}
              </span>
            </div>

            <div>
              <h2 style={{ fontFamily: 'var(--wf-mono)', fontSize: 18, fontWeight: 700, margin: 0 }}>
                {currentDevice.name || 'IoT Device'}
              </h2>
              <div style={{ fontFamily: 'var(--wf-mono)', fontSize: 13, color: 'var(--wf-cyan)', marginTop: 2 }}>
                IP: {currentDevice.ip} · MAC: {currentDevice.telemetry?.mac || 'Not reported'}
              </div>
            </div>

            {currentDevice.device_type === 'esp32' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontFamily: 'var(--wf-mono)', fontSize: 11 }}>
                <div style={{ padding: 10, background: 'rgba(0,242,254,0.06)', border: '1px solid rgba(0,242,254,0.2)', borderRadius: 8 }}>
                  <div style={{ color: 'var(--wf-mute)' }}>ESP32 NODE</div>
                  <div style={{ color: 'var(--wf-cyan)', marginTop: 4 }}>{currentDevice.node_id || 'Unidentified'}</div>
                </div>
                <div style={{ padding: 10, background: 'rgba(0,242,254,0.06)', border: '1px solid rgba(0,242,254,0.2)', borderRadius: 8 }}>
                  <div style={{ color: 'var(--wf-mute)' }}>WI-FI SIGNAL</div>
                  <div style={{ color: 'var(--wf-cyan)', marginTop: 4 }}>{currentDevice.telemetry?.rssi ?? '—'} dBm</div>
                </div>
              </div>
            )}

            {/* Quarantine & Containment Action Controls */}
            <div style={{ padding: 14, background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px solid var(--wf-line)' }}>
              <div style={{ fontFamily: 'var(--wf-mono)', fontSize: 11, color: 'var(--wf-mute)', fontWeight: 600, marginBottom: 10 }}>
                CONTAINMENT & ACCESS CONTROL
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                {(currentDevice.status || '').toUpperCase() === 'QUARANTINED' || (currentDevice.status || '').toUpperCase() === 'SUSPICIOUS' ? (
                  <button
                    onClick={() => {
                      setConfirmIp(currentDevice.ip)
                      setActionType('release')
                    }}
                    className="soc-btn"
                    style={{ background: 'rgba(16,185,129,0.2)', color: '#10b981', border: '1px solid #10b981', flex: 1 }}
                  >
                    <Unlock size={14} /> Release to Healthy
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setConfirmIp(currentDevice.ip)
                      setActionType('quarantine')
                    }}
                    className="soc-btn soc-btn-danger"
                    style={{ flex: 1 }}
                  >
                    <Lock size={14} /> Isolate Endpoint (Quarantine)
                  </button>
                )}

                <button
                  onClick={() => onOpenPacketDrillDown?.(currentDevice.ip)}
                  className="soc-btn soc-btn-ghost"
                  title="Inspect packets for this IP"
                >
                  <Terminal size={14} /> PCAP Trace
                </button>
              </div>
            </div>

            {/* Traffic Rates */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ padding: 12, background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px solid var(--wf-line)' }}>
                <span style={{ fontFamily: 'var(--wf-mono)', fontSize: 10, color: 'var(--wf-mute)' }}>BIT RATE</span>
                <div style={{ fontFamily: 'var(--wf-mono)', fontSize: 16, fontWeight: 700, color: 'var(--wf-cyan)', marginTop: 2 }}>
                  {formatRate(currentDevice.bps)}
                </div>
                <div style={{ marginTop: 8 }}>
                  <MiniSparkline data={currentDevice.history_bps} color="#00f2fe" />
                </div>
              </div>

              <div style={{ padding: 12, background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px solid var(--wf-line)' }}>
                <span style={{ fontFamily: 'var(--wf-mono)', fontSize: 10, color: 'var(--wf-mute)' }}>PACKET RATE</span>
                <div style={{ fontFamily: 'var(--wf-mono)', fontSize: 16, fontWeight: 700, color: 'var(--wf-ink)', marginTop: 2 }}>
                  {Math.round(currentDevice.pps || 0)} pkts/s
                </div>
                <div style={{ marginTop: 8 }}>
                  <MiniSparkline data={currentDevice.history_pps} color="#a855f7" />
                </div>
              </div>
            </div>

            {/* Recent Suricata Alerts for this Host */}
            <div>
              <div style={{ fontFamily: 'var(--wf-mono)', fontSize: 11, color: 'var(--wf-mute)', fontWeight: 600, marginBottom: 8 }}>
                RECENT IDS ALERTS ({(currentDevice.recent_alerts || []).length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
                {(currentDevice.recent_alerts || []).length > 0 ? (
                  currentDevice.recent_alerts.slice(0, 5).map((al, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '8px 10px',
                        background: 'rgba(255, 51, 102, 0.05)',
                        border: '1px solid rgba(255, 51, 102, 0.2)',
                        borderRadius: 6,
                        fontFamily: 'var(--wf-mono)',
                        fontSize: 11,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span style={{ color: 'var(--wf-stop)' }}>{al.alert?.signature}</span>
                      <span className="soc-badge soc-badge-sev1" style={{ fontSize: 9, padding: '1px 5px' }}>
                        SEV {al.alert?.severity || 1}
                      </span>
                    </div>
                  ))
                ) : (
                  <div style={{ color: 'var(--wf-mute)', fontFamily: 'var(--wf-mono)', fontSize: 11, padding: 8 }}>
                    Perimeter clean: No recent intrusion alerts logged for this host.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Modal for Quarantine / Release */}
      <AnimatePresence>
        {confirmIp && (
          <div className="wf-modal-overlay" onClick={() => setConfirmIp(null)}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="wf-modal"
              style={{ maxWidth: 460 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="wf-modal-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {actionType === 'quarantine' ? (
                    <Lock size={18} style={{ color: 'var(--wf-stop)' }} />
                  ) : (
                    <Unlock size={18} style={{ color: '#10b981' }} />
                  )}
                  <h3 style={{ fontFamily: 'var(--wf-mono)', fontSize: 15, margin: 0 }}>
                    {actionType === 'quarantine' ? 'Confirm Quarantine Isolation' : 'Confirm Endpoint Release'}
                  </h3>
                </div>
              </div>

              <div className="wf-modal-body">
                <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--wf-ink)' }}>
                  Are you sure you want to {actionType === 'quarantine' ? 'isolate' : 'restore'} host <b style={{ color: 'var(--wf-cyan)' }}>{confirmIp}</b>?
                </p>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--wf-ink-soft)' }}>
                  {actionType === 'quarantine'
                    ? 'Automated firewall rule will block all outbound traffic from this device to prevent lateral movement.'
                    : 'The device will be restored to the healthy surveillance window.'}
                </p>
              </div>

              <div className="wf-modal-footer">
                <button
                  onClick={() => setConfirmIp(null)}
                  className="soc-btn soc-btn-ghost"
                >
                  Cancel
                </button>
                <button
                  onClick={handleExecuteAction}
                  className={`soc-btn ${actionType === 'quarantine' ? 'soc-btn-danger' : 'soc-btn-primary'}`}
                >
                  Confirm {actionType === 'quarantine' ? 'Isolation' : 'Release'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
