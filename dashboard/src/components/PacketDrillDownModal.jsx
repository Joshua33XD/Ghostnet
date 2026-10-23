// Packet Drill-Down Modal — On-Demand Packet Inspection & PCAP Download
import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  FileSearch,
  Download,
  X,
  Play,
  AlertCircle,
  FileCode,
  CheckCircle,
} from 'lucide-react'
import { getApiUrl } from '../apiConfig.js'

export default function PacketDrillDownModal({
  isOpen,
  onClose,
  initialIp = '',
  fetchCaptureFiles,
  inspectPackets,
}) {
  const [files, setFiles] = useState([])
  const [selectedFile, setSelectedFile] = useState('')
  const [filter, setFilter] = useState('')
  const [packets, setPackets] = useState([])
  const [loading, setLoading] = useState(false)
  const [tsharkStatus, setTsharkStatus] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (isOpen) {
      if (initialIp) {
        setFilter(`ip.addr == ${initialIp}`)
      }
      fetchCaptureFiles().then(res => {
        setFiles(res || [])
        if (res && res.length > 0 && !selectedFile) {
          setSelectedFile(res[0].filename)
        }
      })
    }
  }, [isOpen, initialIp, fetchCaptureFiles, selectedFile])

  if (!isOpen) return null

  const handleInspect = async () => {
    if (!selectedFile) return
    setLoading(true)
    setErrorMsg('')
    try {
      const res = await inspectPackets(selectedFile, filter, 50)
      if (res.tshark_available === false) {
        setTsharkStatus('missing')
        setPackets([])
        setErrorMsg(res.message || 'tshark is not installed. PCAP file download is available.')
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
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label="Packet Drill-down Modal">
      <motion.div
        className="modal-panel"
        onClick={e => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
      >
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title">
            <FileSearch size={18} aria-hidden="true" />
            <span>Packet Drill-Down (PCAP & Tshark)</span>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
            <X size={16} />
          </button>
        </div>

        {/* Modal Controls */}
        <div className="modal-controls">
          <div className="modal-control-row">
            <label className="modal-label" htmlFor="pcap-select">
              Capture File:
            </label>
            <select
              id="pcap-select"
              className="modal-select"
              value={selectedFile}
              onChange={e => setSelectedFile(e.target.value)}
            >
              {files.map(f => (
                <option key={f.filename} value={f.filename}>
                  {f.filename} ({(f.size_bytes / 1024).toFixed(1)} KB)
                </option>
              ))}
            </select>

            {selectedFile && (
              <a
                href={`${apiUrl}/capture/download/${encodeURIComponent(selectedFile)}`}
                className="btn-download-pcap"
                download
                target="_blank"
                rel="noreferrer"
                aria-label="Download PCAP file"
              >
                <Download size={14} aria-hidden="true" />
                <span>Download PCAP</span>
              </a>
            )}
          </div>

          <div className="modal-control-row">
            <label className="modal-label" htmlFor="filter-input">
              Wireshark Display Filter:
            </label>
            <input
              id="filter-input"
              type="text"
              className="modal-filter-input"
              placeholder="e.g. tcp.port == 1883 or ip.addr == 192.168.1.10"
              value={filter}
              onChange={e => setFilter(e.target.value)}
            />
            <button
              className="btn-run-inspection"
              onClick={handleInspect}
              disabled={loading || !selectedFile}
            >
              <Play size={13} aria-hidden="true" />
              <span>{loading ? 'Inspecting...' : 'Apply Filter'}</span>
            </button>
          </div>

          {/* Preset Filter Chips */}
          <div className="preset-chips">
            <span className="preset-label">Presets:</span>
            <button className="preset-chip" onClick={() => setFilter('tcp.port == 1883')}>
              MQTT (1883)
            </button>
            <button className="preset-chip" onClick={() => setFilter('tcp.flags.syn == 1')}>
              TCP SYN
            </button>
            <button className="preset-chip" onClick={() => setFilter('dns or http')}>
              DNS & HTTP
            </button>
            <button className="preset-chip" onClick={() => setFilter('')}>
              Clear Filter
            </button>
          </div>
        </div>

        {/* Status / Notice Banner */}
        {tsharkStatus === 'missing' && (
          <div className="tshark-missing-banner" role="status">
            <AlertCircle size={16} aria-hidden="true" />
            <span>{errorMsg}</span>
          </div>
        )}

        {errorMsg && tsharkStatus !== 'missing' && (
          <div className="tshark-error-banner" role="alert">
            <AlertCircle size={16} aria-hidden="true" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Packet Results Table */}
        <div className="packet-table-wrapper">
          {loading ? (
            <div className="table-loading-state">
              <div className="spinner" />
              <span>Running tshark packet drill-down...</span>
            </div>
          ) : packets.length === 0 ? (
            <div className="glass-empty-state" style={{ padding: '24px' }}>
              <FileCode size={32} style={{ opacity: 0.3 }} aria-hidden="true" />
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                {tsharkStatus === 'missing'
                  ? 'Tshark is not available in system PATH. Use "Download PCAP" to inspect in Wireshark.'
                  : 'Click "Apply Filter" to inspect packets from the capture.'}
              </div>
            </div>
          ) : (
            <table className="ids-table packet-table" aria-label="Packet inspection table">
              <thead>
                <tr>
                  <th scope="col" style={{ width: '60px' }}>Frame</th>
                  <th scope="col" style={{ width: '80px' }}>Time</th>
                  <th scope="col">Source</th>
                  <th scope="col">Destination</th>
                  <th scope="col" style={{ width: '80px' }}>Proto</th>
                  <th scope="col" style={{ width: '60px' }}>Len</th>
                  <th scope="col">Info</th>
                </tr>
              </thead>
              <tbody>
                {packets.map((pkt, i) => (
                  <tr key={i} className="ids-table-row">
                    <td className="mono-text">{pkt.frame}</td>
                    <td className="mono-text">{pkt.time}</td>
                    <td className="mono-text">{pkt.src}</td>
                    <td className="mono-text">{pkt.dst}</td>
                    <td><span className="proto-badge">{pkt.proto}</span></td>
                    <td className="mono-text">{pkt.len}</td>
                    <td className="packet-info-cell">{pkt.info}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </motion.div>
    </div>
  )
}
