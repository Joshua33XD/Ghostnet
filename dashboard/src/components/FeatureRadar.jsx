import React from 'react'
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip
} from 'recharts'
import { Activity, ShieldAlert, Cpu } from 'lucide-react'

export default function FeatureRadar({ nodes = {}, selectedNodeId }) {
  const nodeList = Object.values(nodes)
  const activeNode = nodeList.find(n => n.node_id === selectedNodeId) || nodeList[0]

  if (!activeNode) {
    return (
      <div className="feature-radar-card flex items-center justify-center p-8 text-white/40 font-mono text-xs">
        No active node data to map feature vectors.
      </div>
    )
  }

  const score = activeNode.anomaly_score || 0
  const rateNormalized = Math.min((activeNode.ewma_rate || 0) / 50, 1) * 100
  const payloadNormalized = Math.min((activeNode.ewma_payload || 0) / 2048, 1) * 100
  const anomalyNormalized = Math.min(score, 1) * 100
  const burstNormalized = score > 0.6 ? 85 : score > 0.3 ? 45 : 15
  const osiEntropy = activeNode.primary_layer?.includes('L7') ? 90 : 30
  const vectorDist = Math.min(score * 1.2, 1) * 100

  const radarData = [
    { feature: 'Packet Rate', value: rateNormalized, fullMark: 100 },
    { feature: 'Payload Size', value: payloadNormalized, fullMark: 100 },
    { feature: 'EWMA Anomaly', value: anomalyNormalized, fullMark: 100 },
    { feature: 'Burst Density', value: burstNormalized, fullMark: 100 },
    { feature: 'OSI Entropy', value: osiEntropy, fullMark: 100 },
    { feature: 'Vector Distance', value: vectorDist, fullMark: 100 },
  ]

  const isCritical = score >= 0.75
  const color = isCritical ? '#ff2e63' : score >= 0.5 ? '#f59e0b' : '#00f3ff'

  return (
    <div className="feature-radar-card">
      <div className="radar-header">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-cyan-400" />
          <span className="font-mono text-xs font-bold text-white tracking-wider">
            FEATURE VECTOR RADAR — {activeNode.node_id}
          </span>
        </div>
        <span
          className="text-[10px] font-mono font-bold px-2 py-0.5 rounded"
          style={{ background: `${color}20`, color, border: `1px solid ${color}40` }}
        >
          {activeNode.status} ({score.toFixed(3)})
        </span>
      </div>

      <div style={{ width: '100%', height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
            <PolarGrid stroke="rgba(255, 255, 255, 0.08)" />
            <PolarAngleAxis
              dataKey="feature"
              tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'JetBrains Mono' }}
            />
            <PolarRadiusAxis
              angle={30}
              domain={[0, 100]}
              tick={{ fill: '#475569', fontSize: 8, fontFamily: 'JetBrains Mono' }}
            />
            <Radar
              name={activeNode.node_id}
              dataKey="value"
              stroke={color}
              fill={color}
              fillOpacity={0.35}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="p-2 rounded bg-slate-900 border border-cyan-500/30 text-white font-mono text-[11px]">
                      <div>{payload[0].payload.feature}: <strong className="text-cyan-300">{payload[0].value.toFixed(1)}%</strong></div>
                    </div>
                  )
                }
                return null
              }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
