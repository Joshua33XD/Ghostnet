// Overview View — IDS High-Level Network Health & Alert Activity
import React from 'react'
import { motion } from 'framer-motion'
import {
  Shield,
  Lock,
  AlertTriangle,
  ShieldCheck,
  Activity,
  ArrowRight,
  TrendingUp,
  Radio,
  Clock,
} from 'lucide-react'
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

export default function OverviewView({
  devices = [],
  stats = {},
  alerts = [],
  events = [],
  onNavigate,
  onSelectDevice,
  isLoading = false,
}) {
  const devList = Array.isArray(devices) ? devices : Object.values(devices || {})
  const quarantinedCount = devList.filter(d => (d.status || '').toUpperCase() === 'QUARANTINED').length
  const suspiciousCount = devList.filter(d => (d.status || '').toUpperCase() === 'SUSPICIOUS').length
  const healthyCount = devList.filter(d => (d.status || '').toUpperCase() === 'HEALTHY').length

  const sev1 = stats.severity_counts?.['1'] || 0
  const sev2 = stats.severity_counts?.['2'] || 0
  const sev3 = stats.severity_counts?.['3'] || 0
  const totalAlerts = sev1 + sev2 + sev3

  const topSigs = stats.top_signatures || []
  const minuteData = stats.alerts_per_minute || []
  const maxMinuteCount = Math.max(1, ...minuteData.map(m => m.count || 0))

  return (
    <div className="ids-overview-container" role="region" aria-label="IDS Overview Dashboard">
      {/* ── 1. Device Status Metric Cards ─────────────────────────────────── */}
      <section className="ids-metrics-grid" aria-label="Key Security Metrics">
        <motion.div
          className="metric-card metric-card--danger"
          whileHover={{ y: -2 }}
          transition={{ duration: 0.15 }}
          onClick={() => onNavigate && onNavigate('devices')}
          role="button"
          tabIndex={0}
          aria-label={`${quarantinedCount} Quarantined Devices. Click to view devices.`}
        >
          <div className="metric-header">
            <span className="metric-title">QUARANTINED</span>
            <div className="metric-icon-wrap metric-icon--danger">
              <Lock size={18} aria-hidden="true" />
            </div>
          </div>
          <div className="metric-value-row">
            <span className="metric-number">{quarantinedCount}</span>
            <span className="metric-status-text">DEVICES ISOLATED</span>
          </div>
          <div className="metric-footer">
            <span className="metric-subtext">Severity 1-2 active threats</span>
            <ArrowRight size={13} className="metric-arrow" aria-hidden="true" />
          </div>
        </motion.div>

        <motion.div
          className="metric-card metric-card--warn"
          whileHover={{ y: -2 }}
          transition={{ duration: 0.15 }}
          onClick={() => onNavigate && onNavigate('devices')}
          role="button"
          tabIndex={0}
          aria-label={`${suspiciousCount} Suspicious Devices. Click to view devices.`}
        >
          <div className="metric-header">
            <span className="metric-title">SUSPICIOUS</span>
            <div className="metric-icon-wrap metric-icon--warn">
              <AlertTriangle size={18} aria-hidden="true" />
            </div>
          </div>
          <div className="metric-value-row">
            <span className="metric-number">{suspiciousCount}</span>
            <span className="metric-status-text">UNDER WATCH</span>
          </div>
          <div className="metric-footer">
            <span className="metric-subtext">Severity 3 alert detected</span>
            <ArrowRight size={13} className="metric-arrow" aria-hidden="true" />
          </div>
        </motion.div>

        <motion.div
          className="metric-card metric-card--healthy"
          whileHover={{ y: -2 }}
          transition={{ duration: 0.15 }}
          onClick={() => onNavigate && onNavigate('devices')}
          role="button"
          tabIndex={0}
          aria-label={`${healthyCount} Healthy Devices. Click to view devices.`}
        >
          <div className="metric-header">
            <span className="metric-title">HEALTHY</span>
            <div className="metric-icon-wrap metric-icon--healthy">
              <ShieldCheck size={18} aria-hidden="true" />
            </div>
          </div>
          <div className="metric-value-row">
            <span className="metric-number">{healthyCount}</span>
            <span className="metric-status-text">NORMAL BEHAVIOUR</span>
          </div>
          <div className="metric-footer">
            <span className="metric-subtext">Clean telemetry window</span>
            <ArrowRight size={13} className="metric-arrow" aria-hidden="true" />
          </div>
        </motion.div>

        <motion.div
          className="metric-card metric-card--throughput"
          whileHover={{ y: -2 }}
          transition={{ duration: 0.15 }}
          aria-label="Network Throughput"
        >
          <div className="metric-header">
            <span className="metric-title">NETWORK TRAFFIC</span>
            <div className="metric-icon-wrap metric-icon--info">
              <Activity size={18} aria-hidden="true" />
            </div>
          </div>
          <div className="metric-value-row">
            <span className="metric-number" style={{ fontSize: 'var(--text-lg)' }}>
              {formatRate(stats.total_bps)}
            </span>
            <span className="metric-status-text">{Math.round(stats.total_pps || 0)} pkts/s</span>
          </div>
          <div className="metric-footer">
            <span className="metric-subtext">{formatBytes(stats.total_bytes)} total recorded</span>
            <span className="live-pulse-badge">
              <span className="live-pulse-dot" /> LIVE
            </span>
          </div>
        </motion.div>
      </section>

      {/* ── 2. Middle Grid: Alerts Chart + Severity Breakdown ─────────────── */}
      <div className="ids-middle-grid">
        {/* Alerts-Per-Minute Chart */}
        <section className="panel ids-chart-panel" aria-label="Alert Frequency Over Time">
          <div className="panel-header">
            <div className="panel-title">
              <TrendingUp size={16} className="panel-title-icon-lucide" aria-hidden="true" />
              Alerts Per Minute
            </div>
            <span className="panel-badge-subtle">Last 20 minutes</span>
          </div>
          <div className="panel-body ids-chart-body">
            {minuteData.length === 0 ? (
              <div className="chart-empty-state">
                <Clock size={28} style={{ opacity: 0.3 }} aria-hidden="true" />
                <span>Waiting for traffic events...</span>
              </div>
            ) : (
              <div className="histogram-bars-wrapper" role="img" aria-label="Alerts per minute chart">
                {minuteData.map((item, idx) => {
                  const heightPct = Math.max(8, Math.round((item.count / maxMinuteCount) * 100))
                  const timeLabel = (item.minute || '').split('T')[1]?.substring(0, 5) || ''
                  return (
                    <div key={idx} className="histogram-col" title={`${item.minute}: ${item.count} alerts`}>
                      <div className="histogram-bar-track">
                        <motion.div
                          className="histogram-bar-fill"
                          initial={{ height: 0 }}
                          animate={{ height: `${heightPct}%` }}
                          transition={{ duration: 0.4, delay: idx * 0.02 }}
                        />
                      </div>
                      <span className="histogram-bar-count">{item.count}</span>
                      <span className="histogram-bar-label">{timeLabel}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </section>

        {/* Severity Breakdown */}
        <section className="panel ids-severity-panel" aria-label="Suricata Severity Breakdown">
          <div className="panel-header">
            <div className="panel-title">
              <Shield size={16} className="panel-title-icon-lucide" aria-hidden="true" />
              Severity Breakdown
            </div>
            <span className="panel-badge-subtle">{totalAlerts} Total Alerts</span>
          </div>
          <div className="panel-body ids-severity-body">
            {/* Visual Segment Bar */}
            <div className="severity-bar-segment" role="progressbar" aria-valuenow={totalAlerts} aria-valuemin={0}>
              <div
                className="severity-segment sev-1-bg"
                style={{ width: `${totalAlerts > 0 ? (sev1 / totalAlerts) * 100 : 0}%` }}
                title={`Sev 1: ${sev1}`}
              />
              <div
                className="severity-segment sev-2-bg"
                style={{ width: `${totalAlerts > 0 ? (sev2 / totalAlerts) * 100 : 0}%` }}
                title={`Sev 2: ${sev2}`}
              />
              <div
                className="severity-segment sev-3-bg"
                style={{ width: `${totalAlerts > 0 ? (sev3 / totalAlerts) * 100 : 0}%` }}
                title={`Sev 3: ${sev3}`}
              />
            </div>

            {/* Accessible Severity Rows (Text + Icon + Counts) */}
            <div className="severity-list">
              <div className="severity-row">
                <SeverityBadge severity={1} />
                <span className="severity-row-pct">
                  {totalAlerts > 0 ? Math.round((sev1 / totalAlerts) * 100) : 0}%
                </span>
                <span className="severity-row-count">{sev1} alerts</span>
              </div>

              <div className="severity-row">
                <SeverityBadge severity={2} />
                <span className="severity-row-pct">
                  {totalAlerts > 0 ? Math.round((sev2 / totalAlerts) * 100) : 0}%
                </span>
                <span className="severity-row-count">{sev2} alerts</span>
              </div>

              <div className="severity-row">
                <SeverityBadge severity={3} />
                <span className="severity-row-pct">
                  {totalAlerts > 0 ? Math.round((sev3 / totalAlerts) * 100) : 0}%
                </span>
                <span className="severity-row-count">{sev3} alerts</span>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* ── 3. Bottom Grid: Top Signatures & Live Alert Feed ───────────────── */}
      <div className="ids-bottom-grid">
        {/* Top Signatures */}
        <section className="panel ids-signatures-panel" aria-label="Top Suricata Signatures">
          <div className="panel-header">
            <div className="panel-title">
              <Radio size={16} className="panel-title-icon-lucide" aria-hidden="true" />
              Top Triggered Signatures
            </div>
            <button className="view-all-btn" onClick={() => onNavigate && onNavigate('alerts')}>
              All Alerts →
            </button>
          </div>
          <div className="panel-body ids-signatures-body">
            {topSigs.length === 0 ? (
              <div className="panel-empty-state">No signatures triggered yet</div>
            ) : (
              <div className="signatures-list">
                {topSigs.map((sig, idx) => (
                  <div key={idx} className="signature-item">
                    <div className="signature-info">
                      <SeverityBadge severity={sig.severity} compact />
                      <span className="signature-name" title={sig.signature}>
                        {sig.signature}
                      </span>
                    </div>
                    <span className="signature-count-badge">{sig.count} events</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Live Alert Feed */}
        <section className="panel ids-feed-panel" aria-label="Live Alert Event Feed">
          <div className="panel-header">
            <div className="panel-title">
              <span className="live-pulse-dot" aria-hidden="true" />
              Live Alert Feed
            </div>
            <span className="panel-badge-subtle">Real-time WebSocket</span>
          </div>
          <div className="panel-body ids-feed-body">
            {alerts.length === 0 ? (
              <div className="panel-empty-state">
                <ShieldCheck size={28} style={{ opacity: 0.3 }} aria-hidden="true" />
                <span>No security alerts detected</span>
              </div>
            ) : (
              <div className="live-feed-list">
                {alerts.slice(-10).reverse().map((al, idx) => {
                  const sig = al.alert?.signature || 'Suricata Alert'
                  const sev = al.alert?.severity || 3
                  const src = al.src_ip || '0.0.0.0'
                  const dst = al.dest_ip || '0.0.0.0'
                  const timeStr = al.timestamp_iso
                    ? new Date(al.timestamp * 1000).toLocaleTimeString()
                    : new Date().toLocaleTimeString()

                  return (
                    <motion.div
                      key={idx}
                      className="feed-item"
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <div className="feed-item-top">
                        <SeverityBadge severity={sev} compact />
                        <span className="feed-item-time">{timeStr}</span>
                      </div>
                      <div className="feed-item-sig">{sig}</div>
                      <div className="feed-item-route">
                        <span className="feed-ip">{src}</span>
                        <span className="feed-arrow">→</span>
                        <span className="feed-ip">{dst}</span>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
