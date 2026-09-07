import React, { useState, useMemo } from 'react'
import { Terminal, Shield, Zap, AlertTriangle, CheckCircle, Search, Filter, Cpu, Database, Binary, Info } from 'lucide-react'
import { formatRelativeTime, formatExactTime } from '../utils.js'

export default function DeepTelemetryNarrator({ events = [], nodes = {}, onClear, wsStatus }) {
  const [filterType, setFilterType] = useState('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedId, setExpandedId] = useState(null)

  const filteredEvents = useMemo(() => {
    return events.filter(e => {
      const matchSearch = searchQuery
        ? (e.message?.toLowerCase().includes(searchQuery.toLowerCase()) ||
           e.node_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
           e.tag?.toLowerCase().includes(searchQuery.toLowerCase()))
        : true

      if (!matchSearch) return false

      if (filterType === 'ALL') return true
      if (filterType === 'THREATS') return e.tag?.startsWith('THREAT') || e.tag === 'ATTACK' || e.tag === 'QUARANTINE'
      if (filterType === 'HEAL') return e.tag === 'RECOVERED' || e.tag === 'SELF-HEAL' || e.tag === 'THREAT-CLEAR'
      if (filterType === 'PACKETS') return e.tag === 'HTTP' || e.tag === 'MQTT-RX' || e.tag === 'MQTT-TX' || e.tag === 'WS'
      if (filterType === 'AI_ML') return e.tag === 'SCORE' || e.tag === 'ML-ANOMALY' || e.tag?.includes('OSI')
      return true
    })
  }, [events, filterType, searchQuery])

  const toggleExpand = (id) => {
    setExpandedId(prev => prev === id ? null : id)
  }

  // Generate intelligent cyber explanation for events
  const getEventNarrative = (evt) => {
    const tag = evt.tag || ''
    if (tag.startsWith('THREAT:') || tag === 'ATTACK') {
      return {
        level: 'CRITICAL',
        badgeColor: '#ff2e63',
        icon: AlertTriangle,
        explanation: `Threshold exceeded on node ${evt.node_id || 'UNKNOWN'}. Rapid anomaly acceleration detected. Autonomous quarantine mitigation evaluated.`
      }
    }
    if (tag === 'QUARANTINE') {
      return {
        level: 'MITIGATION',
        badgeColor: '#ff2e63',
        icon: Shield,
        explanation: `Autonomous firewall policy enacted. Node ${evt.node_id} isolated from ingress/egress broker queues. 60-second recovery timer initiated.`
      }
    }
    if (tag === 'RECOVERED' || tag === 'SELF-HEAL') {
      return {
        level: 'RESTORATION',
        badgeColor: '#10b981',
        icon: CheckCircle,
        explanation: `Telemetry normalized below EWMA baseline. Node ${evt.node_id} restored to cluster with healthy trust score.`
      }
    }
    if (tag === 'SCORE') {
      return {
        level: 'INFERENCE',
        badgeColor: '#a855f7',
        icon: Cpu,
        explanation: `Statistical model recalculated EWMA anomaly vector. Isolation Forest inference completed.`
      }
    }
    return {
      level: 'TELEMETRY',
      badgeColor: '#00f3ff',
      icon: Terminal,
      explanation: `Live telemetry ingestion packet processed through multi-protocol adapter.`
    }
  }

  return (
    <div className="deep-narrator-panel">
      {/* Top Filter and Controls Bar */}
      <div className="narrator-header">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-cyan-400" />
          <span className="font-mono font-bold text-sm text-cyan-300">
            TRANSPARENT SYSTEM NARRATOR & DEEP TELEMETRY
          </span>
          <span className="ml-2 text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950/60 border border-cyan-800/60 text-cyan-400">
            {events.length} EVENTS RECORDED
          </span>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5">
          {['ALL', 'THREATS', 'AI_ML', 'HEAL', 'PACKETS'].map(f => (
            <button
              key={f}
              className={`narrator-filter-pill ${filterType === f ? 'active' : ''}`}
              onClick={() => setFilterType(f)}
            >
              {f}
            </button>
          ))}
          <button className="narrator-clear-btn" onClick={onClear}>
            CLEAR
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="narrator-search-bar">
        <Search className="w-3.5 h-3.5 text-white/40 ml-2" />
        <input
          type="text"
          placeholder="Filter telemetry events by node, tag, or message payload..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="narrator-search-input"
        />
        {searchQuery && (
          <button className="text-white/40 hover:text-white text-xs px-2" onClick={() => setSearchQuery('')}>
            ✕
          </button>
        )}
      </div>

      {/* Telemetry Stream Feed */}
      <div className="narrator-stream-list">
        {filteredEvents.length === 0 ? (
          <div className="narrator-empty">
            <Info className="w-6 h-6 text-white/20 mb-2" />
            <div className="font-mono text-xs text-white/50">NO TELEMETRY EVENTS MATCHING FILTER</div>
            <div className="text-[11px] text-white/30 mt-1">
              Live packets and detection events will stream here automatically.
            </div>
          </div>
        ) : (
          filteredEvents.map((evt, idx) => {
            const narrative = getEventNarrative(evt)
            const Icon = narrative.icon
            const isExpanded = expandedId === evt._id || (!expandedId && idx === 0)

            return (
              <div
                key={evt._id || idx}
                className={`narrator-event-card ${isExpanded ? 'expanded' : ''}`}
                style={{
                  borderLeft: `3px solid ${narrative.badgeColor}`
                }}
                onClick={() => toggleExpand(evt._id)}
              >
                {/* Event Summary Line */}
                <div className="narrator-event-row">
                  <div className="flex items-center gap-2">
                    <div
                      className="p-1 rounded"
                      style={{ background: `${narrative.badgeColor}20`, color: narrative.badgeColor }}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <span
                      className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded"
                      style={{
                        background: `${narrative.badgeColor}25`,
                        color: narrative.badgeColor,
                        border: `1px solid ${narrative.badgeColor}50`
                      }}
                    >
                      {evt.tag || 'EVENT'}
                    </span>
                    {evt.node_id && (
                      <span className="text-xs font-mono font-bold text-white/90">
                        {evt.node_id}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-mono text-white/40">
                      {formatExactTime(evt._received, evt.ts)} ({formatRelativeTime(evt._received, evt.ts)})
                    </span>
                    <span className="text-white/30 text-[10px] font-mono">
                      {isExpanded ? '▲ LESS' : '▼ DETAILS'}
                    </span>
                  </div>
                </div>

                {/* Primary Message */}
                <div className="narrator-msg-text font-mono text-xs text-white/80 mt-1">
                  {evt.message}
                </div>

                {/* Detailed Cyber Intelligence Breakdown (When expanded) */}
                {isExpanded && (
                  <div className="narrator-detail-drawer">
                    <div className="narrator-intel-box">
                      <div className="flex items-center gap-1.5 text-cyan-300 text-[11px] font-mono font-semibold mb-1">
                        <Zap className="w-3 h-3" />
                        AI ENGINE EXPLANATION & STATE:
                      </div>
                      <p className="text-xs text-white/70 leading-relaxed font-sans">
                        {narrative.explanation}
                      </p>
                    </div>

                    {/* Raw State / Telemetry Inspector */}
                    <div className="narrator-payload-grid">
                      <div className="payload-item">
                        <span className="payload-key">EVENT ID</span>
                        <span className="payload-val font-mono">#{evt._id || '00'}</span>
                      </div>
                      <div className="payload-item">
                        <span className="payload-key">TIMESTAMP EPOCH</span>
                        <span className="payload-val font-mono">{evt._received || Date.now()}</span>
                      </div>
                      <div className="payload-item">
                        <span className="payload-key">PROTOCOL ADAPTER</span>
                        <span className="payload-val font-mono text-cyan-300">
                          {evt.tag?.includes('MQTT') ? 'MQTT 3.1.1' : evt.tag?.includes('WS') ? 'WebSocket 1.0' : 'HTTP/1.1 REST'}
                        </span>
                      </div>
                      <div className="payload-item">
                        <span className="payload-key">MITIGATION STATE</span>
                        <span className="payload-val font-mono text-emerald-400">ENFORCED</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
