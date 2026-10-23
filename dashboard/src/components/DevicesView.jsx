// Devices View — Detailed Device Telemetry, Flow Sparklines, Alerts & Quarantine Actions
import React, { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  Server,
  Lock,
  Unlock,
  AlertTriangle,
  Activity,
  Search,
  Filter,
  ArrowDownUp,
  Radio,
  FileSearch,
} from 'lucide-react'
import DeviceStatusBadge from './DeviceStatusBadge.jsx'
import SeverityBadge from './SeverityBadge.jsx'

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}

function formatRate(bps) {
  if (!bps || bps === 0) return '0 B/s'
  if (bps >= 1048576) return `${(bps / 1048576).toFixed(1)} MB/s`
  if (bps >= 1024) return `${(bps / 1024).toFixed(1)} KB/s`
  return `${Math.round(bps)} B/s`
}

// Pure SVG sparkline component
function Sparkline({ data = [], color = 'var(--accent)', height = 36, width = 140 }) {
  if (!data || data.length < 2) {
    return <div className="sparkline-empty">Awaiting flow data...</div>
  }

  const values = data.map(d => Number(d.score || 0))
  const max = Math.max(1, ...values)
  const min = Math.min(0, ...values)
  const range = max - min || 1

  const points = values.map((val, idx) => {
    const x = (idx / (values.length - 1)) * width
    const y = height - ((val - min) / range) * (height - 6) - 3
    return `${x},${y}`
  }).join(' ')

  return (
    <svg width={width} height={height} className="sparkline-svg" aria-hidden="true">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  )
}

export default function DevicesView({
  devices = [],
  onRelease,
  onQuarantine,
  onOpenPacketDrillDown,
  isLoading = false,
}) {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState(null) // null = all, 'QUARANTINED', 'SUSPICIOUS', 'HEALTHY'

  const devList = Array.isArray(devices) ? devices : Object.values(devices || {})

  const filteredDevices = useMemo(() => {
    return devList.filter(d => {
      if (statusFilter && (d.status || '').toUpperCase() !== statusFilter) return false
      if (searchTerm) {
        const term = searchTerm.toLowerCase()
        const ip = (d.ip || '').toLowerCase()
        const name = (d.name || '').toLowerCase()
        if (!ip.includes(term) && !name.includes(term)) return false
      }
      return true
    })
  }, [devList, statusFilter, searchTerm])

  const ORDER = { QUARANTINED: 0, SUSPICIOUS: 1, HEALTHY: 2 }
  const sorted = [...filteredDevices].sort(
    (a, b) => (ORDER[(a.status || '').toUpperCase()] ?? 9) - (ORDER[(b.status || '').toUpperCase()] ?? 9)
  )

  return (
    <div className="ids-devices-container" role="region" aria-label="Network Devices Manager">
      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <div className="devices-toolbar panel">
        <div className="alerts-search-box">
          <Search size={16} className="search-icon" aria-hidden="true" />
          <input
            type="text"
            className="search-input"
            placeholder="Search device IP or friendly name..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            aria-label="Search devices"
          />
        </div>

        <div className="alerts-sev-filters" role="group" aria-label="Filter devices by status">
          <button
            className={`sev-filter-btn ${statusFilter === null ? 'active' : ''}`}
            onClick={() => setStatusFilter(null)}
          >
            All Devices ({devList.length})
          </button>
          <button
            className={`sev-filter-btn sev-filter-1 ${statusFilter === 'QUARANTINED' ? 'active' : ''}`}
            onClick={() => setStatusFilter(prev => (prev === 'QUARANTINED' ? null : 'QUARANTINED'))}
          >
            <Lock size={12} aria-hidden="true" />
            <span>Quarantined ({devList.filter(d => d.status === 'QUARANTINED').length})</span>
          </button>
          <button
            className={`sev-filter-btn sev-filter-2 ${statusFilter === 'SUSPICIOUS' ? 'active' : ''}`}
            onClick={() => setStatusFilter(prev => (prev === 'SUSPICIOUS' ? null : 'SUSPICIOUS'))}
          >
            <AlertTriangle size={12} aria-hidden="true" />
            <span>Suspicious ({devList.filter(d => d.status === 'SUSPICIOUS').length})</span>
          </button>
          <button
            className={`sev-filter-btn sev-filter-3 ${statusFilter === 'HEALTHY' ? 'active' : ''}`}
            onClick={() => setStatusFilter(prev => (prev === 'HEALTHY' ? null : 'HEALTHY'))}
          >
            <span>Healthy ({devList.filter(d => d.status === 'HEALTHY').length})</span>
          </button>
        </div>
      </div>

      {/* ── Devices Cards Grid ─────────────────────────────────────────────── */}
      <div className="devices-grid-wrapper">
        {isLoading ? (
          <div className="table-loading-state">
            <div className="spinner" />
            <span>Discovering network devices...</span>
          </div>
        ) : sorted.length === 0 ? (
          <div className="glass-empty-state">
            <Server size={38} style={{ opacity: 0.25 }} aria-hidden="true" />
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
              No devices found
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
              Flows and alerts in eve.json will automatically register active IPs.
            </div>
          </div>
        ) : (
          <div className="devices-card-grid">
            {sorted.map(dev => {
              const isQuarantined = (dev.status || '').toUpperCase() === 'QUARANTINED'
              const isSuspicious = (dev.status || '').toUpperCase() === 'SUSPICIOUS'
              const recentAlerts = dev.recent_alerts || []

              return (
                <motion.article
                  key={dev.ip}
                  className={`panel device-card ${isQuarantined ? 'device-card--quarantined' : isSuspicious ? 'device-card--suspicious' : ''}`}
                  whileHover={{ y: -2 }}
                  transition={{ duration: 0.15 }}
                  aria-label={`Device ${dev.ip}`}
                >
                  {/* Card Header */}
                  <div className="device-card-header">
                    <div className="device-id-block">
                      <div className="device-name">{dev.name || 'IoT Device'}</div>
                      <div className="device-ip-mono">{dev.ip}</div>
                    </div>
                    <DeviceStatusBadge status={dev.status} />
                  </div>

                  {/* Flow Rates & Sparklines */}
                  <div className="device-stats-row">
                    <div className="flow-rate-block">
                      <div className="flow-rate-label">Traffic Rate</div>
                      <div className="flow-rate-value">{formatRate(dev.bps)}</div>
                      <Sparkline
                        data={dev.history_bps}
                        color="var(--accent)"
                        height={32}
                        width={130}
                      />
                    </div>

                    <div className="flow-rate-block">
                      <div className="flow-rate-label">Packet Rate</div>
                      <div className="flow-rate-value">{Math.round(dev.pps || 0)} pkts/s</div>
                      <Sparkline
                        data={dev.history_pps}
                        color="var(--purple)"
                        height={32}
                        width={130}
                      />
                    </div>
                  </div>

                  {/* Data In / Out Totals */}
                  <div className="device-totals-bar">
                    <div className="total-metric">
                      <span className="total-label">Bytes In:</span>
                      <span className="total-val">{formatBytes(dev.bytes_in)}</span>
                    </div>
                    <div className="total-metric">
                      <span className="total-label">Bytes Out:</span>
                      <span className="total-val">{formatBytes(dev.bytes_out)}</span>
                    </div>
                    <div className="total-metric">
                      <span className="total-label">Total Flows:</span>
                      <span className="total-val">{dev.flow_count || 0}</span>
                    </div>
                  </div>

                  {/* Recent Alerts Section */}
                  <div className="device-alerts-section">
                    <div className="device-alerts-title">
                      <span>Recent Alerts ({recentAlerts.length})</span>
                    </div>
                    {recentAlerts.length === 0 ? (
                      <div className="device-alerts-clean">No recent IDS alerts on this device.</div>
                    ) : (
                      <div className="device-alerts-mini-list">
                        {recentAlerts.slice(-3).reverse().map((al, idx) => (
                          <div key={idx} className="device-alert-mini-item">
                            <SeverityBadge severity={al.alert?.severity} compact />
                            <span className="mini-alert-sig" title={al.alert?.signature}>
                              {al.alert?.signature}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Card Actions */}
                  <div className="device-card-actions">
                    {isQuarantined || isSuspicious ? (
                      <button
                        className="btn-action-release"
                        onClick={() => onRelease && onRelease(dev.ip)}
                        aria-label={`Release ${dev.ip} to Healthy`}
                      >
                        <Unlock size={14} aria-hidden="true" />
                        <span>Release to Healthy</span>
                      </button>
                    ) : (
                      <button
                        className="btn-action-quarantine"
                        onClick={() => onQuarantine && onQuarantine(dev.ip)}
                        aria-label={`Quarantine ${dev.ip}`}
                      >
                        <Lock size={14} aria-hidden="true" />
                        <span>Quarantine Device</span>
                      </button>
                    )}

                    {onOpenPacketDrillDown && (
                      <button
                        className="btn-action-packets"
                        onClick={() => onOpenPacketDrillDown(dev.ip)}
                        title="Drill down into packet captures"
                        aria-label={`Inspect packets for ${dev.ip}`}
                      >
                        <FileSearch size={14} aria-hidden="true" />
                        <span>Drill-Down</span>
                      </button>
                    )}
                  </div>
                </motion.article>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
