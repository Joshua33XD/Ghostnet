import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { AlertCircle, Download, FileCode, FileSearch, Play, X } from 'lucide-react'
import { getApiUrl } from '../apiConfig.js'
import TactileButton from './TactileButton.jsx'

export default function PacketDrillDownModal({
  isOpen,
  onClose,
  initialIp = '',
  fetchCaptureFiles,
  inspectPackets,
}) {
  const reduced = useReducedMotion()
  const [files, setFiles] = useState([])
  const [selectedFile, setSelectedFile] = useState('')
  const [filter, setFilter] = useState('')
  const [packets, setPackets] = useState([])
  const [loading, setLoading] = useState(false)
  const [tsharkStatus, setTsharkStatus] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (!isOpen) return
    if (initialIp) setFilter(`ip.addr == ${initialIp}`)
    fetchCaptureFiles().then(res => {
      setFiles(res || [])
      setSelectedFile(prev => prev || res?.[0]?.filename || '')
    })
  }, [isOpen, initialIp, fetchCaptureFiles])

  useEffect(() => {
    if (!isOpen) return undefined
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  const handleInspect = async () => {
    if (!selectedFile) return
    setLoading(true)
    setErrorMsg('')
    try {
      const res = await inspectPackets(selectedFile, filter, 50)
      if (res.tshark_available === false) {
        setTsharkStatus('missing')
        setPackets([])
        setErrorMsg(res.message || 'tshark is not installed. PCAP download is still available.')
      } else if (res.error) {
        setTsharkStatus('error')
        setErrorMsg(res.error)
        setPackets([])
      } else {
        setTsharkStatus('ok')
        setPackets(res.packets || [])
      }
    } catch (e) {
      setErrorMsg(String(e))
    } finally {
      setLoading(false)
    }
  }

  const apiUrl = getApiUrl()

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="wf-overlay"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label="Packet drill-down"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="wf-drawer"
            onClick={e => e.stopPropagation()}
            initial={reduced ? { opacity: 0 } : { x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={reduced ? { opacity: 0 } : { x: 24, opacity: 0 }}
          >
            <div className="wf-drawer-h">
              <div>
                <div className="wf-kicker"><FileSearch size={12} /> Capture</div>
                <div className="wf-page-title" style={{ fontSize: 24 }}>Packet drill-down</div>
              </div>
              <button className="wf-icon-btn" onClick={onClose} aria-label="Close">
                <X size={16} />
              </button>
            </div>

            <div className="wf-drawer-body">
              <label className="wf-kicker" htmlFor="pcap-select">Capture file</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <select id="pcap-select" className="wf-select" value={selectedFile} onChange={e => setSelectedFile(e.target.value)}>
                  {files.map(f => (
                    <option key={f.filename} value={f.filename}>
                      {f.filename} ({(f.size_bytes / 1024).toFixed(1)} KB)
                    </option>
                  ))}
                </select>
                {selectedFile && (
                  <a className="tactile-btn tactile-btn--default" href={`${apiUrl}/capture/download/${encodeURIComponent(selectedFile)}`} download>
                    <Download size={14} /> Download PCAP
                  </a>
                )}
              </div>

              <label className="wf-kicker" htmlFor="filter-input">Wireshark display filter</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input
                  id="filter-input"
                  className="wf-field"
                  placeholder="tcp.port == 1883 or ip.addr == 192.168.1.10"
                  value={filter}
                  onChange={e => setFilter(e.target.value)}
                />
                <TactileButton tone="primary" icon={Play} disabled={loading || !selectedFile} onClick={handleInspect} ariaLabel="Apply filter">
                  {loading ? 'Inspecting' : 'Apply filter'}
                </TactileButton>
              </div>

              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button className="wf-chip" onClick={() => setFilter('tcp.port == 1883')}>MQTT 1883</button>
                <button className="wf-chip" onClick={() => setFilter('tcp.flags.syn == 1')}>TCP SYN</button>
                <button className="wf-chip" onClick={() => setFilter('dns or http')}>DNS & HTTP</button>
                <button className="wf-chip" onClick={() => setFilter('')}>Clear</button>
              </div>

              {tsharkStatus === 'missing' && (
                <div className="wf-banner" role="status"><AlertCircle size={16} /> {errorMsg}</div>
              )}
              {errorMsg && tsharkStatus !== 'missing' && (
                <div className="wf-banner" role="alert"><AlertCircle size={16} /> {errorMsg}</div>
              )}

              {loading ? (
                <div className="wf-empty"><div className="wf-skel" style={{ width: '60%', height: 16 }} />Running tshark</div>
              ) : packets.length === 0 ? (
                <div className="wf-empty">
                  <FileCode size={28} />
                  {tsharkStatus === 'missing'
                    ? 'tshark is not on PATH. Download the PCAP and open it in Wireshark.'
                    : 'Apply a filter to inspect packets from the capture.'}
                </div>
              ) : (
                <div className="wf-table-wrap">
                  <table className="wf-ledger" aria-label="Packets">
                    <thead>
                      <tr>
                        <th>Frame</th><th>Time</th><th>Source</th><th>Destination</th><th>Proto</th><th>Len</th><th>Info</th>
                      </tr>
                    </thead>
                    <tbody>
                      {packets.map((pkt, i) => (
                        <tr key={i} style={{ cursor: 'default' }}>
                          <td className="wf-mono">{pkt.frame}</td>
                          <td className="wf-mono">{pkt.time}</td>
                          <td className="wf-mono">{pkt.src}</td>
                          <td className="wf-mono">{pkt.dst}</td>
                          <td><span className="wf-proto">{pkt.proto}</span></td>
                          <td className="wf-mono">{pkt.len}</td>
                          <td>{pkt.info}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
