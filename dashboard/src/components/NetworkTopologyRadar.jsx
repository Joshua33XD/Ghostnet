import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Shield, ShieldAlert, ShieldCheck, Laptop, Camera, Thermometer, Radio, Cpu, Server, Lock } from 'lucide-react'

// Map IP or role to suitable icon
function getDeviceIcon(ip, role) {
  const r = (role || '').toLowerCase()
  if (ip === '192.168.1.105' || r.includes('attacker') || r.includes('rogue')) return Laptop
  if (r.includes('camera') || ip === '192.168.1.20') return Camera
  if (r.includes('thermostat') || ip === '192.168.1.10') return Thermometer
  if (r.includes('relay') || r.includes('plug') || ip === '192.168.1.30') return Radio
  if (r.includes('sensor') || ip === '192.168.1.40') return Cpu
  if (ip === '192.168.1.50' || r.includes('gateway') || r.includes('broker')) return Server
  return Radio
}

export default function NetworkTopologyRadar({ devices = [], onSelectDevice }) {
  const [hoveredIp, setHoveredIp] = useState(null)

  // Layout parameters
  const width = 640
  const height = 370
  const centerX = width / 2
  const centerY = height / 2 - 6
  const orbitRadiusX = 225
  const orbitRadiusY = 115

  // Separate gateway from other nodes
  const gateway = devices.find(d => d.ip === '192.168.1.50') || {
    ip: '192.168.1.50',
    name: 'Edge Gateway / Broker',
    status: 'HEALTHY',
    role: 'Gateway',
  }

  const peripheralDevices = useMemo(() => {
    const list = devices.filter(d => d.ip !== '192.168.1.50')
    if (list.length === 0) {
      // Fallback preview devices
      return [
        { ip: '192.168.1.10', name: 'Smart Thermostat', status: 'HEALTHY' },
        { ip: '192.168.1.20', name: 'Security Camera', status: 'HEALTHY' },
        { ip: '192.168.1.30', name: 'Smart Plug Relay', status: 'SUSPICIOUS' },
        { ip: '192.168.1.40', name: 'Environment Sensor', status: 'HEALTHY' },
        { ip: '192.168.1.105', name: 'Rogue Attacker Laptop', status: 'QUARANTINED' },
      ]
    }
    return list
  }, [devices])

  // Calculate elliptical orbit positions
  const nodePositions = useMemo(() => {
    const count = peripheralDevices.length
    return peripheralDevices.map((device, idx) => {
      // Offset slightly to place attacker prominently on the top-right / right
      const angle = (idx / count) * 2 * Math.PI - Math.PI / 4
      const x = centerX + Math.cos(angle) * orbitRadiusX
      const y = centerY + Math.sin(angle) * orbitRadiusY
      return { ...device, x, y, angle }
    })
  }, [peripheralDevices, centerX, centerY, orbitRadiusX, orbitRadiusY])

  return (
    <div className="soc-radar-container">
      {/* Top Left Status Badge */}
      <div style={{ position: 'absolute', top: 16, left: 18, zIndex: 10, display: 'flex', gap: 10, alignItems: 'center' }}>
        <span style={{ fontFamily: 'var(--wf-mono)', fontSize: 11, fontWeight: 700, color: 'var(--wf-cyan)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Network Mesh 192.168.1.0/24
        </span>
        <span style={{ fontFamily: 'var(--wf-mono)', fontSize: 10, color: 'var(--wf-mute)', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: 4 }}>
          {devices.length} Nodes Active
        </span>
      </div>

      {/* SVG Canvas for Topology & Animated Flows */}
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: '100%', height: '100%', overflow: 'visible' }}
      >
        <defs>
          {/* Radar Sweep Gradient */}
          <radialGradient id="radarSweep" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#00f2fe" stopOpacity="0.25" />
            <stop offset="60%" stopColor="#00f2fe" stopOpacity="0.05" />
            <stop offset="100%" stopColor="#00f2fe" stopOpacity="0" />
          </radialGradient>

          {/* Quarantined Laser Shield Pattern */}
          <radialGradient id="laserShield" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ff3366" stopOpacity="0.4" />
            <stop offset="70%" stopColor="#ff3366" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#ff3366" stopOpacity="0" />
          </radialGradient>

          <filter id="glowCyan" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>

          <filter id="glowStop" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Orbit Grid Rings */}
        <ellipse
          cx={centerX}
          cy={centerY}
          rx={orbitRadiusX * 0.45}
          ry={orbitRadiusY * 0.45}
          fill="none"
          stroke="rgba(255, 255, 255, 0.04)"
          strokeWidth="1"
          strokeDasharray="4 4"
        />
        <ellipse
          cx={centerX}
          cy={centerY}
          rx={orbitRadiusX * 0.75}
          ry={orbitRadiusY * 0.75}
          fill="none"
          stroke="rgba(255, 255, 255, 0.05)"
          strokeWidth="1"
        />
        <ellipse
          cx={centerX}
          cy={centerY}
          rx={orbitRadiusX}
          ry={orbitRadiusY}
          fill="none"
          stroke="rgba(0, 242, 254, 0.12)"
          strokeWidth="1.5"
          strokeDasharray="6 6"
        />

        {/* Radar Rotating Sweep Line */}
        <motion.g
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 8, ease: 'linear' }}
          style={{ transformOrigin: `${centerX}px ${centerY}px` }}
        >
          <line
            x1={centerX}
            y1={centerY}
            x2={centerX + orbitRadiusX * 1.05}
            y2={centerY}
            stroke="url(#radarSweep)"
            strokeWidth="2"
          />
        </motion.g>

        {/* Connecting Mesh Lines & Flow Particles */}
        {nodePositions.map((node) => {
          const isQuarantined = (node.status || '').toUpperCase() === 'QUARANTINED'
          const isSuspicious = (node.status || '').toUpperCase() === 'SUSPICIOUS'
          const isHovered = hoveredIp === node.ip

          const strokeColor = isQuarantined
            ? '#ff3366'
            : isSuspicious
            ? '#f59e0b'
            : 'rgba(0, 242, 254, 0.35)'

          return (
            <g key={`link-${node.ip}`}>
              <line
                x1={centerX}
                y1={centerY}
                x2={node.x}
                y2={node.y}
                stroke={strokeColor}
                strokeWidth={isHovered ? 2.5 : isQuarantined ? 2 : 1}
                strokeDasharray={isQuarantined ? '4 4' : 'none'}
                opacity={isHovered ? 1 : 0.6}
              />

              {/* Laser Quarantine Barrier around isolated links */}
              {isQuarantined && (
                <circle
                  cx={(centerX + node.x) / 2}
                  cy={(centerY + node.y) / 2}
                  r="12"
                  fill="none"
                  stroke="#ff3366"
                  strokeWidth="1"
                  strokeDasharray="2 2"
                  opacity="0.8"
                />
              )}
            </g>
          )
        })}

        {/* Center Gateway / Broker Node */}
        <g transform={`translate(${centerX}, ${centerY})`} style={{ cursor: 'pointer' }}>
          {/* Radiating pulse ring */}
          <motion.circle
            r="28"
            fill="none"
            stroke="#00f2fe"
            strokeWidth="1"
            animate={{ scale: [1, 1.45, 1], opacity: [0.6, 0.1, 0.6] }}
            transition={{ repeat: Infinity, duration: 2.8, ease: 'easeInOut' }}
          />
          <circle r="22" fill="#0c111a" stroke="#00f2fe" strokeWidth="2" filter="url(#glowCyan)" />
          <foreignObject x="-12" y="-12" width="24" height="24">
            <div style={{ display: 'grid', placeItems: 'center', color: '#00f2fe' }}>
              <Server size={18} />
            </div>
          </foreignObject>
          <text
            y="36"
            textAnchor="middle"
            fill="var(--wf-ink)"
            fontFamily="var(--wf-mono)"
            fontSize="10"
            fontWeight="600"
          >
            GATEWAY 192.168.1.50
          </text>
        </g>

        {/* Peripheral Device Nodes */}
        {nodePositions.map((node) => {
          const isQuarantined = (node.status || '').toUpperCase() === 'QUARANTINED'
          const isSuspicious = (node.status || '').toUpperCase() === 'SUSPICIOUS'
          const isHovered = hoveredIp === node.ip
          const Icon = getDeviceIcon(node.ip, node.name || node.role)

          const nodeColor = isQuarantined ? '#ff3366' : isSuspicious ? '#f59e0b' : '#10b981'
          const glowFilter = isQuarantined ? 'url(#glowStop)' : isHovered ? 'url(#glowCyan)' : undefined

          return (
            <g
              key={node.ip}
              transform={`translate(${node.x}, ${node.y})`}
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => setHoveredIp(node.ip)}
              onMouseLeave={() => setHoveredIp(null)}
              onClick={() => onSelectDevice && onSelectDevice(node.ip)}
            >
              {/* Laser Quarantine Boundary */}
              {isQuarantined && (
                <motion.circle
                  r="26"
                  fill="url(#laserShield)"
                  stroke="#ff3366"
                  strokeWidth="1.5"
                  strokeDasharray="4 2"
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 12, ease: 'linear' }}
                />
              )}

              {/* Node background circle */}
              <circle
                r={isHovered ? 19 : 16}
                fill="#0e131e"
                stroke={nodeColor}
                strokeWidth={isHovered ? 2.5 : 1.5}
                filter={glowFilter}
              />

              {/* Device Icon */}
              <foreignObject x="-9" y="-9" width="18" height="18">
                <div style={{ display: 'grid', placeItems: 'center', color: nodeColor }}>
                  <Icon size={14} />
                </div>
              </foreignObject>

              {/* Quarantine Lock Indicator */}
              {isQuarantined && (
                <circle cx="10" cy="-10" r="6" fill="#ff3366" />
              )}

              {/* IP / Name Label */}
              <text
                y={node.y > centerY ? 24 : -20}
                textAnchor="middle"
                fill={isQuarantined ? '#ff3366' : isHovered ? 'var(--wf-cyan)' : 'var(--wf-ink-soft)'}
                fontFamily="var(--wf-mono)"
                fontSize="10"
                fontWeight={isHovered || isQuarantined ? '700' : '500'}
              >
                {node.ip}
              </text>
            </g>
          )
        })}
      </svg>

      {/* Bottom Floating Legend */}
      <div style={{
        position: 'absolute',
        bottom: 12,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: 14,
        background: 'rgba(10, 14, 22, 0.85)',
        border: '1px solid var(--wf-line)',
        borderRadius: 20,
        padding: '4px 14px',
        fontFamily: 'var(--wf-mono)',
        fontSize: 10,
        backdropFilter: 'blur(10px)',
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#10b981' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} /> Healthy
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#f59e0b' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b' }} /> Suspicious
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#ff3366' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ff3366' }} /> Quarantined
        </span>
      </div>
    </div>
  )
}
