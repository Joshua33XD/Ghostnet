import React, { useState, useCallback, useEffect, useRef } from 'react'
import { useGhostNet } from './useGhostNet.js'
import Header from './components/Header.jsx'
import Sidebar from './components/Sidebar.jsx'
import StatsBar from './components/StatsBar.jsx'
import PipelineGraph from './components/PipelineGraph.jsx'
import DeepTelemetryNarrator from './components/DeepTelemetryNarrator.jsx'
import FeatureRadar from './components/FeatureRadar.jsx'
import AttackControlBar from './components/AttackControlBar.jsx'
import NodeCard, { NodeCardSkeleton } from './components/NodeCard.jsx'
import EventLog from './components/EventLog.jsx'
import ThreatRadar from './components/ThreatRadar.jsx'
import NodeDetailDrawer from './components/NodeDetailDrawer.jsx'
import { Layers, Activity, Terminal, Shield, Cpu } from 'lucide-react'

export default function App() {
  const { nodes, events, wsStatus, releaseNode, scoreHistory, osiSummary } = useGhostNet()

  // ── Priority Order: 'pipeline' (Default) | 'narrator' | 'matrix' | 'feature-radar'
  const [currentView, setCurrentView] = useState('pipeline')

  // ── Drawer state ────────────────────────────────────────────
  const [selectedNode, setSelectedNode] = useState(null)

  // ── Status filter (from StatsBar clicks) ────────────────────
  const [statusFilter, setStatusFilter] = useState(null)

  // ── Event log clear ─────────────────────────────────────────
  const [cleared, setCleared] = useState(false)
  const displayEvents = cleared ? [] : events
  const handleClear = useCallback(() => {
    setCleared(true)
    setTimeout(() => setCleared(false), 100)
  }, [])

  // ── Trend snapshot — every 60s, stable via nodesRef ─────────
  const nodesRef = useRef(nodes)
  const [snapshots, setSnapshots] = useState([])
  useEffect(() => { nodesRef.current = nodes }, [nodes])
  useEffect(() => {
    const snap = () => {
      const list = Object.values(nodesRef.current)
      const counts = {
        total: list.length,
        healthy: list.filter(n => n.status === 'HEALTHY').length,
        suspicious: list.filter(n => n.status === 'SUSPICIOUS').length,
        quarantined: list.filter(n => n.status === 'QUARANTINED').length,
        offline: list.filter(n => n.status === 'OFFLINE').length,
      }
      setSnapshots(prev => [...prev, counts].slice(-10))
    }
    const t = setInterval(snap, 60000)
    return () => clearInterval(t)
  }, [])

  const prevCounts = snapshots.length >= 2 ? snapshots[snapshots.length - 2] : null

  // ── Callbacks ────────────────────────────────────────────────
  const handleFilterStatus = useCallback((status) => {
    setStatusFilter(prev => prev === status ? null : status)
  }, [])

  const currentSelectedNode = selectedNode
    ? (nodes[selectedNode.node_id] ?? selectedNode)
    : null

  // ── Node list with sort + optional status filter ─────────────
  const ORDER = { QUARANTINED: 0, SUSPICIOUS: 1, OFFLINE: 2, HEALTHY: 3 }
  const allNodes = Object.values(nodes).sort((a, b) => (ORDER[a.status] ?? 9) - (ORDER[b.status] ?? 9))
  const nodeList = statusFilter ? allNodes.filter(n => n.status === statusFilter) : allNodes

  const isLoading = wsStatus === 'connecting' && allNodes.length === 0

  return (
    <div className="futuristic-app-root">
      {/* Dynamic ambient cyber glow backdrop */}
      <div className="ambient-background-glow" />

      {/* Top Floating Glass Header */}
      <Header
        wsStatus={wsStatus}
        currentView={currentView}
        onViewChange={setCurrentView}
        eventCount={events.length}
        nodeCount={allNodes.length}
      />

      {/* App Body Grid Layout */}
      <div className="futuristic-layout">
        {/* Left Glass Sidebar */}
        <Sidebar
          nodes={nodes}
          selectedNodeId={currentSelectedNode?.node_id}
          onSelectNode={setSelectedNode}
        />

        {/* Central Dynamic Workspace */}
        <main className="futuristic-main-stage">
          {/* Top Persistent Telemetry Summary Counters */}
          <StatsBar
            nodes={nodes}
            prevCounts={prevCounts}
            activeFilter={statusFilter}
            onFilterStatus={handleFilterStatus}
          />

          {/* Quick Attack Simulator Injector Bar */}
          <AttackControlBar />

          {/* View Container based on prioritized active tab */}
          <div className="view-content-wrapper">
            {/* 1. PRIORITY ONE: Distributed Pipeline Architecture Diagram & Node Matrix */}
            {currentView === 'pipeline' && (
              <div className="view-pane">
                <PipelineGraph
                  nodes={nodes}
                  osiSummary={osiSummary}
                  onSelectNode={setSelectedNode}
                />
              </div>
            )}

            {/* 2. PRIORITY TWO: Transparent Telemetry Feed & Deep Event Narrator */}
            {currentView === 'narrator' && (
              <div className="view-pane">
                <DeepTelemetryNarrator
                  events={displayEvents}
                  nodes={nodes}
                  onClear={handleClear}
                  wsStatus={wsStatus}
                />
              </div>
            )}

            {/* 3. PRIORITY THREE: Node Matrix Grid & Live Multi-Node Cluster */}
            {currentView === 'matrix' && (
              <div className="view-pane flex flex-col gap-4">
                <ThreatRadar nodes={nodes} wsStatus={wsStatus} />

                <div className="glass-section-box">
                  <div className="section-header-row">
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-cyan-400" />
                      <span className="font-mono font-bold text-xs tracking-wider text-white">
                        CLUSTER NODES TELEMETRY ({nodeList.length})
                      </span>
                    </div>
                    {statusFilter && (
                      <button
                        onClick={() => setStatusFilter(null)}
                        className="text-[10px] font-mono text-cyan-400 hover:underline"
                      >
                        ✕ CLEAR FILTER [{statusFilter}]
                      </button>
                    )}
                  </div>

                  {isLoading ? (
                    <div className="nodes-grid">
                      {[1, 2, 3].map(i => <NodeCardSkeleton key={i} />)}
                    </div>
                  ) : nodeList.length === 0 ? (
                    <div className="glass-empty-state">
                      <Shield className="w-10 h-10 text-white/20 mb-2" />
                      <div className="font-mono text-xs text-white/60">No nodes currently detected.</div>
                      <div className="text-[11px] text-white/40 mt-1">Start fake_node.py to see real-time detection.</div>
                    </div>
                  ) : (
                    <div className="nodes-grid">
                      {nodeList.map(node => (
                        <NodeCard
                          key={node.node_id}
                          node={node}
                          onRelease={releaseNode}
                          onSelect={setSelectedNode}
                          history={scoreHistory[node.node_id]}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 4. Real Multi-Axis Feature Vector Radar Chart */}
            {currentView === 'feature-radar' && (
              <div className="view-pane flex flex-col gap-4">
                <FeatureRadar
                  nodes={nodes}
                  selectedNodeId={currentSelectedNode?.node_id}
                />

                <div className="nodes-grid">
                  {nodeList.map(node => (
                    <NodeCard
                      key={node.node_id}
                      node={node}
                      onRelease={releaseNode}
                      onSelect={setSelectedNode}
                      history={scoreHistory[node.node_id]}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </main>

        {/* Right Glass Live Stream (Persistent Cyber Terminal) */}
        <aside className="futuristic-right-stream">
          <EventLog events={displayEvents} onClear={handleClear} wsStatus={wsStatus} />
        </aside>
      </div>

      {/* Node Detail Inspector Drawer */}
      {currentSelectedNode && (
        <NodeDetailDrawer
          node={currentSelectedNode}
          history={scoreHistory[currentSelectedNode.node_id]}
          events={displayEvents}
          onClose={() => setSelectedNode(null)}
          onRelease={releaseNode}
        />
      )}
    </div>
  )
}
