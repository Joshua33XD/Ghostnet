// RightPanel — Connected Devices + Quick Actions + Device Details
import { useState } from 'react'
import { Shield, Route, FileText, Zap } from 'lucide-react'
import { getTrustScore, getTrustColor, formatElapsed, formatRate } from '../utils.js'

function trustClass(anomaly) {
  const t = getTrustScore(anomaly ?? 0)
  return t >= 0.75 ? 'high' : t >= 0.4 ? 'medium' : 'low'
}
function trustPct(anomaly) {
  return Math.round(getTrustScore(anomaly ?? 0) * 100)
}

function DeviceItem({ node, selected, onClick }) {
  const abbr = node.node_id.replace(/[^A-Za-z0-9]/g,'').slice(-3).toUpperCase() || 'N'
  return (
    <div className={`device-list-item${selected ? ' selected' : ''}`} onClick={onClick}>
      <div className={`device-avatar ${node.status}`}>{abbr}</div>
      <div className="device-info">
        <div className="device-name">{node.node_id}</div>
        <div className="device-ip">{node.ip_address ?? '—'}</div>
      </div>
      <span className={`trust-badge ${node.status === 'OFFLINE' ? 'offline' : trustClass(node.anomaly_score)}`}>
        {node.status === 'OFFLINE' ? 'Offline' : `Trust ${trustPct(node.anomaly_score)}%`}
      </span>
    </div>
  )
}

function DeviceDetail({ node, onRelease }) {
  const [tab, setTab] = useState('overview')
  const [confirming, setConfirming] = useState(false)
  if (!node) return (
    <div className="glass-empty-state" style={{ padding:24 }}>
      <Shield size={28} style={{ opacity:0.2 }} />
      <div style={{ fontSize:'var(--text-xs)', color:'var(--text-muted)' }}>Select a device</div>
    </div>
  )

  const trust = trustPct(node.anomaly_score)
  const trustColor = getTrustColor(node.anomaly_score ?? 0)

  const overviewFields = [
    ['IP Address',   node.ip_address ?? '—'],
    ['MAC Address',  node.mac_address ?? '—'],
    ['Device Type',  node.device_type ?? '—'],
    ['Location',     node.location ?? '—'],
    ['Trust Score',  `${trust} / 100`],
  ]
  const sensors = [
    node.temperature != null && { icon:'🌡', label:'Temperature', value:`${node.temperature?.toFixed(1)} °C` },
    node.humidity    != null && { icon:'💧', label:'Humidity',    value:`${node.humidity?.toFixed(1)}%` },
    node.ldr         != null && { icon:'☀', label:'LDR (Light)',  value:`${node.ldr} lux` },
    node.cpu_pct     != null && { icon:'⚙', label:'CPU',         value:`${node.cpu_pct?.toFixed(0)}%` },
    node.ram_pct     != null && { icon:'🧠', label:'RAM',         value:`${node.ram_pct?.toFixed(0)}%` },
  ].filter(Boolean)

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden' }}>
      {/* Status + name */}
      <div style={{ padding:'var(--sp-3)', borderBottom:'1px solid var(--border)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
          <span style={{ fontSize:'var(--text-sm)', fontWeight:700, fontFamily:'var(--font-mono)', color:'var(--text-primary)', flex:1 }}>
            {node.node_id}
          </span>
          <span className={`status-pill ${node.status}`}>{node.status}</span>
        </div>
        {/* Trust bar */}
        <div className="trust-bar-wrap">
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'var(--text-muted)' }}>
            <span>Trust Score</span>
            <span style={{ fontFamily:'var(--font-mono)', fontWeight:700, color:trustColor }}>{trust}%</span>
          </div>
          <div className="trust-bar-track">
            <div className="trust-bar-fill" style={{ width:`${trust}%`, background:trustColor }} />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="detail-tabs">
        {['overview','sensors','logs'].map(t => (
          <button key={t} className={`detail-tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Tab body */}
      <div style={{ flex:1, overflowY:'auto', padding:'var(--sp-3)' }}>
        {tab === 'overview' && (
          <div>
            {overviewFields.map(([k,v]) => (
              <div key={k} className="detail-field">
                <span className="detail-field-label">{k}</span>
                <span className="detail-field-value">{v}</span>
              </div>
            ))}
          </div>
        )}
        {tab === 'sensors' && (
          sensors.length > 0 ? (
            <div>
              {sensors.map(s => (
                <div key={s.label} className="sensor-row">
                  <span className="sensor-icon">{s.icon}</span>
                  <span className="sensor-label">{s.label}</span>
                  <span className="sensor-value">{s.value}</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color:'var(--text-muted)', fontSize:'var(--text-xs)', textAlign:'center', paddingTop:16 }}>No sensor data</div>
          )
        )}
        {tab === 'logs' && (
          <div style={{ color:'var(--text-muted)', fontSize:'var(--text-xs)', textAlign:'center', paddingTop:16 }}>
            Switch to <strong>Logs</strong> tab for full event history
          </div>
        )}
      </div>

      {/* Action button */}
      {node.status === 'QUARANTINED' && onRelease && (
        <div style={{ padding:'var(--sp-3)', borderTop:'1px solid var(--border)', flexShrink:0 }} onClick={e => e.stopPropagation()}>
          {!confirming ? (
            <button className="release-btn" onClick={() => setConfirming(true)}>
              ⚡ Isolate Device
            </button>
          ) : (
            <div className="confirm-release-panel">
              <div className="confirm-release-msg">Release <strong>{node.node_id}</strong>?</div>
              <div className="confirm-release-btns">
                <button className="confirm-yes-btn" onClick={() => { onRelease(node.node_id); setConfirming(false) }}>Confirm</button>
                <button className="confirm-cancel-btn" onClick={() => setConfirming(false)}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function RightPanel({ nodes, selectedNode, onSelectNode, onRelease, events }) {
  const sortedNodes = Object.values(nodes).sort((a, b) => {
    const ORDER = { QUARANTINED:0, SUSPICIOUS:1, OFFLINE:2, HEALTHY:3 }
    return (ORDER[a.status] ?? 9) - (ORDER[b.status] ?? 9)
  })

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', gap:'var(--sp-3)' }}>
      {/* Connected Devices */}
      <div className="panel" style={{ flex:1, overflow:'hidden', minHeight:0 }}>
        <div className="panel-header">
          <div className="panel-title">Connected Devices</div>
          <button className="view-all-btn">View All →</button>
        </div>
        <div style={{ flex:1, overflowY:'auto' }}>
          {sortedNodes.length === 0 ? (
            <div className="glass-empty-state" style={{ padding:20 }}>
              <Shield size={24} style={{ opacity:0.2 }} />
              <span style={{ fontSize:'var(--text-xs)' }}>No devices</span>
            </div>
          ) : sortedNodes.map(node => (
            <DeviceItem
              key={node.node_id}
              node={node}
              selected={selectedNode?.node_id === node.node_id}
              onClick={() => onSelectNode(node)}
            />
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="panel">
        <div className="panel-header">
          <div className="panel-title">Quick Actions</div>
        </div>
        <div className="panel-body">
          <div className="quick-actions-grid">
            {[
              { icon:Shield,   label:'Isolate Node',     color:'danger' },
              { icon:Route,    label:'Reconfigure Route', color:'' },
              { icon:FileText, label:'View Logs',         color:'' },
            ].map(({ icon:Icon, label, color }) => (
              <button key={label} className={`quick-action-btn${color ? ` ${color}` : ''}`}>
                <Icon size={18} />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Device Details */}
      <div className="panel" style={{ flex:'0 0 300px', overflow:'hidden' }}>
        <div className="panel-header">
          <div className="panel-title">Device Details</div>
          {selectedNode && <span className={`status-pill ${selectedNode.status}`}>{selectedNode.status}</span>}
        </div>
        <div style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column' }}>
          <DeviceDetail node={selectedNode} onRelease={onRelease} />
        </div>
      </div>
    </div>
  )
}
