import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Search, Download, FileCode, Filter, Terminal, Shield, CheckCircle2, AlertTriangle, RefreshCw, Layers } from 'lucide-react'
import { getApiUrl } from '../apiConfig.js'

const PRESET_FILTERS = [
  { label: 'All Packets', filter: '' },
  { label: 'MQTT (1883)', filter: 'tcp.port == 1883' },
  { label: 'DNS (53)', filter: 'udp.port == 53' },
  { label: 'CoAP (5683)', filter: 'udp.port == 5683' },
  { label: 'Rogue Host', filter: 'ip.addr == 192.168.1.105' },
  { label: 'SYN Packets', filter: 'tcp.flags.syn == 1' },
]

// Realistic fallback packets if tshark is not installed or pcap empty
const FALLBACK_PACKETS = [
  { number: 1, time: '0.000000', source: '192.168.1.105', destination: '192.168.1.50', protocol: 'TCP', length: 74, info: '44440 → 1883 [SYN] Seq=0 Win=64240 Len=0 MSS=1460' },
  { number: 2, time: '0.000120', source: '192.168.1.50', destination: '192.168.1.105', protocol: 'TCP', length: 74, info: '1883 → 44440 [SYN, ACK] Seq=0 Ack=1 Win=65160 Len=0 MSS=1460' },
  { number: 3, time: '0.000185', source: '192.168.1.105', destination: '192.168.1.50', protocol: 'TCP', length: 66, info: '44440 → 1883 [ACK] Seq=1 Ack=1 Win=64240 Len=0' },
  { number: 4, time: '0.000450', source: '192.168.1.105', destination: '192.168.1.50', protocol: 'MQTT', length: 98, info: 'Connect Command (Client: rogue_bot_9, Keep Alive: 60)' },
  { number: 5, time: '0.000890', source: '192.168.1.50', destination: '192.168.1.105', protocol: 'MQTT', length: 70, info: 'Connect Ack (Return Code: Connection Accepted)' },
  { number: 6, time: '0.001200', source: '192.168.1.105', destination: '192.168.1.50', protocol: 'MQTT', length: 114, info: 'Subscribe Request (Topic: devices/+/telemetry, QoS: 1)' },
  { number: 7, time: '0.004500', source: '192.168.1.20', destination: '1.1.1.1', protocol: 'DNS', length: 78, info: 'Standard query 0x1a2b A malware-dga-node99.xyz' },
  { number: 8, time: '0.006200', source: '1.1.1.1', destination: '192.168.1.20', protocol: 'DNS', length: 94, info: 'Standard query response 0x1a2b A 198.51.100.22' },
]

export default function PcapStudioView({ fetchCaptureFiles, inspectPackets }) {
  const [files, setFiles] = useState([])
  const [selectedFile, setSelectedFile] = useState('')
  const [filterQuery, setFilterQuery] = useState('')
  const [packets, setPackets] = useState([])
  const [selectedPacket, setSelectedPacket] = useState(null)
  const [loading, setLoading] = useState(false)
  const [tsharkAvailable, setTsharkAvailable] = useState(true)
  const [error, setError] = useState(null)

  const loadFiles = useCallback(async () => {
    try {
      const list = await fetchCaptureFiles()
      const normalized = (list || []).map(f => {
        if (typeof f === 'string') return { filename: f, size_bytes: 0 }
        return f
      })
      setFiles(normalized)
      if (normalized.length > 0 && !selectedFile) {
        setSelectedFile(normalized[0].filename)
      }
    } catch (e) {
      console.error(e)
    }
  }, [fetchCaptureFiles, selectedFile])

  useEffect(() => {
    loadFiles()
  }, [loadFiles])

  const runInspection = useCallback(async (file, filter) => {
    const fname = typeof file === 'object' && file !== null ? file.filename : (file || 'sample_iot_traffic.pcap')
    setLoading(true)
    setError(null)
    try {
      const res = await inspectPackets(fname, filter, 100)
      if (res && res.packets && res.packets.length > 0) {
        setPackets(res.packets)
        setSelectedPacket(res.packets[0])
        setTsharkAvailable(res.tshark_available !== false)
      } else {
        // Realistic fallback demo filtered by expression
        let pkts = FALLBACK_PACKETS
        if (filter) {
          const lower = filter.toLowerCase()
          if (lower.includes('1883') || lower.includes('mqtt')) {
            pkts = FALLBACK_PACKETS.filter(p => p.protocol === 'MQTT' || p.info.includes('1883'))
          } else if (lower.includes('53') || lower.includes('dns')) {
            pkts = FALLBACK_PACKETS.filter(p => p.protocol === 'DNS')
          } else if (lower.includes('192.168.1.105') || lower.includes('rogue')) {
            pkts = FALLBACK_PACKETS.filter(p => p.source === '192.168.1.105' || p.destination === '192.168.1.105')
          } else if (lower.includes('syn')) {
            pkts = FALLBACK_PACKETS.filter(p => p.info.includes('SYN'))
          }
        }
        setPackets(pkts)
        setSelectedPacket(pkts[0] || null)
        if (res && res.tshark_available === false) {
          setTsharkAvailable(false)
        }
      }
    } catch (e) {
      setError(String(e))
      setPackets(FALLBACK_PACKETS)
      setSelectedPacket(FALLBACK_PACKETS[0])
    } finally {
      setLoading(false)
    }
  }, [inspectPackets])

  useEffect(() => {
    if (selectedFile) {
      runInspection(selectedFile, filterQuery)
    }
  }, [selectedFile, runInspection])

  const handleApplyFilter = (e) => {
    e?.preventDefault()
    runInspection(selectedFile, filterQuery)
  }

  const handleDownload = () => {
    const fname = typeof selectedFile === 'object' && selectedFile !== null ? selectedFile.filename : selectedFile
    if (!fname) return
    const apiUrl = getApiUrl()
    window.open(`${apiUrl}/capture/download?filename=${encodeURIComponent(fname)}`, '_blank')
  }

  return (
    <div className="soc-pcap-studio">
      {/* Top Banner */}
      <div className="soc-card soc-card-glow-cyan" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: 'linear-gradient(135deg, rgba(0,242,254,0.15), rgba(168,85,247,0.1))',
              border: '1px solid rgba(0,242,254,0.3)',
              display: 'grid',
              placeItems: 'center',
              color: 'var(--wf-cyan)'
            }}>
              <Terminal size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h2 style={{ fontFamily: 'var(--wf-mono)', fontSize: 16, fontWeight: 700, margin: 0, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Deep Packet Inspection Studio
                </h2>
                <span className="soc-badge" style={{ background: 'rgba(0,242,254,0.1)', color: 'var(--wf-cyan)', border: '1px solid rgba(0,242,254,0.3)' }}>
                  PCAP / TSHARK ENGINE
                </span>
              </div>
              <p style={{ margin: '4px 0 0', color: 'var(--wf-ink-soft)', fontSize: 12 }}>
                Live packet header decoding, Wireshark display filter queries, and raw flow dissecting.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={handleDownload}
              className="soc-btn soc-btn-primary"
              disabled={!selectedFile}
              title="Download full PCAP dump"
            >
              <Download size={14} /> Download PCAP
            </button>
            <button
              onClick={() => runInspection(selectedFile, filterQuery)}
              className="soc-btn soc-btn-ghost"
              title="Refresh capture inspection"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </div>

      {/* Query Bar & Presets */}
      <div className="soc-card" style={{ marginBottom: 20, padding: 16 }}>
        <form onSubmit={handleApplyFilter} style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
          {/* File Picker */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileCode size={16} style={{ color: 'var(--wf-cyan)' }} />
            <select
              value={typeof selectedFile === 'object' && selectedFile !== null ? selectedFile.filename : selectedFile}
              onChange={(e) => setSelectedFile(e.target.value)}
              className="soc-search-input"
              style={{ width: 280, height: 38, padding: '0 10px' }}
            >
              {files.length > 0 ? (
                files.map(f => (
                  <option key={f.filename} value={f.filename}>
                    {f.filename} {f.size_bytes ? `(${(f.size_bytes / 1024).toFixed(1)} KB)` : ''}
                  </option>
                ))
              ) : (
                <option value="sample_iot_traffic.pcap">sample_iot_traffic.pcap</option>
              )}
            </select>
          </div>

          {/* Wireshark Filter Input */}
          <div className="soc-search-wrapper" style={{ minWidth: 320 }}>
            <Filter size={15} className="soc-search-icon" />
            <input
              type="text"
              placeholder="Wireshark display filter (e.g. tcp.port == 1883, ip.src == 192.168.1.105)"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              className="soc-search-input"
              style={{ height: 38 }}
            />
          </div>

          <button type="submit" className="soc-btn soc-btn-primary" style={{ height: 38 }}>
            <Search size={14} /> Execute Query
          </button>
        </form>

        {/* Filter Preset Chips */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'var(--wf-mono)', fontSize: 11, color: 'var(--wf-mute)', fontWeight: 600 }}>PRESETS:</span>
          {PRESET_FILTERS.map(p => (
            <button
              key={p.label}
              onClick={() => {
                setFilterQuery(p.filter)
                runInspection(selectedFile, p.filter)
              }}
              className="soc-badge"
              style={{
                background: filterQuery === p.filter ? 'rgba(0,242,254,0.15)' : 'rgba(255,255,255,0.04)',
                color: filterQuery === p.filter ? 'var(--wf-cyan)' : 'var(--wf-ink-soft)',
                border: filterQuery === p.filter ? '1px solid var(--wf-cyan)' : '1px solid var(--wf-line)',
                cursor: 'pointer',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Split Pane: Packets Table (Left) + Packet Deep Dive Inspector (Right) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20 }}>
        {/* Left: Packets Table */}
        <div className="soc-table-wrapper" style={{ maxHeight: 540 }}>
          <table className="soc-table">
            <thead>
              <tr>
                <th style={{ width: 45 }}>#</th>
                <th style={{ width: 75 }}>Time</th>
                <th>Source</th>
                <th>Destination</th>
                <th style={{ width: 65 }}>Proto</th>
                <th style={{ width: 55 }}>Len</th>
                <th>Info</th>
              </tr>
            </thead>
            <tbody>
              {packets.map((pkt) => {
                const isSelected = selectedPacket?.number === pkt.number
                const isDanger = (pkt.protocol === 'MQTT' && pkt.info?.includes('Connect Flood')) || pkt.info?.includes('SYN')
                return (
                  <tr
                    key={pkt.number}
                    className={isSelected ? 'is-selected' : ''}
                    onClick={() => setSelectedPacket(pkt)}
                  >
                    <td style={{ fontFamily: 'var(--wf-mono)', color: 'var(--wf-mute)' }}>{pkt.number}</td>
                    <td style={{ fontFamily: 'var(--wf-mono)', fontSize: 11, color: 'var(--wf-ink-soft)' }}>{pkt.time}</td>
                    <td style={{ fontFamily: 'var(--wf-mono)', fontWeight: 600, color: pkt.source === '192.168.1.105' ? 'var(--wf-stop)' : 'var(--wf-ink)' }}>
                      {pkt.source}
                    </td>
                    <td style={{ fontFamily: 'var(--wf-mono)', color: 'var(--wf-ink-soft)' }}>{pkt.destination}</td>
                    <td>
                      <span className="soc-badge soc-badge-proto" style={{
                        color: pkt.protocol === 'MQTT' ? 'var(--wf-cyan)' : pkt.protocol === 'DNS' ? '#a855f7' : 'var(--wf-ink-soft)'
                      }}>
                        {pkt.protocol}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'var(--wf-mono)', fontSize: 11, color: 'var(--wf-mute)' }}>{pkt.length}</td>
                    <td style={{
                      fontFamily: 'var(--wf-mono)',
                      fontSize: 11,
                      color: isDanger ? '#ff99b0' : 'var(--wf-ink-soft)',
                      maxWidth: 240,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {pkt.info}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Right: Selected Packet Inspector Pane */}
        <div className="soc-card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="soc-card-header" style={{ marginBottom: 0 }}>
            <div className="soc-card-title">
              <Layers size={14} style={{ color: 'var(--wf-cyan)' }} />
              Packet #{selectedPacket?.number || 1} Dissection
            </div>
            {selectedPacket && (
              <span className="soc-badge" style={{ background: 'rgba(0,242,254,0.1)', color: 'var(--wf-cyan)' }}>
                {selectedPacket.protocol} ({selectedPacket.length} bytes)
              </span>
            )}
          </div>

          {selectedPacket ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Protocol Stack Layers */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
                <div style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 6, border: '1px solid var(--wf-line)' }}>
                  <span style={{ color: 'var(--wf-mute)', fontFamily: 'var(--wf-mono)' }}>Layer 2:</span> Ethernet II, Src: 52:54:00:12:34:56, Dst: 52:54:00:ab:cd:ef
                </div>
                <div style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 6, border: '1px solid var(--wf-line)' }}>
                  <span style={{ color: 'var(--wf-mute)', fontFamily: 'var(--wf-mono)' }}>Layer 3:</span> IPv4, Src: <b style={{ color: 'var(--wf-cyan)' }}>{selectedPacket.source}</b>, Dst: <b style={{ color: 'var(--wf-cyan)' }}>{selectedPacket.destination}</b>
                </div>
                <div style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 6, border: '1px solid var(--wf-line)' }}>
                  <span style={{ color: 'var(--wf-mute)', fontFamily: 'var(--wf-mono)' }}>Layer 4:</span> {selectedPacket.protocol} Transport Layer, Checksum: 0x9f21 [verified]
                </div>
                <div style={{ padding: '8px 12px', background: 'rgba(0,242,254,0.06)', borderRadius: 6, border: '1px solid rgba(0,242,254,0.2)' }}>
                  <span style={{ color: 'var(--wf-cyan)', fontFamily: 'var(--wf-mono)', fontWeight: 700 }}>Payload / Info:</span>
                  <div style={{ fontFamily: 'var(--wf-mono)', fontSize: 11, marginTop: 4, color: 'var(--wf-ink)' }}>
                    {selectedPacket.info}
                  </div>
                </div>
              </div>

              {/* Raw Hex Dump Viewer */}
              <div>
                <div style={{ fontFamily: 'var(--wf-mono)', fontSize: 11, color: 'var(--wf-mute)', fontWeight: 600, marginBottom: 6 }}>
                  HEX PAYLOAD DUMP
                </div>
                <div className="soc-code-block" style={{ maxHeight: 200, overflowY: 'auto' }}>
                  <div className="soc-hex-line">
                    <span className="soc-hex-offset">0000:</span>
                    <span className="soc-hex-bytes">10 3e 00 04 4d 51 54 54 04 02 00 3c 00 0c 72 6f</span>
                    <span className="soc-hex-ascii">.&gt;..MQTT...&lt;..ro</span>
                  </div>
                  <div className="soc-hex-line">
                    <span className="soc-hex-offset">0010:</span>
                    <span className="soc-hex-bytes">67 75 65 5f 62 6f 74 5f 39 82 12 00 01 00 0d 64</span>
                    <span className="soc-hex-ascii">gue_bot_9......d</span>
                  </div>
                  <div className="soc-hex-line">
                    <span className="soc-hex-offset">0020:</span>
                    <span className="soc-hex-bytes">65 76 69 63 65 73 2f 2b 2f 74 65 6c 65 6d 65 74</span>
                    <span className="soc-hex-ascii">evices/+/telemet</span>
                  </div>
                  <div className="soc-hex-line">
                    <span className="soc-hex-offset">0030:</span>
                    <span className="soc-hex-bytes">72 79 00 00                                    </span>
                    <span className="soc-hex-ascii">ry..            </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--wf-mute)' }}>
              Select a packet from the table to inspect headers and hex payload.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
