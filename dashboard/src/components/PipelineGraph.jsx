import React, { useState, useEffect } from 'react'
import { Server, Cpu, ShieldCheck, ShieldAlert, Database, Zap, ArrowRight, Activity, Terminal, CornerDownRight } from 'lucide-react'
import { getTrustScore, getTrustColor } from '../utils.js'

export default function PipelineGraph({ nodes = {}, osiSummary = {}, onSelectNode }) {
  const nodeList = Object.values(nodes)
  const [pulseTick, setPulseTick] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setPulseTick(t => (t + 1) % 100)
    }, 50)
    return () => clearInterval(timer)
  }, [])

  const quarantinedCount = nodeList.filter(n => n.status === 'QUARANTINED').length
  const suspiciousCount = nodeList.filter(n => n.status === 'SUSPICIOUS').length
  const healthyCount = nodeList.filter(n => n.status === 'HEALTHY').length

  const pipelineStages = [
    {
      id: 'ingest',
      title: 'MULTI-PROTOCOL INGESTION',
      icon: Server,
      color: '#00f3ff',
      details: [
        { label: 'HTTP REST', val: ':8000/telemetry', status: 'ACTIVE' },
        { label: 'MQTT BROKER', val: 'tcp://1883', status: 'ONLINE' },
        { label: 'WEBSOCKET STREAM', val: 'ws:///ws/events', status: 'STREAMING' }
      ]
    },
    {
      id: 'ewma',
      title: 'EWMA STATISTICAL ENGINE',
      icon: Activity,
      color: '#a855f7',
      details: [
        { label: 'DECAY FACTOR (α)', val: '0.20', status: 'LOCKED' },
        { label: 'SAMPLING WINDOW', val: '10 sec', status: 'ROLLING' },
        { label: 'BURST THRESHOLD', val: '0.75 σ', status: 'MONITORING' }
      ]
    },
    {
      id: 'ml_engine',
      title: 'ISOLATION FOREST AI',
      icon: Cpu,
      color: '#38bdf8',
      details: [
        { label: 'FEATURE VECTORS', val: '12-dim OSI', status: 'FIT' },
        { label: 'CONTAMINATION', val: '5.0%', status: 'CALIBRATED' },
        { label: 'INFERENCE LATENCY', val: '< 1.2 ms', status: 'OPTIMAL' }
      ]
    },
    {
      id: 'vector_memory',
      title: 'EPISODIC VECTOR MEMORY',
      icon: Database,
      color: '#f59e0b',
      details: [
        { label: 'EMBEDDING SPACE', val: 'Cosine Sim', status: 'INDEXED' },
        { label: 'KNOWN ATTACK SIGS', val: `${osiSummary.incident_count || 14} patterns`, status: 'LOADED' },
        { label: 'ZERO-DAY MATCH', val: 'KNN k=3', status: 'READY' }
      ]
    },
    {
      id: 'quarantine',
      title: 'AUTONOMOUS MITIGATION',
      icon: ShieldAlert,
      color: quarantinedCount > 0 ? '#ff2e63' : '#10b981',
      details: [
        { label: 'FIREWALL ENFORCER', val: 'IPTables/vSwitch', status: 'ACTIVE' },
        { label: 'QUARANTINE POOL', val: `${quarantinedCount} Node${quarantinedCount !== 1 ? 's' : ''}`, status: quarantinedCount > 0 ? 'ALERT' : 'CLEAR' },
        { label: 'SELF-HEAL WATCHER', val: '60s Probe', status: 'RUNNING' }
      ]
    }
  ]

  return (
    <div className="pipeline-graph-container">
      {/* Header bar */}
      <div className="pipeline-header">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-purple-400 animate-pulse" />
          <span className="font-bold text-sm tracking-wider text-purple-300">
            DISTRIBUTED PIPELINE & DATA FLOW ARCHITECTURE
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="pipeline-metric-badge text-emerald-400 bg-emerald-950/40 border border-emerald-800/60 px-2 py-0.5 rounded">
            ● HEALTHY: {healthyCount}
          </span>
          <span className="pipeline-metric-badge text-amber-400 bg-amber-950/40 border border-amber-800/60 px-2 py-0.5 rounded">
            ▲ SUSPICIOUS: {suspiciousCount}
          </span>
          <span className="pipeline-metric-badge text-rose-400 bg-rose-950/40 border border-rose-800/60 px-2 py-0.5 rounded">
            ⊗ QUARANTINED: {quarantinedCount}
          </span>
        </div>
      </div>

      {/* Interactive Pipeline Diagram Blocks */}
      <div className="pipeline-flow-track">
        {pipelineStages.map((stage, sIdx) => {
          const IconComponent = stage.icon
          return (
            <React.Fragment key={stage.id}>
              <div
                className="pipeline-node-card"
                style={{
                  borderColor: `${stage.color}40`,
                  boxShadow: `0 0 15px ${stage.color}15, inset 0 0 15px ${stage.color}08`
                }}
              >
                {/* Header of pipeline card */}
                <div className="pipeline-card-top" style={{ borderBottom: `1px solid ${stage.color}25` }}>
                  <div className="flex items-center gap-2">
                    <div
                      className="p-1.5 rounded-md"
                      style={{ background: `${stage.color}20`, color: stage.color }}
                    >
                      <IconComponent className="w-3.5 h-3.5" />
                    </div>
                    <span className="font-mono text-xs font-bold tracking-tight text-white/90">
                      {stage.title}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono" style={{ color: stage.color }}>
                    STAGE 0{sIdx + 1}
                  </span>
                </div>

                {/* Body details */}
                <div className="pipeline-card-body">
                  {stage.details.map((item, i) => (
                    <div key={i} className="pipeline-detail-row">
                      <span className="text-white/50 text-[11px] font-mono">{item.label}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-cyan-300 font-mono text-[11px] font-semibold">{item.val}</span>
                        <span
                          className={`text-[9px] px-1 py-0.2 rounded font-mono ${
                            item.status === 'ALERT'
                              ? 'bg-rose-500/20 text-rose-400'
                              : 'bg-white/5 text-white/40'
                          }`}
                        >
                          {item.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Running pulse glow line at bottom of each card */}
                <div
                  className="pipeline-pulse-line"
                  style={{
                    background: `linear-gradient(90deg, transparent, ${stage.color}, transparent)`,
                    transform: `translateX(${(pulseTick * 2) % 150 - 50}%)`
                  }}
                />
              </div>

              {/* Arrow / Connector between stages */}
              {sIdx < pipelineStages.length - 1 && (
                <div className="pipeline-connector-vector">
                  <div className="connector-line">
                    <div
                      className="connector-particle"
                      style={{
                        background: stage.color,
                        boxShadow: `0 0 6px ${stage.color}`,
                        left: `${(pulseTick * 3 + sIdx * 25) % 100}%`
                      }}
                    />
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-white/30 shrink-0" />
                </div>
              )}
            </React.Fragment>
          )
        })}
      </div>

      {/* High-density Live Node Matrix & Telemetry Table (matching bottom section of image 1) */}
      <div className="node-matrix-panel">
        <div className="matrix-header">
          <div className="flex items-center gap-2">
            <Terminal className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-xs font-mono font-bold text-white/90">
              REAL-TIME NODE TELEMETRY & ADDR MATRIX
            </span>
          </div>
          <span className="text-[10px] font-mono text-white/40">
            TOTAL POOL: {nodeList.length} ALLOCATED
          </span>
        </div>

        <div className="matrix-table-wrap">
          <table className="matrix-table">
            <thead>
              <tr>
                <th>HEX ADDR</th>
                <th>NODE IDENTIFIER</th>
                <th>STATUS</th>
                <th>TRUST SCORE</th>
                <th>MSG RATE</th>
                <th>PAYLOAD</th>
                <th>OSI LAYER</th>
                <th>THREAT VECTOR</th>
                <th>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {nodeList.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-6 text-white/40 font-mono text-xs">
                    No active node telemetry streaming. Run simulator to populate matrix.
                  </td>
                </tr>
              ) : (
                nodeList.map((node, i) => {
                  const score = node.anomaly_score || 0
                  const isCritical = score >= 0.75 || node.status === 'QUARANTINED'
                  const isSuspicious = score >= 0.5 || node.status === 'SUSPICIOUS'
                  const hexAddr = `0x${(1048576 + i * 4096).toString(16).toUpperCase()}`

                  return (
                    <tr
                      key={node.node_id}
                      className={isCritical ? 'row-critical' : isSuspicious ? 'row-suspicious' : ''}
                      onClick={() => onSelectNode?.(node)}
                    >
                      <td className="font-mono text-white/40 text-[11px]">{hexAddr}</td>
                      <td className="font-mono font-bold text-white/90 text-xs">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              isCritical
                                ? 'bg-rose-500 shadow-[0_0_8px_#ff2e63]'
                                : isSuspicious
                                ? 'bg-amber-500 shadow-[0_0_8px_#f59e0b]'
                                : 'bg-emerald-500 shadow-[0_0_8px_#10b981]'
                            }`}
                          />
                          {node.node_id}
                        </div>
                      </td>
                      <td>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${
                            node.status === 'QUARANTINED'
                              ? 'bg-rose-950/70 text-rose-300 border border-rose-700/60'
                              : node.status === 'SUSPICIOUS'
                              ? 'bg-amber-950/70 text-amber-300 border border-amber-700/60'
                              : 'bg-emerald-950/70 text-emerald-300 border border-emerald-700/60'
                          }`}
                        >
                          {node.status}
                        </span>
                      </td>
                      <td className="font-mono">
                        <span
                          style={{ color: getTrustColor(score) }}
                          title={`Trust Score = ${(getTrustScore(score) * 100).toFixed(0)}% (raw anomaly ${score.toFixed(4)})`}
                        >
                          {(getTrustScore(score) * 100).toFixed(0)}%
                        </span>
                      </td>
                      <td className="font-mono text-white/70">{(node.ewma_rate || 0).toFixed(2)} msg/s</td>
                      <td className="font-mono text-white/70">{(node.ewma_payload || 0).toFixed(0)} B</td>
                      <td className="font-mono text-cyan-300 text-xs">{node.primary_layer || 'L7 App'}</td>
                      <td className="font-mono text-white/60 text-xs">
                        {node.active_threats?.length ? node.active_threats.join(', ') : 'NOMINAL'}
                      </td>
                      <td>
                        <button
                          className="matrix-inspect-btn"
                          onClick={e => {
                            e.stopPropagation()
                            onSelectNode?.(node)
                          }}
                        >
                          INSPECT →
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
