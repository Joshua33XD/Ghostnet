// NetworkCommsView — "How computers communicate" visualization
// Shows packet journey: APP -> TCP -> IP -> ETHERNET -> PHYSICAL -> ROUTER -> RECEIVER
// Integrates with real node security state (quarantined = blocked path)
import { useState, useEffect, useCallback, useRef } from 'react'
import { Send, ChevronDown, ChevronRight, Shield, AlertTriangle, XCircle, Zap } from 'lucide-react'

// ── Layer definitions ──────────────────────────────────────────────────────
const LAYERS = [
  { id: 'app',       label: 'APPLICATION',  sublabel: 'Layer 7',  color: '#3b82f6' },
  { id: 'transport', label: 'TRANSPORT',    sublabel: 'TCP Layer 4', color: '#8b5cf6' },
  { id: 'network',   label: 'NETWORK',      sublabel: 'IP Layer 3', color: '#06b6d4' },
  { id: 'datalink',  label: 'DATA LINK',    sublabel: 'Ethernet L2', color: '#10b981' },
  { id: 'physical',  label: 'PHYSICAL',     sublabel: 'Layer 1 Bits', color: '#f59e0b' },
]

// ── Packet state machine ───────────────────────────────────────────────────
const STAGE = {
  IDLE:          'IDLE',
  APP:           'APP',
  TRANSPORT:     'TRANSPORT',
  NETWORK:       'NETWORK',
  DATALINK:      'DATALINK',
  PHYSICAL:      'PHYSICAL',
  ROUTING:       'ROUTING',
  DELIVERY:      'DELIVERY',
  DECAP:         'DECAP',
  RECEIVED:      'RECEIVED',
  ACK:           'ACK',
  BLOCKED:       'BLOCKED',
  ERROR:         'ERROR',
}

// ── Simulated packet data (realistic, clearly frontend-generated) ─────────
let _pktSeq = 1040
function makePacket(payload, senderNode, receiverNode) {
  const seq = ++_pktSeq
  const ts  = Date.now()
  const src = senderNode?.ip_address   ?? `192.168.1.${10 + (seq % 20)}`
  const dst = receiverNode?.ip_address ?? `192.168.1.${30 + (seq % 10)}`
  const srcMac = senderNode?.mac_address   ?? `AA:BB:CC:DD:EE:${seq.toString(16).toUpperCase().padStart(2,'0')}`
  const dstMac = receiverNode?.mac_address ?? `FF:EE:DD:CC:BB:${(seq+1).toString(16).toUpperCase().padStart(2,'0')}`
  const bytes = new TextEncoder().encode(payload)
  const payloadHex = Array.from(bytes.slice(0,8)).map(b=>b.toString(16).padStart(2,'0').toUpperCase()).join(' ')
  const payloadBin = Array.from(bytes.slice(0,4)).map(b=>b.toString(2).padStart(8,'0')).join(' ')
  return {
    seq,
    payload,
    payloadBytes: bytes.length,
    payloadHex,
    payloadBin: payloadBin + ' …',
    srcIp:   src,
    dstIp:   dst,
    srcMac,
    dstMac,
    srcPort: 49152 + (seq % 16384),
    dstPort: 443,
    ttl:     64,
    ttlAfterRouter: 63,
    seqNum:  1000000 + seq * 1024,
    ackNum:  0,
    flags:   'SYN+ACK',
    window:  65535,
    checksum: `0x${(seq * 0x1337 & 0xFFFF).toString(16).toUpperCase().padStart(4,'0')}`,
    fcs:     `0x${(seq * 0xDEAD & 0xFFFFFFFF).toString(16).toUpperCase().padStart(8,'0')}`,
    ethertype: '0x0800',
    protocol: '6 (TCP)',
    signal:   '-72 dBm',
    txRate:   '54 Mbps',
    latency:  `${12 + (seq % 20)} ms`,
    ts,
  }
}

// ── Encapsulation viewer ───────────────────────────────────────────────────
function EncapsulationView({ stage, pkt }) {
  if (!pkt) return null

  const layerColors = {
    app:       '#3b82f6',
    transport: '#8b5cf6',
    network:   '#06b6d4',
    datalink:  '#10b981',
    physical:  '#f59e0b',
  }

  const activeIdx = {
    [STAGE.APP]:       0,
    [STAGE.TRANSPORT]: 1,
    [STAGE.NETWORK]:   2,
    [STAGE.DATALINK]:  3,
    [STAGE.PHYSICAL]:  4,
    [STAGE.ROUTING]:   4,
    [STAGE.DELIVERY]:  4,
    [STAGE.DECAP]:     3,
    [STAGE.RECEIVED]:  0,
    [STAGE.ACK]:       0,
  }[stage] ?? -1

  const encapLayers = [
    { key:'app',       label:'DATA',            content: `"${pkt.payload}"`, color: layerColors.app },
    { key:'transport', label:'TCP HEADER',       content: `SRC:${pkt.srcPort} DST:${pkt.dstPort} SEQ:${pkt.seqNum}`, color: layerColors.transport },
    { key:'network',   label:'IP HEADER',        content: `${pkt.srcIp} → ${pkt.dstIp}  TTL:${pkt.ttl}`, color: layerColors.network },
    { key:'datalink',  label:'ETHERNET HEADER',  content: `${pkt.srcMac.slice(-8)} → ${pkt.dstMac.slice(-8)}`, color: layerColors.datalink },
    { key:'physical',  label:'BITS',             content: pkt.payloadBin, color: layerColors.physical },
  ]

  const visibleCount = activeIdx + 1

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:3, padding:'12px 16px', background:'var(--surface-overlay)', borderRadius:8, border:'1px solid var(--border)' }}>
      <div style={{ fontSize:'var(--text-xs)', color:'var(--text-muted)', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:4 }}>
        Encapsulation
      </div>
      {encapLayers.map((l, i) => {
        const visible = i < visibleCount
        return (
          <div
            key={l.key}
            style={{
              display:'flex', alignItems:'center', gap:8,
              padding:'6px 10px', borderRadius:6,
              background: visible ? `${l.color}10` : 'transparent',
              border: `1px solid ${visible ? l.color + '40' : 'var(--border)'}`,
              opacity: visible ? 1 : 0.25,
              transition: 'all 0.35s ease',
              overflow:'hidden',
            }}
          >
            <span style={{ fontSize:'var(--text-xs)', fontFamily:'var(--font-mono)', fontWeight:700, color: visible ? l.color : 'var(--text-muted)', minWidth:100 }}>
              {l.label}
            </span>
            {visible && (
              <span style={{ fontSize:'var(--text-xs)', fontFamily:'var(--font-mono)', color:'var(--text-secondary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {l.content}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Packet inspector panel ─────────────────────────────────────────────────
function PacketInspector({ pkt, onClose }) {
  const [openSections, setOpenSections] = useState({ eth:true, ip:true, tcp:true, payload:true })
  const toggle = k => setOpenSections(p => ({ ...p, [k]: !p[k] }))

  if (!pkt) return null

  const sections = [
    {
      key:'eth', label:'Ethernet Frame',
      fields:[
        ['Source MAC',      pkt.srcMac],
        ['Destination MAC', pkt.dstMac],
        ['EtherType',       pkt.ethertype + ' (IPv4)'],
        ['FCS',             pkt.fcs + ' ✓'],
      ],
    },
    {
      key:'ip', label:'IP Packet',
      fields:[
        ['Source IP',      pkt.srcIp],
        ['Destination IP', pkt.dstIp],
        ['TTL',            pkt.ttl + ' → ' + pkt.ttlAfterRouter + ' (after router)'],
        ['Protocol',       pkt.protocol],
        ['Checksum',       pkt.checksum],
      ],
    },
    {
      key:'tcp', label:'TCP Segment',
      fields:[
        ['Source Port',  pkt.srcPort],
        ['Dest Port',    pkt.dstPort + ' (HTTPS)'],
        ['Sequence',     pkt.seqNum],
        ['Flags',        pkt.flags],
        ['Window',       pkt.window],
        ['Checksum',     pkt.checksum],
      ],
    },
    {
      key:'payload', label:'Payload',
      fields:[
        ['Content',   `"${pkt.payload}"`],
        ['Size',      pkt.payloadBytes + ' bytes'],
        ['Encoding',  'UTF-8'],
        ['Hex',       pkt.payloadHex],
        ['CRC',       'VALID ✓'],
      ],
    },
  ]

  return (
    <div className="packet-inspector">
      <div className="panel-header">
        <span className="panel-title">PACKET #{pkt.seq}</span>
        <button onClick={onClose} className="drawer-close">✕</button>
      </div>
      <div style={{ flex:1, overflowY:'auto' }}>
        {sections.map(s => (
          <div key={s.key} className="inspector-section">
            <div className="inspector-section-header" onClick={() => toggle(s.key)}>
              <span style={{ fontSize:'var(--text-xs)', fontWeight:600, color:'var(--text-secondary)' }}>{s.label}</span>
              {openSections[s.key] ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </div>
            {openSections[s.key] && (
              <div className="inspector-section-body">
                {s.fields.map(([k,v]) => (
                  <div key={k} className="inspector-field">
                    <span className="inspector-field-label">{k}</span>
                    <span className="inspector-field-value">{String(v)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Topology node box ──────────────────────────────────────────────────────
function TopologyBox({ label, sublabel, icon: Icon, color, active, blocked, pulsing, style: extraStyle }) {
  const borderColor = blocked ? 'var(--status-danger-border)'
                    : active  ? color + 'cc'
                    : 'var(--border)'
  const bg          = blocked ? 'var(--status-danger-bg)'
                    : active  ? color + '15'
                    : 'var(--surface-raised)'
  return (
    <div style={{
      display:'flex', flexDirection:'column', alignItems:'center', gap:6,
      padding:'12px 16px', borderRadius:10,
      border:`1px solid ${borderColor}`,
      background: bg,
      transition:'all 0.35s ease',
      animation: pulsing ? 'topology-pulse 1s ease-in-out 2' : 'none',
      minWidth:100, textAlign:'center',
      ...extraStyle,
    }}>
      {Icon && <Icon size={20} style={{ color: blocked ? 'var(--status-danger)' : active ? color : 'var(--text-muted)', flexShrink:0 }} />}
      <div style={{ fontSize:'var(--text-xs)', fontFamily:'var(--font-mono)', fontWeight:700, color: blocked ? 'var(--status-danger)' : active ? 'var(--text-primary)' : 'var(--text-muted)', letterSpacing:'0.06em' }}>
        {label}
      </div>
      {sublabel && <div style={{ fontSize:10, color:'var(--text-muted)' }}>{sublabel}</div>}
      {blocked && <div style={{ fontSize:10, color:'var(--status-danger)', fontWeight:700, fontFamily:'var(--font-mono)' }}>BLOCKED</div>}
    </div>
  )
}

// ── Arrow connector ────────────────────────────────────────────────────────
function Arrow({ active, blocked, vertical }) {
  const color = blocked ? 'var(--status-danger)' : active ? 'var(--accent)' : 'var(--border)'
  const style = vertical
    ? { display:'flex', flexDirection:'column', alignItems:'center', gap:0, flexShrink:0 }
    : { display:'flex', alignItems:'center', flexShrink:0 }
  return (
    <div style={style}>
      <div style={vertical
        ? { width:1, height:28, background: color, transition:'background 0.3s' }
        : { height:1, width:28, background: color, transition:'background 0.3s' }
      } />
      <div style={{
        color, fontSize:10, lineHeight:1,
        transform: vertical ? 'rotate(90deg)' : 'none',
      }}>▶</div>
    </div>
  )
}

// ── Main view ─────────────────────────────────────────────────────────────
export default function NetworkCommsView({ nodes, osiSummary, onSelectNode, selectedNodeId, compact = false }) {
  const [stage, setStage]           = useState(STAGE.IDLE)
  const [packet, setPacket]         = useState(null)
  const [message, setMessage]       = useState('Hello GhostNet')
  const [log, setLog]               = useState([])
  const [showInspector, setShowInspector] = useState(false)
  const [routerNote, setRouterNote] = useState('')
  const [ackVisible, setAckVisible] = useState(false)
  const timerRef = useRef([])

  const nodeList = Object.values(nodes)
  const quarantined = nodeList.filter(n => n.status === 'QUARANTINED')
  const suspicious  = nodeList.filter(n => n.status === 'SUSPICIOUS')
  const senderNode  = nodeList.find(n => n.status !== 'QUARANTINED' && n.status !== 'OFFLINE') ?? null
  const receiverNode = nodeList.find(n => n !== senderNode && n.status === 'HEALTHY') ?? null

  const addLog = useCallback((msg, color) => {
    setLog(prev => [{ id: Date.now() + Math.random(), msg, color, ts: new Date().toLocaleTimeString('en-GB',{hour12:false}) }, ...prev].slice(0,30))
  }, [])

  const delay = (ms) => new Promise(r => setTimeout(r, ms))

  const clearTimers = () => { timerRef.current.forEach(clearTimeout); timerRef.current = [] }

  const runSequence = useCallback(async () => {
    if (stage !== STAGE.IDLE) return
    clearTimers()
    setShowInspector(false)
    setAckVisible(false)
    setLog([])

    const pkt = makePacket(message, senderNode, receiverNode)
    setPacket(pkt)

    const isBlocked = quarantined.length > 0 && !receiverNode
    // Check if the sender itself is quarantined
    const senderBlocked = senderNode?.status === 'QUARANTINED'

    const steps = [
      [STAGE.APP,       `[APP] Payload "${pkt.payload}" · ${pkt.payloadBytes} bytes · UTF-8`, '#3b82f6'],
      [STAGE.TRANSPORT, `[TCP] Segment created · SEQ:${pkt.seqNum} · Port ${pkt.srcPort}→${pkt.dstPort}`, '#8b5cf6'],
      [STAGE.NETWORK,   `[IP] Packet · ${pkt.srcIp} → ${pkt.dstIp} · TTL:${pkt.ttl}`, '#06b6d4'],
      [STAGE.DATALINK,  `[ETH] Frame · ${pkt.srcMac.slice(-8)} → ${pkt.dstMac.slice(-8)} · FCS OK`, '#10b981'],
      [STAGE.PHYSICAL,  `[PHY] ${pkt.payloadBin} · ${pkt.txRate} · ${pkt.signal}`, '#f59e0b'],
    ]

    for (const [s, msg, color] of steps) {
      setStage(s)
      addLog(msg, color)
      await delay(700)
    }

    setStage(STAGE.ROUTING)
    setRouterNote(`Lookup: ${pkt.dstIp} → Route found → TTL ${pkt.ttl} → ${pkt.ttlAfterRouter}`)
    addLog(`[ROUTER] Forwarding to ${pkt.dstIp} · TTL ${pkt.ttl}→${pkt.ttlAfterRouter}`, '#f97316')
    await delay(800)

    if (isBlocked || senderBlocked) {
      setStage(STAGE.BLOCKED)
      addLog('[GHOSTNET] Path BLOCKED — destination quarantined · packet dropped', 'var(--status-danger)')
      await delay(2500)
      setStage(STAGE.IDLE)
      return
    }

    setStage(STAGE.DELIVERY)
    addLog(`[NET] Delivering to ${pkt.dstIp}`, '#06b6d4')
    await delay(600)

    setStage(STAGE.DECAP)
    addLog('[DECAP] Stripping Ethernet → IP → TCP → APP data', '#8b5cf6')
    await delay(700)

    setStage(STAGE.RECEIVED)
    addLog(`[APP] MESSAGE RECEIVED: "${pkt.payload}"`, '#22c55e')
    await delay(600)

    setStage(STAGE.ACK)
    setAckVisible(true)
    addLog(`[TCP] ACK ${pkt.seqNum + pkt.payloadBytes} → ${pkt.srcIp}:${pkt.srcPort}`, '#8b5cf6')
    await delay(1200)

    setStage(STAGE.IDLE)
  }, [stage, message, senderNode, receiverNode, quarantined, addLog])

  // Clean up on unmount
  useEffect(() => () => clearTimers(), [])

  const isRunning = stage !== STAGE.IDLE
  const isBlocked = stage === STAGE.BLOCKED

  // Which layers are "active" in current stage
  const activeLayer = {
    [STAGE.APP]:       'app',
    [STAGE.TRANSPORT]: 'transport',
    [STAGE.NETWORK]:   'network',
    [STAGE.DATALINK]:  'datalink',
    [STAGE.PHYSICAL]:  'physical',
    [STAGE.ROUTING]:   'physical',
    [STAGE.DELIVERY]:  'physical',
    [STAGE.DECAP]:     'datalink',
    [STAGE.RECEIVED]:  'app',
    [STAGE.ACK]:       'transport',
  }[stage]

  return (
    <div className={`comms-view${compact ? ' comms-view--compact' : ''}`}>
      {/* ── Controls ──────────────────────────────────────── */}
      <div className="comms-controls">
        <div style={{ display:'flex', alignItems:'center', gap:8, flex:1 }}>
          <span style={{ fontSize:'var(--text-xs)', color:'var(--text-muted)', fontFamily:'var(--font-mono)', whiteSpace:'nowrap' }}>MESSAGE</span>
          <input
            className="attack-input"
            value={message}
            onChange={e => setMessage(e.target.value.slice(0,64))}
            placeholder="Hello GhostNet"
            disabled={isRunning}
            style={{ flex:1, maxWidth:280 }}
          />
        </div>
        <button className="send-data-btn" onClick={runSequence} disabled={isRunning}>
          <Send size={13} />
          {isRunning ? 'Transmitting…' : 'Send Data'}
        </button>

        {!compact && (
          <button
            onClick={() => setShowInspector(v => !v)}
            disabled={!packet}
            style={{ padding:'6px 14px', borderRadius:6, border:'1px solid var(--border)', background:'var(--surface-raised)', color: packet ? 'var(--text-secondary)' : 'var(--text-muted)', fontSize:'var(--text-xs)', cursor: packet ? 'pointer' : 'not-allowed' }}
          >
            {showInspector ? '✕ Inspector' : '⊞ Packet Inspector'}
          </button>
        )}

        {/* Security status chips */}
        {quarantined.length > 0 && (
          <div style={{ display:'flex', alignItems:'center', gap:6, padding:'4px 10px', borderRadius:6, background:'var(--status-danger-bg)', border:'1px solid var(--status-danger-border)', fontSize:'var(--text-xs)', color:'var(--status-danger)', fontFamily:'var(--font-mono)', fontWeight:700 }}>
            <XCircle size={11} /> {quarantined.length} QUARANTINED
          </div>
        )}
        {suspicious.length > 0 && (
          <div style={{ display:'flex', alignItems:'center', gap:6, padding:'4px 10px', borderRadius:6, background:'var(--status-warn-bg)', border:'1px solid var(--status-warn-border)', fontSize:'var(--text-xs)', color:'var(--status-warn)', fontFamily:'var(--font-mono)', fontWeight:700 }}>
            <AlertTriangle size={11} /> {suspicious.length} SUSPICIOUS
          </div>
        )}
      </div>

      {/* ── Main area ─────────────────────────────────────── */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes topology-pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        @keyframes packet-travel { from{left:-8px} to{left:calc(100% + 8px)} }
        @keyframes ack-travel   { from{right:-8px} to{right:calc(100% + 8px)} }
      `}} />

      <div style={{ flex:1, display:'flex', gap:'var(--sp-3)', overflow:'hidden', minHeight:0 }}>

        {/* ── Topology ──────────────────────────────────────── */}
        <div className="comms-topology" style={{ flex:1, overflow:'hidden' }}>
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:0, width:'100%', padding:'16px 24px' }}>

            {/* Row: SENDER → OSI STACK → ROUTER → RECEIVER */}
            <div style={{ display:'flex', alignItems:'center', gap:'var(--sp-3)', width:'100%', flexWrap:'wrap', justifyContent:'center' }}>

              {/* SENDER node */}
              <TopologyBox
                label={senderNode?.node_id ?? 'SENDER'}
                sublabel={senderNode?.ip_address ?? 'No nodes'}
                icon={Shield}
                color="#3b82f6"
                active={[STAGE.APP,STAGE.TRANSPORT,STAGE.NETWORK,STAGE.DATALINK,STAGE.PHYSICAL].includes(stage)}
                blocked={senderNode?.status === 'QUARANTINED'}
              />
              <Arrow active={[STAGE.PHYSICAL,STAGE.ROUTING,STAGE.DELIVERY,STAGE.DECAP,STAGE.RECEIVED,STAGE.ACK].includes(stage)} blocked={isBlocked} />

              {/* OSI Encapsulation column */}
              <div style={{ display:'flex', flexDirection:'column', gap:4, minWidth:220 }}>
                {LAYERS.map(l => (
                  <div
                    key={l.id}
                    style={{
                      display:'flex', alignItems:'center', gap:8,
                      padding:'7px 12px', borderRadius:8,
                      background: activeLayer === l.id ? l.color + '15' : 'var(--surface-raised)',
                      border:`1px solid ${activeLayer === l.id ? l.color + '60' : 'var(--border)'}`,
                      transition:'all 0.3s ease',
                    }}
                  >
                    <span style={{
                      width:8, height:8, borderRadius:'50%',
                      background: activeLayer === l.id ? l.color : 'var(--text-muted)',
                      flexShrink:0, transition:'background 0.3s',
                    }} />
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:10, fontFamily:'var(--font-mono)', fontWeight:700, color: activeLayer === l.id ? l.color : 'var(--text-muted)', letterSpacing:'0.06em' }}>
                        {l.label}
                      </div>
                      <div style={{ fontSize:9, color:'var(--text-muted)' }}>{l.sublabel}</div>
                    </div>
                    {activeLayer === l.id && packet && (
                      <div style={{ fontSize:9, fontFamily:'var(--font-mono)', color:l.color, maxWidth:80, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {l.id === 'app'       ? `"${packet.payload.slice(0,8)}"` :
                         l.id === 'transport' ? `TCP:${packet.srcPort}` :
                         l.id === 'network'   ? packet.srcIp.slice(-6) :
                         l.id === 'datalink'  ? packet.srcMac.slice(-5) :
                         packet.payloadBin.slice(0,12)}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <Arrow active={[STAGE.ROUTING,STAGE.DELIVERY,STAGE.DECAP,STAGE.RECEIVED,STAGE.ACK].includes(stage)} blocked={isBlocked} />

              {/* ROUTER */}
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:8 }}>
                <TopologyBox
                  label="ROUTER"
                  sublabel={stage === STAGE.ROUTING ? 'Processing…' : 'Forwarding'}
                  icon={Zap}
                  color="#f97316"
                  active={[STAGE.ROUTING,STAGE.DELIVERY,STAGE.DECAP,STAGE.RECEIVED,STAGE.ACK].includes(stage)}
                  blocked={isBlocked}
                  pulsing={stage === STAGE.ROUTING}
                />
                {stage === STAGE.ROUTING && routerNote && (
                  <div style={{ fontSize:10, color:'#f97316', fontFamily:'var(--font-mono)', background:'rgba(249,115,22,0.1)', border:'1px solid rgba(249,115,22,0.3)', borderRadius:6, padding:'4px 10px', textAlign:'center', maxWidth:160 }}>
                    {routerNote}
                  </div>
                )}
              </div>

              {!isBlocked && <Arrow active={[STAGE.DELIVERY,STAGE.DECAP,STAGE.RECEIVED,STAGE.ACK].includes(stage)} />}
              {isBlocked && (
                <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
                  <div style={{ width:40, height:1, background:'var(--status-danger)' }} />
                  <span style={{ fontSize:10, color:'var(--status-danger)', fontWeight:700, fontFamily:'var(--font-mono)' }}>✕ BLOCKED</span>
                </div>
              )}

              {/* RECEIVER node */}
              <TopologyBox
                label={receiverNode?.node_id ?? 'RECEIVER'}
                sublabel={receiverNode?.ip_address ?? (quarantined.length > 0 ? 'Path blocked' : 'Awaiting')}
                icon={Shield}
                color="#22c55e"
                active={[STAGE.DELIVERY,STAGE.DECAP,STAGE.RECEIVED,STAGE.ACK].includes(stage)}
                blocked={receiverNode?.status === 'QUARANTINED'}
              />

            </div>

            {/* RECEIVED message + ACK */}
            {stage === STAGE.RECEIVED && packet && (
              <div style={{
                marginTop:16, padding:'12px 20px', borderRadius:8,
                background:'var(--status-healthy-bg)', border:'1px solid var(--status-healthy-border)',
                animation:'topology-pulse 0.6s ease-out 1',
              }}>
                <div style={{ fontSize:'var(--text-xs)', color:'var(--status-healthy)', fontFamily:'var(--font-mono)', fontWeight:700, marginBottom:4 }}>
                  ✓ MESSAGE RECEIVED
                </div>
                <div style={{ fontSize:'var(--text-lg)', color:'var(--text-primary)', fontWeight:700 }}>
                  "{packet.payload}"
                </div>
              </div>
            )}

            {ackVisible && (
              <div style={{ marginTop:8, display:'flex', alignItems:'center', gap:6, padding:'6px 14px', borderRadius:6, background:'rgba(139,92,246,0.1)', border:'1px solid rgba(139,92,246,0.3)' }}>
                <span style={{ fontSize:'var(--text-xs)', fontFamily:'var(--font-mono)', color:'#a78bfa', fontWeight:700 }}>
                  ACK {packet?.seqNum + (packet?.payloadBytes ?? 0)} → {packet?.srcIp}:{packet?.srcPort}
                </span>
              </div>
            )}

            {isBlocked && (
              <div style={{ marginTop:16, padding:'10px 20px', borderRadius:8, background:'var(--status-danger-bg)', border:'1px solid var(--status-danger-border)', textAlign:'center' }}>
                <div style={{ fontSize:'var(--text-sm)', color:'var(--status-danger)', fontWeight:700, fontFamily:'var(--font-mono)' }}>
                  COMMUNICATION BLOCKED
                </div>
                <div style={{ fontSize:'var(--text-xs)', color:'var(--text-secondary)', marginTop:4 }}>
                  Quarantined node in communication path — packet dropped by GhostNet
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Right panels ──────────────────────────────────── */}
        <div style={{ display:'flex', flexDirection:'column', gap:'var(--sp-3)', width: compact ? 240 : 300, flexShrink:0, overflow:'hidden' }}>

          {/* Encapsulation viewer */}
          <EncapsulationView stage={stage} pkt={packet} />

          {/* Event log */}
          {!compact && (
            <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8, overflow:'hidden', flex:1, display:'flex', flexDirection:'column' }}>
              <div style={{ padding:'8px 12px', borderBottom:'1px solid var(--border)', fontSize:'var(--text-xs)', color:'var(--text-muted)', letterSpacing:'0.1em', textTransform:'uppercase' }}>
                Transmission Log
              </div>
              <div style={{ flex:1, overflowY:'auto', padding:'4px 0' }}>
                {log.length === 0 ? (
                  <div style={{ padding:'16px 12px', fontSize:'var(--text-xs)', color:'var(--text-muted)', textAlign:'center' }}>
                    Press "Send Data" to begin
                  </div>
                ) : log.map(e => (
                  <div key={e.id} style={{ display:'grid', gridTemplateColumns:'44px 1fr', gap:4, padding:'4px 12px', borderBottom:'1px solid var(--border-subtle)' }}>
                    <span style={{ fontSize:10, fontFamily:'var(--font-mono)', color:'var(--text-muted)', paddingTop:1 }}>{e.ts}</span>
                    <span style={{ fontSize:'var(--text-xs)', fontFamily:'var(--font-mono)', color: e.color ?? 'var(--text-secondary)', lineHeight:1.4 }}>{e.msg}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Packet Inspector overlay */}
      {showInspector && packet && (
        <div style={{ position:'absolute', top:80, right:'var(--sp-3)', zIndex:100, width:340 }}>
          <PacketInspector pkt={packet} onClose={() => setShowInspector(false)} />
        </div>
      )}
    </div>
  )
}
