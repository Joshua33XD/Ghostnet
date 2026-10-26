import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Filter, ShieldAlert, Copy, Check, ExternalLink, X, Terminal, ArrowRight, ShieldX } from 'lucide-react'

export default function AlertsView({
  alerts = [],
  devices = [],
  onSelectDevice,
  isLoading = false,
}) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedSev, setSelectedSev] = useState(null)
  const [selectedIp, setSelectedIp] = useState('')
  const [selectedAlert, setSelectedAlert] = useState(null)
  const [copied, setCopied] = useState(false)
  const [copiedFilter, setCopiedFilter] = useState(false)

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
        if (![sig, cat, src, dst, proto].some(v => v.includes(term))) return false
      }
      return true
    })
  }, [alerts, selectedSev, selectedIp, searchTerm])

  const sortedAlerts = useMemo(
    () => [...filteredAlerts].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)),
    [filteredAlerts]
  )

  const sev1Count = alerts.filter(a => (a.alert?.severity || 3) === 1).length
  const sev2Count = alerts.filter(a => (a.alert?.severity || 3) === 2).length
  const sev3Count = alerts.filter(a => (a.alert?.severity || 3) === 3).length

  const handleCopyJson = () => {
    if (!selectedAlert) return
    navigator.clipboard.writeText(JSON.stringify(selectedAlert, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const generatedFilter = useMemo(() => {
    if (!selectedAlert) return ''
    const src = selectedAlert.src_ip
    const dstPort = selectedAlert.dest_port
    const proto = (selectedAlert.proto || 'tcp').toLowerCase()
    if (dstPort) {
      return `ip.src == ${src} && ${proto}.port == ${dstPort}`
    }
    return `ip.addr == ${src}`
  }, [selectedAlert])

  const handleCopyFilter = () => {
    if (!generatedFilter) return
    navigator.clipboard.writeText(generatedFilter)
    setCopiedFilter(true)
    setTimeout(() => setCopiedFilter(false), 2000)
  }

  return (
    <div className="soc-alerts-view">
      {/* View Title */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h1 style={{ fontFamily: 'var(--wf-mono)', fontSize: 20, fontWeight: 700, margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Threat & Alert Ledger
          </h1>
          <span className="soc-badge" style={{ background: 'rgba(255,51,102,0.1)', color: 'var(--wf-stop)', border: '1px solid var(--wf-stop-border)' }}>
            SURICATA EVE LOGS ({alerts.length})
          </span>
        </div>
        <p style={{ margin: '4px 0 0', color: 'var(--wf-ink-soft)', fontSize: 13 }}>
          High-density stream of intrusion alerts, exploit signatures, and reconnaissance scans across the network segment.
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div className="soc-card" style={{ padding: 16, marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
          {/* Search Input */}
          <div className="soc-search-wrapper">
            <Search size={15} className="soc-search-icon" />
            <input
              type="text"
              placeholder="Search signature, category, IP address, protocol..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="soc-search-input"
            />
          </div>

          {/* Host Filter Dropdown */}
          <select
            value={selectedIp}
            onChange={(e) => setSelectedIp(e.target.value)}
            className="soc-search-input"
            style={{ width: 180, height: 40, padding: '0 10px' }}
          >
            <option value="">All Endpoints</option>
            {devices.map(d => (
              <option key={d.ip} value={d.ip}>{d.ip} ({d.name || 'Device'})</option>
            ))}
          </select>
        </div>

        {/* Severity Filter Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={() => setSelectedSev(null)}
            className="soc-badge"
            style={{
              background: selectedSev === null ? 'var(--wf-cyan)' : 'rgba(255,255,255,0.04)',
              color: selectedSev === null ? '#08090d' : 'var(--wf-ink-soft)',
              border: selectedSev === null ? 'none' : '1px solid var(--wf-line)',
              padding: '6px 12px',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            All Alerts ({alerts.length})
          </button>
          <button
            onClick={() => setSelectedSev(1)}
            className="soc-badge soc-badge-sev1"
            style={{
              padding: '6px 12px',
              cursor: 'pointer',
              boxShadow: selectedSev === 1 ? '0 0 14px rgba(255,51,102,0.4)' : 'none',
              borderWidth: selectedSev === 1 ? 2 : 1,
            }}
          >
            Sev 1 · Critical ({sev1Count})
          </button>
          <button
            onClick={() => setSelectedSev(2)}
            className="soc-badge soc-badge-sev2"
            style={{
              padding: '6px 12px',
              cursor: 'pointer',
              boxShadow: selectedSev === 2 ? '0 0 14px rgba(245,158,11,0.4)' : 'none',
              borderWidth: selectedSev === 2 ? 2 : 1,
            }}
          >
            Sev 2 · Medium ({sev2Count})
          </button>
          <button
            onClick={() => setSelectedSev(3)}
            className="soc-badge soc-badge-sev3"
            style={{
              padding: '6px 12px',
              cursor: 'pointer',
              boxShadow: selectedSev === 3 ? '0 0 14px rgba(168,85,247,0.4)' : 'none',
              borderWidth: selectedSev === 3 ? 2 : 1,
            }}
          >
            Sev 3 · Low ({sev3Count})
          </button>
        </div>
      </div>

      {/* Main Split Grid: Table (Left) + Forensics Inspector Drawer (Right) */}
      <div style={{ display: 'grid', gridTemplateColumns: selectedAlert ? '1.4fr 1fr' : '1fr', gap: 20 }}>
        {/* Alerts Table */}
        <div className="soc-table-wrapper" style={{ maxHeight: 620 }}>
          <table className="soc-table">
            <thead>
              <tr>
                <th style={{ width: 100 }}>Severity</th>
                <th style={{ width: 85 }}>Time</th>
                <th>Source Host</th>
                <th style={{ width: 30 }}></th>
                <th>Destination</th>
                <th style={{ width: 65 }}>Proto</th>
                <th>Alert Signature</th>
              </tr>
            </thead>
            <tbody>
              {sortedAlerts.map((al, idx) => {
                const sev = al.alert?.severity || 3
                const isSelected = selectedAlert === al
                return (
                  <tr
                    key={idx}
                    className={isSelected ? 'is-selected' : ''}
                    onClick={() => setSelectedAlert(al)}
                  >
                    <td>
                      <span className={`soc-badge ${sev === 1 ? 'soc-badge-sev1' : sev === 2 ? 'soc-badge-sev2' : 'soc-badge-sev3'}`}>
                        SEV {sev} {sev === 1 ? 'CRIT' : sev === 2 ? 'WARN' : 'INFO'}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'var(--wf-mono)', fontSize: 11, color: 'var(--wf-mute)' }}>
                      {al.timestamp ? new Date(al.timestamp).toLocaleTimeString() : 'Recent'}
                    </td>
                    <td style={{ fontFamily: 'var(--wf-mono)', fontWeight: 600, color: al.src_ip === '192.168.1.105' ? 'var(--wf-stop)' : 'var(--wf-ink)' }}>
                      {al.src_ip}
                    </td>
                    <td style={{ color: 'var(--wf-mute)', textAlign: 'center' }}>
                      <ArrowRight size={12} />
                    </td>
                    <td style={{ fontFamily: 'var(--wf-mono)', color: 'var(--wf-ink-soft)' }}>
                      {al.dest_ip}:{al.dest_port}
                    </td>
                    <td>
                      <span className="soc-badge soc-badge-proto">
                        {al.proto || 'TCP'}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'var(--wf-mono)', fontSize: 12, fontWeight: 500, color: sev === 1 ? '#ff99b0' : 'var(--wf-ink)' }}>
                      {al.alert?.signature}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Forensic Drawer Pane (When Row is Selected) */}
        {selectedAlert && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="soc-card soc-card-glow-stop"
            style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
          >
            <div className="soc-card-header">
              <div className="soc-card-title">
                <ShieldAlert size={15} style={{ color: 'var(--wf-stop)' }} />
                Forensic Incident Inspector
              </div>
              <button
                onClick={() => setSelectedAlert(null)}
                className="soc-btn soc-btn-ghost soc-btn-xs"
              >
                <X size={13} /> Close
              </button>
            </div>

            {/* Signature & Category Overview */}
            <div style={{ padding: 14, background: 'rgba(255, 51, 102, 0.08)', borderRadius: 8, border: '1px solid var(--wf-stop-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span className={`soc-badge ${selectedAlert.alert?.severity === 1 ? 'soc-badge-sev1' : 'soc-badge-sev2'}`}>
                  SEVERITY {selectedAlert.alert?.severity}
                </span>
                <span style={{ fontFamily: 'var(--wf-mono)', fontSize: 11, color: 'var(--wf-mute)' }}>
                  SID: {selectedAlert.alert?.signature_id || '1000001'} (rev {selectedAlert.alert?.rev || 1})
                </span>
              </div>
              <h3 style={{ fontFamily: 'var(--wf-mono)', fontSize: 13, fontWeight: 700, margin: 0, color: 'var(--wf-ink)' }}>
                {selectedAlert.alert?.signature}
              </h3>
              <p style={{ margin: '4px 0 0', color: 'var(--wf-ink-soft)', fontSize: 12 }}>
                Category: <b>{selectedAlert.alert?.category || 'Intrusion Detection'}</b>
              </p>
            </div>

            {/* Attack Endpoints */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 12 }}>
              <div style={{ padding: 10, background: 'rgba(255,255,255,0.03)', borderRadius: 6, border: '1px solid var(--wf-line)' }}>
                <span style={{ fontFamily: 'var(--wf-mono)', fontSize: 10, color: 'var(--wf-mute)' }}>ATTACKER / SRC:</span>
                <div style={{ fontFamily: 'var(--wf-mono)', fontSize: 13, fontWeight: 700, color: 'var(--wf-stop)', marginTop: 2 }}>
                  {selectedAlert.src_ip}
                </div>
                {onSelectDevice && (
                  <button
                    onClick={() => onSelectDevice(selectedAlert.src_ip)}
                    className="soc-btn soc-btn-ghost soc-btn-xs"
                    style={{ marginTop: 8, width: '100%' }}
                  >
                    View Host Profile <ExternalLink size={11} />
                  </button>
                )}
              </div>

              <div style={{ padding: 10, background: 'rgba(255,255,255,0.03)', borderRadius: 6, border: '1px solid var(--wf-line)' }}>
                <span style={{ fontFamily: 'var(--wf-mono)', fontSize: 10, color: 'var(--wf-mute)' }}>TARGET / DEST:</span>
                <div style={{ fontFamily: 'var(--wf-mono)', fontSize: 13, fontWeight: 700, color: 'var(--wf-cyan)', marginTop: 2 }}>
                  {selectedAlert.dest_ip}:{selectedAlert.dest_port}
                </div>
                <div style={{ fontFamily: 'var(--wf-mono)', fontSize: 11, color: 'var(--wf-ink-soft)', marginTop: 8 }}>
                  Protocol: {selectedAlert.proto}
                </div>
              </div>
            </div>

            {/* Generated Wireshark Filter */}
            <div style={{ padding: 10, background: 'rgba(0,242,254,0.05)', borderRadius: 6, border: '1px solid rgba(0,242,254,0.2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontFamily: 'var(--wf-mono)', fontSize: 10, color: 'var(--wf-cyan)', fontWeight: 700 }}>
                  WIRESHARK DISPLAY FILTER
                </span>
                <button
                  onClick={handleCopyFilter}
                  className="soc-btn soc-btn-ghost soc-btn-xs"
                  style={{ height: 22, fontSize: 10, padding: '2px 8px' }}
                >
                  {copiedFilter ? <Check size={11} /> : <Copy size={11} />} {copiedFilter ? 'Copied' : 'Copy'}
                </button>
              </div>
              <code style={{ fontFamily: 'var(--wf-mono)', fontSize: 11, color: 'var(--wf-ink)' }}>
                {generatedFilter}
              </code>
            </div>

            {/* Raw JSON Payload */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontFamily: 'var(--wf-mono)', fontSize: 11, color: 'var(--wf-mute)', fontWeight: 600 }}>
                  RAW EVE JSON RECORD
                </span>
                <button
                  onClick={handleCopyJson}
                  className="soc-btn soc-btn-ghost soc-btn-xs"
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? 'Copied' : 'Copy JSON'}
                </button>
              </div>
              <pre className="soc-code-block" style={{ maxHeight: 180, overflowY: 'auto' }}>
                <code>{JSON.stringify(selectedAlert, null, 2)}</code>
              </pre>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}
