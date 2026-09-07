import React, { useState, useCallback } from 'react'
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
  const nodeList = statusFilter ? allNodes.filter(n => n.status === statusFilter) : allNodes
  const isLoading = wsStatus === 'connecting' && allNodes.length === 0

  const currentSelectedNode = selectedNode
    ? (nodes[selectedNode.node_id] ?? selectedNode)
    : null

  const OverviewView = () => (
    <div className="overview-dashboard">
      <div className="overview-main">
        <StatsCards nodes={nodes} activeFilter={statusFilter} onFilter={handleFilterStatus} />

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
                onSelectNode={setSelectedNode}
                selectedNodeId={currentSelectedNode?.node_id}
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
                <button className="view-all-btn" onClick={() => setCurrentView('events')}>View All →</button>
              </div>
              <div className="overview-events-body">
                <RecentEvents events={displayEvents} onViewAll={() => setCurrentView('events')} />
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
              onSelectNode={setSelectedNode}
              selectedNodeId={currentSelectedNode?.node_id}
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
                events={displayEvents}
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
          selectedNode={currentSelectedNode}
          onSelectNode={setSelectedNode}
          onRelease={releaseNode}
          events={displayEvents}
        />
      </div>
    </div>
  )

  const DevicesView = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)', flex: 1, overflow: 'hidden' }}>
      <StatsCards nodes={nodes} activeFilter={statusFilter} onFilter={handleFilterStatus} />
      {statusFilter && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
            Filtering: <strong>{statusFilter}</strong> ({nodeList.length} nodes)
          </span>
          <button onClick={() => setStatusFilter(null)} style={{ fontSize: 'var(--text-xs)', color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}>
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
                onRelease={releaseNode}
                onSelect={setSelectedNode}
                history={scoreHistory[node.node_id]}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )

  const ThreatView = () => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 240px', gap: 'var(--sp-4)', flex: 1, overflow: 'hidden' }}>
      <div className="panel" style={{ overflow: 'hidden' }}>
        <div className="panel-header">
          <div className="panel-title">Threat Analysis</div>
        </div>
        <div className="panel-body">
          <ThreatAnalysisPanel
            nodes={nodes}
            events={displayEvents}
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

  return (
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
          <div className="main-scroll">
            {currentView === 'overview' && <OverviewView />}
            {currentView === 'devices' && <DevicesView />}
            {currentView === 'threats' && <ThreatView />}
            {currentView === 'comms' && (
              <div style={{ flex: 1, minHeight: 0 }}>
                <NetworkCommsView
                  nodes={nodes}
                  osiSummary={osiSummary}
                  onSelectNode={setSelectedNode}
                  selectedNodeId={currentSelectedNode?.node_id}
                />
              </div>
            )}
            {currentView === 'network' && (
              <div className="panel" style={{ flex: 1, overflow: 'hidden' }}>
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
              </div>
            )}
            {currentView === 'healing' && (
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <PipelineGraph nodes={nodes} onSelectNode={setSelectedNode} />
              </div>
            )}
            {currentView === 'events' && (
              <div className="panel" style={{ flex: 1, overflow: 'hidden' }}>
                <EventLog events={displayEvents} onClear={handleClear} wsStatus={wsStatus} />
              </div>
            )}
            {currentView === 'settings' && (
              <div className="panel">
                <div className="panel-header"><div className="panel-title">Settings</div></div>
                <div className="panel-body">
                  <div style={{ padding: 'var(--sp-4) 0' }}>
                    <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>Appearance</div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 'var(--sp-4)' }}>
                      Choose your dashboard theme
                    </div>
                    <div className="theme-picker">
                      {THEMES.map(t => (
                        <button
                          key={t}
                          className={`theme-picker-btn${theme === t ? ' active' : ''}`}
                          onClick={() => setThemeDirect(t)}
                        >
                          <span className={`theme-picker-swatch theme-picker-swatch--${t}`} />
                          {t.charAt(0).toUpperCase() + t.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

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
