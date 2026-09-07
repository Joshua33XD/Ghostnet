import React, { useEffect, useRef, useState } from 'react'
import { Activity, ShieldAlert, Radio, Cpu, Layers } from 'lucide-react'

export default function TopographicRadar({ nodes = {}, wsStatus, onSelectNode }) {
  const canvasRef = useRef(null)
  const [activeTab, setActiveTab] = useState('3d-mesh')
  const [hoveredNode, setHoveredNode] = useState(null)
  const animFrameRef = useRef(null)
  const rotAngleRef = useRef(0)

  const nodeList = Object.values(nodes)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let width = (canvas.width = canvas.parentElement?.clientWidth || 700)
    let height = (canvas.height = canvas.parentElement?.clientHeight || 420)

    const handleResize = () => {
      if (!canvas.parentElement) return
      width = canvas.width = canvas.parentElement.clientWidth
      height = canvas.height = canvas.parentElement.clientHeight
    }
    window.addEventListener('resize', handleResize)

    const render = () => {
      rotAngleRef.current += 0.004
      ctx.clearRect(0, 0, width, height)

      const cx = width / 2
      const cy = height * 0.58
      const maxR = Math.min(width, height) * 0.42

      // Draw background ambient glow
      const radialGrad = ctx.createRadialGradient(cx, cy, 10, cx, cy, maxR * 1.2)
      radialGrad.addColorStop(0, 'rgba(139, 92, 246, 0.08)')
      radialGrad.addColorStop(0.5, 'rgba(34, 211, 238, 0.04)')
      radialGrad.addColorStop(1, 'rgba(0, 0, 0, 0)')
      ctx.fillStyle = radialGrad
      ctx.fillRect(0, 0, width, height)

      // Draw Topographic elevation rings (Concentric distorted ellipses creating 3D mountain effect)
      const numRings = 14
      const time = Date.now() * 0.001

      // Calculate max anomaly among nodes to distort the mountain peak
      const maxScore = nodeList.length
        ? Math.max(...nodeList.map(n => n.anomaly_score || 0))
        : 0

      for (let rIdx = 1; rIdx <= numRings; rIdx++) {
        const t = rIdx / numRings // 0..1
        const rx = maxR * (1 - t * 0.7)
        const ry = rx * 0.42 // 3D isometric tilt
        const elevationY = cy - t * (80 + maxScore * 90) // peak height

        ctx.beginPath()
        const points = 48
        for (let p = 0; p <= points; p++) {
          const theta = (p / points) * Math.PI * 2 + rotAngleRef.current
          // Add subtle topographic noise
          const noise = Math.sin(theta * 3 + time + rIdx) * (4 * t) + Math.cos(theta * 5 - time) * (2 * t)
          const px = cx + (rx + noise) * Math.cos(theta)
          const py = elevationY + (ry + noise * 0.5) * Math.sin(theta)

          if (p === 0) ctx.moveTo(px, py)
          else ctx.lineTo(px, py)
        }

        ctx.closePath()
        const ringAlpha = 0.08 + (t * 0.25)
        const ringColor = maxScore > 0.7 ? 'rgba(255, 61, 110, ' : maxScore > 0.4 ? 'rgba(245, 158, 11, ' : 'rgba(0, 243, 255, '
        ctx.strokeStyle = `${ringColor}${ringAlpha})`
        ctx.lineWidth = t > 0.8 ? 1.5 : 0.9
        ctx.stroke()
      }

      // Draw radial grid lines down the mountain
      const radialCount = 12
      for (let i = 0; i < radialCount; i++) {
        const angle = (i / radialCount) * Math.PI * 2 + rotAngleRef.current
        ctx.beginPath()
        for (let rIdx = 1; rIdx <= numRings; rIdx += 2) {
          const t = rIdx / numRings
          const rx = maxR * (1 - t * 0.7)
          const ry = rx * 0.42
          const elevationY = cy - t * (80 + maxScore * 90)
          const px = cx + rx * Math.cos(angle)
          const py = elevationY + ry * Math.sin(angle)
          if (rIdx === 1) ctx.moveTo(px, py)
          else ctx.lineTo(px, py)
        }
        ctx.strokeStyle = 'rgba(139, 92, 246, 0.12)'
        ctx.lineWidth = 0.7
        ctx.stroke()
      }

      // Plot Nodes as 3D Interactive Pins on the Topography
      nodeList.forEach((node, idx) => {
        // Distribute nodes around the topography based on index and anomaly score
        const baseAngle = (idx / Math.max(nodeList.length, 1)) * Math.PI * 2 + (rotAngleRef.current * 0.5)
        const score = node.anomaly_score || 0
        // Nodes with higher anomaly move closer to the mountain peak
        const t = 0.2 + score * 0.7
        const rx = maxR * (1 - t * 0.7)
        const ry = rx * 0.42
        const elevationY = cy - t * (80 + maxScore * 90)

        const pinX = cx + rx * Math.cos(baseAngle)
        const pinY = elevationY + ry * Math.sin(baseAngle)

        const isQuarantined = node.status === 'QUARANTINED'
        const isSuspicious = node.status === 'SUSPICIOUS'
        const color = isQuarantined ? '#ff2e63' : isSuspicious ? '#f59e0b' : '#00ff9d'

        // Vertical drop line to base
        ctx.beginPath()
        ctx.moveTo(pinX, pinY)
        ctx.lineTo(pinX, pinY + (t * (80 + maxScore * 90)))
        ctx.strokeStyle = `${color}44`
        ctx.lineWidth = 1
        ctx.setLineDash([2, 4])
        ctx.stroke()
        ctx.setLineDash([])

        // Pulsing radar ring around node
        const pulseR = 6 + (Math.sin(time * 4 + idx) + 1) * 6
        ctx.beginPath()
        ctx.arc(pinX, pinY, pulseR, 0, Math.PI * 2)
        ctx.strokeStyle = `${color}66`
        ctx.lineWidth = 1.2
        ctx.stroke()

        // Node center marker pin
        ctx.beginPath()
        ctx.arc(pinX, pinY, 4.5, 0, Math.PI * 2)
        ctx.fillStyle = color
        ctx.shadowColor = color
        ctx.shadowBlur = 12
        ctx.fill()
        ctx.shadowBlur = 0

        // Node Label Pill
        const labelText = `${node.node_id}`
        ctx.font = '10px "JetBrains Mono", monospace'
        const textW = ctx.measureText(labelText).width
        const pillX = pinX - textW / 2 - 6
        const pillY = pinY - 22

        ctx.fillStyle = 'rgba(7, 11, 22, 0.85)'
        ctx.strokeStyle = `${color}88`
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.roundRect(pillX, pillY, textW + 12, 16, 4)
        ctx.fill()
        ctx.stroke()

        ctx.fillStyle = '#ffffff'
        ctx.fillText(labelText, pillX + 6, pillY + 12)

        // Anomaly Score badge tag
        const scoreText = `${(score * 100).toFixed(0)}%`
        ctx.font = '9px "JetBrains Mono", monospace'
        const scoreW = ctx.measureText(scoreText).width
        ctx.fillStyle = color
        ctx.fillText(scoreText, pinX + textW / 2 + 10, pillY + 12)
      })

      // Draw compass radar reticle & coordinates
      ctx.strokeStyle = 'rgba(0, 243, 255, 0.15)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(cx, cy, maxR * 1.05, 0, Math.PI * 2)
      ctx.stroke()

      // Crosshairs & degree ticks
      for (let deg = 0; deg < 360; deg += 30) {
        const rad = (deg * Math.PI) / 180
        const x1 = cx + maxR * 1.02 * Math.cos(rad)
        const y1 = cy + (maxR * 1.02 * 0.42) * Math.sin(rad)
        const x2 = cx + maxR * 1.06 * Math.cos(rad)
        const y2 = cy + (maxR * 1.06 * 0.42) * Math.sin(rad)
        ctx.beginPath()
        ctx.moveTo(x1, y1)
        ctx.lineTo(x2, y2)
        ctx.stroke()
      }

      animFrameRef.current = requestAnimationFrame(render)
    }

    render()

    return () => {
      cancelAnimationFrame(animFrameRef.current)
      window.removeEventListener('resize', handleResize)
    }
  }, [nodeList])

  return (
    <div className="topographic-radar-container">
      {/* Top Glass Header Bar */}
      <div className="radar-glass-header">
        <div className="radar-title-group">
          <div className="radar-badge-pulse">
            <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span className="radar-badge-text">3D TOPOGRAPHIC THREAT RADAR</span>
          </div>
          <span className="radar-subtext">Multi-Vector Elevation Mesh & Spatial Telemetry</span>
        </div>

        <div className="radar-control-pills">
          <button
            className={`radar-pill-btn ${activeTab === '3d-mesh' ? 'active' : ''}`}
            onClick={() => setActiveTab('3d-mesh')}
          >
            <Layers className="w-3 h-3 inline-block mr-1" />
            Topographic Mesh
          </button>
          <button
            className={`radar-pill-btn ${activeTab === 'spectrum' ? 'active' : ''}`}
            onClick={() => setActiveTab('spectrum')}
          >
            <Activity className="w-3 h-3 inline-block mr-1" />
            OSI Spectrum
          </button>
        </div>
      </div>

      {/* Main Radar Display Canvas */}
      <div className="radar-canvas-wrap">
        <canvas ref={canvasRef} className="radar-canvas" />

        {/* Ambient Topographical Overlay Stats */}
        <div className="radar-hud-overlay top-left">
          <div className="hud-metric">
            <span className="hud-metric-lbl">ACTIVE NODES</span>
            <span className="hud-metric-val">{nodeList.length}</span>
          </div>
          <div className="hud-metric">
            <span className="hud-metric-lbl">TOPOLOGY ELEVATION</span>
            <span className="hud-metric-val text-cyan">
              {nodeList.length ? (Math.max(...nodeList.map(n => n.anomaly_score || 0)) * 100).toFixed(1) : '0.0'}%
            </span>
          </div>
        </div>

        <div className="radar-hud-overlay top-right">
          <div className="hud-metric right-aligned">
            <span className="hud-metric-lbl">VECTOR ENGINE</span>
            <span className="hud-metric-val text-emerald">EWMA + I-FOREST</span>
          </div>
          <div className="hud-metric right-aligned">
            <span className="hud-metric-lbl">SAMPLING FREQ</span>
            <span className="hud-metric-val">2.0 Hz LIVE</span>
          </div>
        </div>

        {/* Live Spectrum Frequency Equalizer Bar (Bottom HUD) */}
        <div className="radar-spectrum-footer">
          <div className="spectrum-label">
            <span className="text-muted">OSI LAYER OSCILLATIONS</span>
            <span className="spectrum-live-badge">REAL-TIME</span>
          </div>
          <div className="spectrum-bars-row">
            {['L2 Datalink', 'L3 Network', 'L4 Transport', 'L7 Application'].map((layer, idx) => {
              const heights = [35 + (idx * 15) % 40, 60 - (idx * 8), 45 + (idx * 12), 75 - (idx * 10)]
              return (
                <div key={layer} className="spectrum-layer-col">
                  <div className="spectrum-eq-bars">
                    {[1, 2, 3, 4, 5, 6].map(b => (
                      <div
                        key={b}
                        className="eq-bar-segment"
                        style={{
                          height: `${Math.max(15, (heights[idx] * (b / 6)) + (Math.sin(Date.now() * 0.005 + b + idx) * 12))}%`,
                          opacity: 0.3 + (b / 6) * 0.7
                        }}
                      />
                    ))}
                  </div>
                  <span className="spectrum-layer-name">{layer}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
