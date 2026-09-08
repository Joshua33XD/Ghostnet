import React, { useState } from 'react'
import { Activity, Flame, Radio } from 'lucide-react'
import { getApiUrl } from '../apiConfig.js'

export default function AttackControlBar() {
  const [activeMode, setActiveMode] = useState('IDLE')
  const [simNodeId, setSimNodeId] = useState('demo-cam-01')
  const [isInjecting, setIsInjecting] = useState(false)

  const handleInjectTelemetry = async (mode) => {
    setActiveMode(mode)
    setIsInjecting(true)
    try {
      const isAttack = mode !== 'NORMAL'
      await fetch(`${getApiUrl()}/ingest/telemetry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          node_id: simNodeId,
          seq: Math.floor(Math.random() * 999999),
          ts: Date.now() / 1000,
          status: isAttack ? 'ATTACK' : 'NORMAL',
          padding: isAttack ? 'x'.repeat(80) : '',
          attack_type: isAttack ? mode : 'None',
        }),
      })
    } catch (e) {
      console.warn('Simulation injection failed:', e)
    } finally {
      setTimeout(() => setIsInjecting(false), 800)
    }
  }

  return (
    <div className="attack-control-bar">
      <div className="flex items-center gap-2">
        <Radio className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
        <span className="text-[11px] font-mono font-bold tracking-wider">
          SIMULATOR {activeMode !== 'IDLE' ? `· ${activeMode}` : ''}
        </span>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center bg-black/40 border border-white/10 rounded px-2 py-1">
          <span className="text-[10px] font-mono text-white/40 mr-1.5">NODE:</span>
          <input
            type="text"
            value={simNodeId}
            onChange={e => setSimNodeId(e.target.value)}
            className="attack-input"
          />
        </div>

        <button
          className="attack-btn"
          onClick={() => handleInjectTelemetry('NORMAL')}
          disabled={isInjecting}
        >
          <Activity className="w-3 h-3" />
          <span>Normal</span>
        </button>

        <button
          className="attack-btn"
          onClick={() => handleInjectTelemetry('HTTP_FLOOD')}
          disabled={isInjecting}
        >
          <Flame className="w-3 h-3" />
          <span>HTTP Flood</span>
        </button>
      </div>
    </div>
  )
}
