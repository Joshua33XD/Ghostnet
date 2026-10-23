// Alerts View — Filterable Suricata EVE Alerts Table with Expandable Raw JSON
import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  Filter,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  ShieldAlert,
  AlertTriangle,
  Info,
  X,
  FileCode,
} from 'lucide-react'
import SeverityBadge from './SeverityBadge.jsx'

export default function AlertsView({
  alerts = [],
  devices = [],
  onSelectDevice,
  isLoading = false,
}) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedSev, setSelectedSev] = useState(null) // null = all, 1, 2, 3
  const [selectedIp, setSelectedIp] = useState('')
  const [expandedRowId, setExpandedRowId] = useState(null)
  const [copiedId, setCopiedId] = useState(null)

  // Map device IP to friendly name for quick display
  const deviceNameMap = useMemo(() => {
    const map = {}
    const list = Array.isArray(devices) ? devices : Object.values(devices || {})
    list.forEach(d => {
      if (d.ip) map[d.ip] = d.name || d.ip
    })
    return map
  }, [devices])

  // Filter alerts
  const filteredAlerts = useMemo(() => {
    return alerts.filter(al => {
      const sev = al.alert?.severity
      if (selectedSev !== null && sev !== selectedSev) return false
      if (selectedIp && al.src_ip !== selectedIp && al.dest_ip !== selectedIp) return false

      if (searchTerm) {
        const term = searchTerm.toLowerCase()
        const sig = (al.alert?.signature || '').toLowerCase()
        const cat = (al.alert?.category || '').toLowerCase()
        const src = (al.src_ip || '').toLowerCase()
        const dst = (al.dest_ip || '').toLowerCase()
        const proto = (al.proto || '').toLowerCase()
        if (
          !sig.includes(term) &&
          !cat.includes(term) &&
          !src.includes(term) &&
          !dst.includes(term) &&
          !proto.includes(term)
        ) {
          return false
        }
      }
      return true
    })
  }, [alerts, selectedSev, selectedIp, searchTerm])

  const handleCopyJson = (id, raw) => {
    navigator.clipboard.writeText(JSON.stringify(raw, null, 2))
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const toggleRow = (id) => {
    setExpandedRowId(prev => (prev === id ? null : id))
  }

  const resetFilters = () => {
    setSearchTerm('')
    setSelectedSev(null)
    setSelectedIp('')
  }

  return (
    <div className="ids-alerts-container" role="region" aria-label="Suricata Alerts Explorer">
      {/* ── Toolbar: Search & Severity Filters ─────────────────────────────── */}
      <div className="alerts-toolbar panel">
        <div className="alerts-search-box">
          <Search size={16} className="search-icon" aria-hidden="true" />
          <input
            type="text"
            className="search-input"
            placeholder="Search signatures, IPs, categories, protocols..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            aria-label="Search alerts"
          />
          {searchTerm && (
            <button
              className="search-clear-btn"
              onClick={() => setSearchTerm('')}
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Severity filter toggles */}
        <div className="alerts-sev-filters" role="group" aria-label="Filter by Severity">
          <button
            className={`sev-filter-btn ${selectedSev === null ? 'active' : ''}`}
            onClick={() => setSelectedSev(null)}
          >
            All Severities
          </button>
          <button
            className={`sev-filter-btn sev-filter-1 ${selectedSev === 1 ? 'active' : ''}`}
            onClick={() => setSelectedSev(prev => (prev === 1 ? null : 1))}
            aria-pressed={selectedSev === 1}
          >
            <ShieldAlert size={13} aria-hidden="true" />
            <span>Sev 1 (Critical)</span>
          </button>
          <button
            className={`sev-filter-btn sev-filter-2 ${selectedSev === 2 ? 'active' : ''}`}
            onClick={() => setSelectedSev(prev => (prev === 2 ? null : 2))}
            aria-pressed={selectedSev === 2}
          >
            <AlertTriangle size={13} aria-hidden="true" />
            <span>Sev 2 (Medium)</span>
          </button>
          <button
            className={`sev-filter-btn sev-filter-3 ${selectedSev === 3 ? 'active' : ''}`}
            onClick={() => setSelectedSev(prev => (prev === 3 ? null : 3))}
            aria-pressed={selectedSev === 3}
          >
            <Info size={13} aria-hidden="true" />
            <span>Sev 3 (Low)</span>
          </button>
        </div>

        {/* IP Selector */}
        <div className="alerts-ip-filter">
          <select
            className="ip-select"
            value={selectedIp}
            onChange={e => setSelectedIp(e.target.value)}
            aria-label="Filter by Device IP"
          >
            <option value="">All Device IPs</option>
            {devices.map(d => (
              <option key={d.ip} value={d.ip}>
                {d.ip} ({d.name || 'Device'})
              </option>
            ))}
          </select>
        </div>

        {(searchTerm || selectedSev !== null || selectedIp) && (
          <button className="reset-filter-btn" onClick={resetFilters}>
            Clear Filters
          </button>
        )}
      </div>

      {/* ── Table Panel ────────────────────────────────────────────────────── */}
      <div className="panel alerts-table-panel">
        <div className="panel-header">
          <div className="panel-title">
            <Filter size={16} className="panel-title-icon-lucide" aria-hidden="true" />
            Suricata EVE Alerts
          </div>
          <span className="panel-badge-subtle">
            Showing {filteredAlerts.length} of {alerts.length} events
          </span>
        </div>

        <div className="alerts-table-wrapper">
          {isLoading ? (
            <div className="table-loading-state">
              <div className="spinner" />
              <span>Loading telemetry alerts...</span>
            </div>
          ) : filteredAlerts.length === 0 ? (
            <div className="glass-empty-state">
              <ShieldAlert size={36} style={{ opacity: 0.25 }} aria-hidden="true" />
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                No alerts match current criteria
              </div>
              <button className="btn-secondary" style={{ marginTop: 'var(--sp-2)' }} onClick={resetFilters}>
                Reset Filter
              </button>
            </div>
          ) : (
            <table className="ids-table" aria-label="Security alerts list">
              <thead>
                <tr>
                  <th scope="col" style={{ width: '40px' }}><span className="sr-only">Expand</span></th>
                  <th scope="col" style={{ width: '130px' }}>Severity</th>
                  <th scope="col" style={{ width: '110px' }}>Time</th>
                  <th scope="col">Source Device</th>
                  <th scope="col">Destination</th>
                  <th scope="col" style={{ width: '70px' }}>Proto</th>
                  <th scope="col">Signature / Category</th>
                </tr>
              </thead>
              <tbody>
                {filteredAlerts.slice().reverse().map((al, idx) => {
                  const rowId = `alert-${idx}-${al.timestamp}`
                  const isExpanded = expandedRowId === rowId
                  const sev = al.alert?.severity || 3
                  const sig = al.alert?.signature || 'Suricata Alert'
                  const cat = al.alert?.category || 'Security Event'
                  const src = al.src_ip || '0.0.0.0'
                  const srcName = deviceNameMap[src] || src
                  const dst = al.dest_ip || '0.0.0.0'
                  const dstPort = al.dest_port ? `:${al.dest_port}` : ''
                  const timeStr = new Date(al.timestamp * 1000).toLocaleTimeString()

                  return (
                    <React.Fragment key={rowId}>
                      <tr
                        className={`ids-table-row ${isExpanded ? 'row-expanded' : ''}`}
                        onClick={() => toggleRow(rowId)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && toggleRow(rowId)}
                        aria-expanded={isExpanded}
                      >
                        <td className="cell-expand">
                          {isExpanded ? (
                            <ChevronDown size={14} aria-hidden="true" />
                          ) : (
                            <ChevronRight size={14} aria-hidden="true" />
                          )}
                        </td>
                        <td>
                          <SeverityBadge severity={sev} />
                        </td>
                        <td className="cell-time">{timeStr}</td>
                        <td className="cell-device">
                          <span
                            className="device-link"
                            onClick={e => {
                              e.stopPropagation()
                              onSelectDevice && onSelectDevice(src)
                            }}
                            title={`Inspect ${src}`}
                          >
                            <strong>{src}</strong>
                            {srcName !== src && <span className="device-friendly">({srcName})</span>}
                            <ExternalLink size={11} className="device-link-icon" aria-hidden="true" />
                          </span>
                        </td>
                        <td className="cell-dst">
                          <span className="mono-text">{dst}{dstPort}</span>
                        </td>
                        <td>
                          <span className="proto-badge">{al.proto || 'TCP'}</span>
                        </td>
                        <td className="cell-sig">
                          <div className="sig-text">{sig}</div>
                          <div className="sig-cat">{cat}</div>
                        </td>
                      </tr>

                      {/* Expandable Raw JSON Record */}
                      {isExpanded && (
                        <tr className="ids-expanded-row">
                          <td colSpan={7}>
                            <div className="raw-json-container">
                              <div className="raw-json-header">
                                <div className="raw-json-title">
                                  <FileCode size={14} aria-hidden="true" />
                                  <span>Suricata EVE JSON Record</span>
                                </div>
                                <button
                                  className="btn-copy-json"
                                  onClick={e => {
                                    e.stopPropagation()
                                    handleCopyJson(rowId, al.raw || al)
                                  }}
                                  aria-label="Copy raw EVE JSON to clipboard"
                                >
                                  {copiedId === rowId ? (
                                    <>
                                      <Check size={12} style={{ color: 'var(--status-healthy)' }} />
                                      <span>Copied!</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy size={12} />
                                      <span>Copy JSON</span>
                                    </>
                                  )}
                                </button>
                              </div>
                              <pre className="raw-json-body">
                                <code>{JSON.stringify(al.raw || al, null, 2)}</code>
                              </pre>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
