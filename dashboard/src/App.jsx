import React, { useState, useCallback } from 'react'
import { AnimatePresence, motion, MotionConfig } from 'framer-motion'
import { useGhostNet } from './useGhostNet.js'
import Header from './components/Header.jsx'
import Sidebar from './components/Sidebar.jsx'
import StatsCards from './components/StatsCards.jsx'
import NetworkMapView from './components/NetworkMapView.jsx'
import DeviceStatusDonut from './components/DeviceStatusDonut.jsx'
import RecentEvents from './components/RecentEvents.jsx'
import RightPanel from './components/RightPanel.jsx'
import NodeCard, { NodeCardSkeleton } from './components/NodeCard.jsx'
import EventLog from './components/EventLog.jsx'
import NetworkCommsView from './components/NetworkCommsView.jsx'
import PipelineGraph from './components/PipelineGraph.jsx'
import NodeDetailDrawer from './components/NodeDetailDrawer.jsx'
import ThreatAnalysisPanel, { MLGauge } from './components/ThreatAnalysisPanel.jsx'
import RouterPanel from './components/RouterPanel.jsx'
import { initTheme, cycleTheme, applyTheme, THEMES } from './utils/theme.js'
import { Shield } from 'lucide-react'
import SettingsPanel from './components/SettingsPanel.jsx'
import { getApiUrl } from './apiConfig.js'
import { viewTransition } from './motion.js'

function OverviewView({ nodes, statusFilter, onFilter, selectedNode, onSelectNode, onNavigate, events, scoreHistory, osiSummary, onRelease }) {
  return (
    <div className="overview-dashboard">
      <div className="overview-main">
        <StatsCards nodes={nodes} activeFilter={statusFilter} onFilter={onFilter} />

        <div className="overview-map-row">
          <div className="panel overview-map-panel">
            <div className="panel-header">
              <div className="panel-title">
                <div className="panel-title-icon">🗺</div>
                Network Map
              </div>
              <div className="panel-live-dot">
                <span className="live-pulse-dot" />
                Live
              </div>
            </div>
            <div className="overview-map-body">
              <NetworkMapView
                nodes={nodes}
                onSelectNode={onSelectNode}
                selectedNodeId={selectedNode?.node_id}
              />
            </div>
          </div>

          <div className="overview-center-col">
            <div className="panel">
              <div className="panel-header">
                <div className="panel-title">Device Status</div>
              </div>
              <div className="panel-body">
                <DeviceStatusDonut nodes={nodes} />
              </div>
            </div>
            <div className="panel overview-events-panel">
              <div className="panel-header">
                <div className="panel-title">
                  <div className="panel-title-icon">📋</div>
                  Recent Events
                </div>
                <button className="view-all-btn" onClick={() => onNavigate('events')}>View All →</button>
              </div>
              <div className="overview-events-body">
                <RecentEvents events={events} onViewAll={() => onNavigate('events')} />
              </div>
            </div>
          </div>
        </div>

        <div className="panel overview-comms-panel">
          <div className="panel-header">
            <div className="panel-title">
              <div className="panel-title-icon">📡</div>
              Communication Flow
            </div>
          </div>
          <div className="overview-comms-body">
            <NetworkCommsView
              nodes={nodes}
              osiSummary={osiSummary}
              onSelectNode={onSelectNode}
              selectedNodeId={selectedNode?.node_id}
              compact
            />
          </div>
        </div>

        <div className="overview-bottom-row">
          <div className="panel overview-threat-panel">
            <div className="panel-header">
              <div className="panel-title">
                <div className="panel-title-icon">⚠</div>
                Threat Analysis
              </div>
            </div>
            <div className="panel-body">
              <ThreatAnalysisPanel
                nodes={nodes}
                events={events}
                scoreHistory={scoreHistory}
                compact
              />
            </div>
          </div>

          <div className="panel overview-ml-panel">
            <div className="panel-header">
              <div className="panel-title">ML Analysis</div>
            </div>
            <div className="panel-body">
              <MLGauge nodes={nodes} />
            </div>
          </div>

          <div className="panel overview-router-panel">
            <div className="panel-header">
              <div className="panel-title">Router View</div>
            </div>
            <div className="panel-body" style={{ padding: 0 }}>
              <RouterPanel nodes={nodes} />
            </div>
          </div>
        </div>
      </div>

      <div className="overview-right">
        <RightPanel
          nodes={nodes}
          selectedNode={selectedNode}
          onSelectNode={onSelectNode}
          onRelease={onRelease}
          events={events}
        />
      </div>
    </div>
  )
}

function DevicesView({ nodes, statusFilter, wsStatus, onFilter, onRelease, onSelect, scoreHistory }) {
  const ORDER = { QUARANTINED: 0, SUSPICIOUS: 1, OFFLINE: 2, HEALTHY: 3 }
  const sorted = Object.values(nodes).sort((a, b) => (ORDER[a.status] ?? 9) - (ORDER[b.status] ?? 9))
  const nodeList = statusFilter ? sorted.filter(n => n.status === statusFilter) : sorted
  const isLoading = wsStatus === 'connecting' && Object.keys(nodes).length === 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)', flex: 1, overflow: 'hidden' }}>
      <StatsCards nodes={nodes} activeFilter={statusFilter} onFilter={onFilter} />
      {statusFilter && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
            Filtering: <strong>{statusFilter}</strong> ({nodeList.length} nodes)
          </span>
          <button onClick={() => onFilter(null)} style={{ fontSize: 'var(--text-xs)', color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}>
            ✕ Clear
          </button>
        </div>
      )}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {isLoading ? (
          <div className="nodes-grid">{[1, 2, 3].map(i => <NodeCardSkeleton key={i} />)}</div>
        ) : nodeList.length === 0 ? (
          <div className="glass-empty-state">
            <Shield size={36} style={{ opacity: 0.2 }} />
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>No nodes detected</div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Start fake_node.py to see data</div>
          </div>
        ) : (
          <div className="nodes-grid">
            {nodeList.map(node => (
              <NodeCard key={node.node_id} node={node}
                onRelease={onRelease}
                onSelect={onSelect}
                history={scoreHistory[node.node_id]}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ThreatView({ nodes, events, scoreHistory }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 240px', gap: 'var(--sp-4)', flex: 1, overflow: 'hidden' }}>
      <div className="panel" style={{ overflow: 'hidden' }}>
        <div className="panel-header">
          <div className="panel-title">Threat Analysis</div>
        </div>
        <div className="panel-body">
          <ThreatAnalysisPanel
            nodes={nodes}
            events={events}
            scoreHistory={scoreHistory}
          />
        </div>
      </div>
      <div className="panel" style={{ overflow: 'hidden' }}>
        <div className="panel-header">
          <div className="panel-title">Router View</div>
        </div>
        <div className="panel-body" style={{ padding: 0 }}>
          <RouterPanel nodes={nodes} />
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const { nodes, events, wsStatus, releaseNode, scoreHistory, osiSummary } = useGhostNet()

  const [theme, setTheme] = useState(initTheme)
  const [currentView, setCurrentView] = useState('overview')
  const [selectedNode, setSelectedNode] = useState(null)
  const [statusFilter, setStatusFilter] = useState(null)
  const [eventsCleared, setEventsCleared] = useState(false)

  const displayEvents = eventsCleared ? [] : events
  const handleClear = useCallback(() => { setEventsCleared(true); setTimeout(() => setEventsCleared(false), 100) }, [])

  const toggleTheme = useCallback(() => {
    setTheme(prev => cycleTheme(prev))
  }, [])

  const setThemeDirect = useCallback((name) => {
    if (!THEMES.includes(name)) return
    localStorage.setItem('gn-theme', name)
    applyTheme(name)
    setTheme(name)
  }, [])

  const handleFilterStatus = useCallback(s => setStatusFilter(prev => prev === s ? null : s), [])

  const ORDER = { QUARANTINED: 0, SUSPICIOUS: 1, OFFLINE: 2, HEALTHY: 3 }
  const allNodes = Object.values(nodes).sort((a, b) => (ORDER[a.status] ?? 9) - (ORDER[b.status] ?? 9))
  const apiConfigured = Boolean(getApiUrl())

  const currentSelectedNode = selectedNode
    ? (nodes[selectedNode.node_id] ?? selectedNode)
    : null

  return (
    <MotionConfig reducedMotion={import.meta.env.PROD ? 'user' : 'never'}>
      <div className="app-root">
      <Header
        wsStatus={wsStatus}
        nodeCount={allNodes.length}
        eventCount={events.length}
        theme={theme}
        onThemeToggle={toggleTheme}
      />

      <div className="app-layout">
        <Sidebar
          currentView={currentView}
          onViewChange={setCurrentView}
          nodes={nodes}
          eventCount={events.length}
        />

        <main className="app-main">
          {!apiConfigured && (
            <div className="api-missing-banner">
              No Railway API URL yet. Open Settings, paste your public Railway domain, then Save and reconnect.
            </div>
          )}
          <div className="main-scroll">
            <AnimatePresence mode="wait">
              {currentView === 'overview' && (
                <motion.div key="overview" {...viewTransition} style={{ display:'contents' }}>
                  <OverviewView
                    nodes={nodes}
                    statusFilter={statusFilter}
                    onFilter={handleFilterStatus}
                    selectedNode={currentSelectedNode}
                    onSelectNode={setSelectedNode}
                    onNavigate={setCurrentView}
                    events={displayEvents}
                    scoreHistory={scoreHistory}
                    osiSummary={osiSummary}
                    onRelease={releaseNode}
                  />
                </motion.div>
              )}
              {currentView === 'devices' && (
                <motion.div key="devices" {...viewTransition} style={{ display:'contents' }}>
                  <DevicesView
                    nodes={nodes}
                    statusFilter={statusFilter}
                    onFilter={handleFilterStatus}
                    wsStatus={wsStatus}
                    onRelease={releaseNode}
                    onSelect={setSelectedNode}
                    scoreHistory={scoreHistory}
                  />
                </motion.div>
              )}
              {currentView === 'threats' && (
                <motion.div key="threats" {...viewTransition} style={{ display:'contents' }}>
                  <ThreatView
                    nodes={nodes}
                    events={displayEvents}
                    scoreHistory={scoreHistory}
                  />
                </motion.div>
              )}
              {currentView === 'comms' && (
                <motion.div key="comms" {...viewTransition} style={{ flex: 1, minHeight: 0 }}>
                  <NetworkCommsView
                    nodes={nodes}
                    osiSummary={osiSummary}
                    onSelectNode={setSelectedNode}
                    selectedNodeId={currentSelectedNode?.node_id}
                  />
                </motion.div>
              )}
              {currentView === 'network' && (
                <motion.div key="network" {...viewTransition} className="panel" style={{ flex: 1, overflow: 'hidden' }}>
                  <div className="panel-header">
                    <div className="panel-title">Network Map</div>
                    <div className="panel-live-dot">
                      <span className="live-pulse-dot" />
                      Live
                    </div>
                  </div>
                  <div style={{ flex: 1, overflow: 'hidden', minHeight: 400 }}>
                    <NetworkMapView
                      nodes={nodes}
                      onSelectNode={setSelectedNode}
                      selectedNodeId={currentSelectedNode?.node_id}
                    />
                  </div>
                </motion.div>
              )}
              {currentView === 'healing' && (
                <motion.div key="healing" {...viewTransition} style={{ flex: 1, overflow: 'hidden' }}>
                  <PipelineGraph nodes={nodes} onSelectNode={setSelectedNode} />
                </motion.div>
              )}
              {currentView === 'events' && (
                <motion.div key="events" {...viewTransition} className="panel" style={{ flex: 1, overflow: 'hidden' }}>
                  <EventLog events={displayEvents} onClear={handleClear} wsStatus={wsStatus} />
                </motion.div>
              )}
              {currentView === 'settings' && (
                <motion.div key="settings" {...viewTransition} className="panel" style={{ flex: 1, overflow: 'auto' }}>
                  <div className="panel-header"><div className="panel-title">Settings</div></div>
                  <div className="panel-body">
                    <SettingsPanel
                      theme={theme}
                      themes={THEMES}
                      onThemeDirect={setThemeDirect}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </main>
      </div>

      <AnimatePresence>
        {currentSelectedNode && (
          <NodeDetailDrawer
            key={currentSelectedNode.node_id}
            node={currentSelectedNode}
            history={scoreHistory[currentSelectedNode.node_id]}
            events={displayEvents}
            onClose={() => setSelectedNode(null)}
            onRelease={releaseNode}
          />
        )}
      </AnimatePresence>
    </div>
    </MotionConfig>
  )
}
