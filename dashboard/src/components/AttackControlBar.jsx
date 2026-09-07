import React, { useState } from 'react'
import { Play, Shield, Flame, Activity, RefreshCw, Radio } from 'lucide-react'

export default function AttackControlBar({ onTriggerSimulator }) {
  const [activeMode, setActiveMode] = useState('IDLE')
  const [simNodeId, setSimNodeId] = useState('demo-cam-01')
  const [isInjecting, setIsInjecting] = useState(false)

  const handleInjectTelemetry = async (mode) => {
    setActiveMode(mode)
    setIsInjecting(true)
    try {
      const isAttack = mode !== 'NORMAL'
      const payload = {
        node_id: simNodeId,
        timestamp: Date.now() / 1000,
        protocol: 'HTTP',
        status: isAttack ? 'ATTACK' : 'NORMAL',
        anomaly_score: isAttack ? 0.94 : 0.08,
        features: {
          rate: isAttack ? 48.5 : 1.2,
          payload_size: isAttack ? 2048 : 128,
          layer: isAttack ? 'L7 Application' : 'L4 Transport',
          attack_type: isAttack ? mode : 'None'
        }
      }

      await fetch('http://localhost:8000/telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
    } catch (e) {
      console.warn('Simulation injection dispatched:', e)
    } finally {
      setTimeout(() => setIsInjecting(false), 800)
    }
  }

  return (
    <div className="attack-control-glass-bar">
      <div className="flex items-center gap-2">
        <Radio className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
        <span className="text-[11px] font-mono font-bold tracking-wider text-white/90">
          SIMULATOR INJECTOR:
        </span>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center bg-black/40 border border-white/10 rounded px-2 py-1">
          <span className="text-[10px] font-mono text-white/40 mr-1.5">NODE:</span>
          <input
            type="text"
            value={simNodeId}
            onChange={e => setSimNodeId(e.target.value)}
            className="bg-transparent text-white font-mono text-xs w-24 outline-none border-none"
          />
        </div>

        <button
          className="sim-btn normal"
          onClick={() => handleInjectTelemetry('NORMAL')}
          disabled={isInjecting}
        >
          <Activity className="w-3 h-3 text-emerald-400" />
          <span>Normal Baseline</span>
        </button>

        <button
          className="sim-btn attack"
          onClick={() => handleInjectTelemetry('HTTP_FLOOD')}
          disabled={isInjecting}
        >
          <Flame className="w-3 h-3 text-rose-400" />
          <span>HTTP Flood (L7)</span>
        </button>

        <button
          className="sim-btn attack-orange"
          onClick={() => handleInjectTelemetry('MQTT_SPOOF')}
          disabled={isInjecting}
        >
          <Flame className="w-3 h-3 text-amber-400" />
          <span>MQTT Spoof (L4)</span>
        </button>

        <button
          className="sim-btn attack-purple"
          onClick={() => handleInjectTelemetry('SLOWLORIS')}
          disabled={isInjecting}
        >
          <Flame className="w-3 h-3 text-purple-400" />
          <span>Slowloris DOS</span>
        </button>
      </div>
    </div>
  )
}
