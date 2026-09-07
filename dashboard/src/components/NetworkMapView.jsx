// NetworkMapView — SVG topology: Internet → Gateway → Nodes
import { useState } from 'react'
import { Globe, Cpu, Camera, Thermometer, Wifi, HardDrive, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react'
import { getTrustScore, getTrustColor } from '../utils.js'

const STATUS_COLOR = {
  HEALTHY:    'var(--status-healthy)',
  SUSPICIOUS: 'var(--status-warn)',
  QUARANTINED:'var(--status-danger)',
  OFFLINE:    'var(--status-offline)',
}

function nodeIcon(nodeId) {
  const id = nodeId?.toLowerCase() ?? ''
  if (id.includes('cam'))  return Camera
  if (id.includes('temp') || id.includes('thermo')) return Thermometer
  if (id.includes('gw') || id.includes('gateway')) return Globe
  if (id.includes('sensor')) return Wifi
  return HardDrive
}

export default function NetworkMapView({ nodes, onSelectNode, selectedNodeId }) {
  const [zoom, setZoom] = useState(1)
  const list = Object.values(nodes)

  // Layout: centre = gateway (or first node), others fan out
  const gateway = list.find(n => n.node_id?.toLowerCase().includes('gw') || n.node_id?.toLowerCase().includes('gateway')) ?? list[0]
  const leafNodes = list.filter(n => n !== gateway)

  const W = 520, H = 260
  const cx = W / 2, cy = H / 2

  // Gateway position
  const gwX = cx, gwY = cy - 10

  // Internet cloud above
  const cloudX = cx, cloudY = 30

  // Fan leaves
  const spread = Math.min(200, leafNodes.length * 35)
  const leafPositions = leafNodes.map((n, i) => {
    const t = leafNodes.length === 1 ? 0.5 : i / (leafNodes.length - 1)
    const x = cx - spread + t * spread * 2
    const y = gwY + 80
    return { node: n, x, y }
  })

  if (list.length === 0) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', color:'var(--text-muted)' }}>
        <div style={{ textAlign:'center' }}>
          <Globe size={36} style={{ opacity:0.2, margin:'0 auto 8px' }} />
          <div style={{ fontSize:'var(--text-sm)' }}>No nodes connected</div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ position:'relative', height:'100%', overflow:'hidden' }}>
      {/* Zoom controls */}
      <div style={{ position:'absolute', top:8, right:8, display:'flex', gap:4, zIndex:10 }}>
        {[
          { icon:ZoomIn,   action:() => setZoom(z => Math.min(z + 0.2, 2)) },
          { icon:ZoomOut,  action:() => setZoom(z => Math.max(z - 0.2, 0.4)) },
          { icon:Maximize2,action:() => setZoom(1) },
        ].map(({ icon:Icon, action }) => (
          <button key={Icon.displayName} onClick={action} style={{
            width:26, height:26, borderRadius:5, border:'1px solid var(--border)',
            background:'var(--surface-raised)', cursor:'pointer',
            display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-muted)'
          }}>
            <Icon size={11} />
          </button>
        ))}
      </div>

      <div style={{ width:'100%', height:'100%', overflow:'auto', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <svg
          width={W * zoom} height={H * zoom}
          viewBox={`0 0 ${W} ${H}`}
          style={{ overflow:'visible', flexShrink:0 }}
        >
          {/* Cloud → gateway line */}
          <line x1={cloudX} y1={cloudY + 22} x2={gwX} y2={gwY - 20}
            stroke="var(--accent)" strokeWidth={1.5} strokeDasharray="5 3" opacity={0.6} />

          {/* Gateway → leaf lines */}
          {leafPositions.map(({ node, x, y }) => {
            const isQ = node.status === 'QUARANTINED'
            return (
              <line key={node.node_id}
                x1={gwX} y1={gwY + 20} x2={x} y2={y - 18}
                stroke={isQ ? 'var(--status-danger)' : STATUS_COLOR[node.status] ?? 'var(--border)'}
                strokeWidth={isQ ? 2 : 1.5}
                strokeDasharray={isQ ? '4 3' : node.status === 'SUSPICIOUS' ? '6 3' : undefined}
                opacity={node.status === 'OFFLINE' ? 0.3 : 0.7}
              />
            )
          })}

          {/* Internet cloud */}
          <g transform={`translate(${cloudX - 28}, ${cloudY - 18})`}>
            <ellipse cx={28} cy={20} rx={28} ry={18}
              fill="var(--surface-raised)" stroke="var(--border)" strokeWidth={1} />
            <text x={28} y={25} textAnchor="middle"
              fill="var(--text-muted)" fontSize={9} fontFamily="var(--font-mono)">
              Internet
            </text>
          </g>

          {/* Gateway */}
          {gateway && (() => {
            const col = STATUS_COLOR[gateway.status] ?? 'var(--text-muted)'
            const trust = Math.round(getTrustScore(gateway.anomaly_score ?? 0) * 100)
            const isSelected = gateway.node_id === selectedNodeId
            return (
              <g key={gateway.node_id} className="map-node-group"
                transform={`translate(${gwX}, ${gwY})`}
                onClick={() => onSelectNode(gateway)}
                style={{ cursor:'pointer' }}>
                <rect x={-38} y={-22} width={76} height={44} rx={8}
                  fill="var(--surface-raised)"
                  stroke={isSelected ? 'var(--accent)' : col}
                  strokeWidth={isSelected ? 2 : 1.5}
                  className="map-node-box"
                />
                {/* status dot */}
                <circle cx={28} cy={-14} r={4} fill={col} />
                <text x={0} y={-6} textAnchor="middle"
                  fill="var(--text-primary)" fontSize={9} fontFamily="var(--font-mono)" fontWeight="700">
                  {gateway.node_id.length > 10 ? gateway.node_id.slice(-8) : gateway.node_id}
                </text>
                <text x={0} y={6} textAnchor="middle"
                  fill={col} fontSize={8} fontFamily="var(--font-mono)">
                  {gateway.status}
                </text>
                <text x={0} y={17} textAnchor="middle"
                  fill="var(--text-muted)" fontSize={8} fontFamily="var(--font-mono)">
                  Trust {trust}%
                </text>
              </g>
            )
          })()}

          {/* Leaf nodes */}
          {leafPositions.map(({ node, x, y }) => {
            const col = STATUS_COLOR[node.status] ?? 'var(--text-muted)'
            const trust = Math.round(getTrustScore(node.anomaly_score ?? 0) * 100)
            const isSelected = node.node_id === selectedNodeId
            return (
              <g key={node.node_id} className="map-node-group"
                transform={`translate(${x}, ${y})`}
                onClick={() => onSelectNode(node)}
                style={{ cursor:'pointer' }}>
                <rect x={-36} y={-20} width={72} height={42} rx={7}
                  fill="var(--surface-raised)"
                  stroke={isSelected ? 'var(--accent)' : col}
                  strokeWidth={isSelected ? 2 : 1}
                  opacity={node.status === 'OFFLINE' ? 0.5 : 1}
                  className="map-node-box"
                />
                <circle cx={26} cy={-12} r={3.5} fill={col}
                  opacity={node.status === 'OFFLINE' ? 0.4 : 1}
                />
                <text x={0} y={-6} textAnchor="middle"
                  fill="var(--text-primary)" fontSize={8} fontFamily="var(--font-mono)" fontWeight="700">
                  {node.node_id.length > 10 ? node.node_id.slice(-8) : node.node_id}
                </text>
                {node.device_type && (
                  <text x={0} y={4} textAnchor="middle"
                    fill="var(--text-muted)" fontSize={7} fontFamily="var(--font-mono)">
                    {node.device_type}
                  </text>
                )}
                <text x={0} y={15} textAnchor="middle"
                  fill={col} fontSize={7} fontFamily="var(--font-mono)">
                  {node.status === 'OFFLINE' ? 'Offline' : `Trust ${trust}%`}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}
