// App.jsx — root layout with drawer, status filter, trend snapshots and skeletons
import { useState, useCallback, useEffect, useRef } from 'react'
import { useGhostNet } from './useGhostNet.js'
import Header        from './components/Header.jsx'
import Sidebar        from './components/Sidebar.jsx'
import StatsBar       from './components/StatsBar.jsx'
import NodeCard, { NodeCardSkeleton } from './components/NodeCard.jsx'
import EventLog       from './components/EventLog.jsx'
import ThreatRadar    from './components/ThreatRadar.jsx'
import NodeDetailDrawer from './components/NodeDetailDrawer.jsx'

export default function App() {
  const { nodes, events, wsStatus, releaseNode, scoreHistory } = useGhostNet()

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
  const nodesRef   = useRef(nodes)
  const [snapshots, setSnapshots] = useState([])
  useEffect(() => { nodesRef.current = nodes }, [nodes])
  useEffect(() => {
    const snap = () => {
      const list   = Object.values(nodesRef.current)
      const counts = {
        total:       list.length,
        healthy:     list.filter(n => n.status === 'HEALTHY').length,
        suspicious:  list.filter(n => n.status === 'SUSPICIOUS').length,
        quarantined: list.filter(n => n.status === 'QUARANTINED').length,
        offline:     list.filter(n => n.status === 'OFFLINE').length,
      }
      setSnapshots(prev => [...prev, counts].slice(-10))
    }
    const t = setInterval(snap, 60000)
    return () => clearInterval(t)
  }, []) // runs once; reads nodes via ref

  // prevCounts = second-to-last snapshot → shows 1-min delta
  const prevCounts = snapshots.length >= 2 ? snapshots[snapshots.length - 2] : null

  // ── Callbacks ────────────────────────────────────────────────
  const handleFilterStatus = useCallback((status) => {
    setStatusFilter(prev => prev === status ? null : status)
  }, [])

  // Keep drawer in sync with latest live data
  const currentSelectedNode = selectedNode
    ? (nodes[selectedNode.node_id] ?? selectedNode)
    : null

  // ── Node list with sort + optional status filter ─────────────
  const ORDER    = { QUARANTINED: 0, SUSPICIOUS: 1, OFFLINE: 2, HEALTHY: 3 }
  const allNodes = Object.values(nodes).sort((a, b) => (ORDER[a.status] ?? 9) - (ORDER[b.status] ?? 9))
  const nodeList = statusFilter ? allNodes.filter(n => n.status === statusFilter) : allNodes

  const isLoading = wsStatus === 'connecting' && allNodes.length === 0

  return (
    <div className="app">
      <Header wsStatus={wsStatus} />

      <Sidebar
        nodes={nodes}
        selectedNodeId={currentSelectedNode?.node_id}
        onSelectNode={setSelectedNode}
      />

      <div className="main">
        <StatsBar
          nodes={nodes}
          prevCounts={prevCounts}
          activeFilter={statusFilter}
          onFilterStatus={handleFilterStatus}
        />

        <div className="main-content">
          {/* Centre: threat radar + node cards */}
          <div className="center-panel">
            <ThreatRadar nodes={nodes} wsStatus={wsStatus} />

            <div className="section-heading">
              <h2>{statusFilter ? `${statusFilter} Nodes` : 'Node Monitor'}</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {statusFilter && (
                  <button
                    onClick={() => setStatusFilter(null)}
                    style={{
                      fontSize: 9, padding: '2px 7px', borderRadius: 10,
                      background: 'transparent', border: '1px solid var(--border)',
                      color: 'var(--text-muted)', cursor: 'pointer',
                    }}
                  >
                    ✕ clear
                  </button>
                )}
                <span className="count-badge">
                  {nodeList.length} node{nodeList.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>

            {/* Loading skeleton */}
            {isLoading && (
              <div className="nodes-grid">
                {[1, 2, 3].map(i => <NodeCardSkeleton key={i} />)}
              </div>
            )}

            {/* Filtered-empty state (filter active but nothing matches) */}
            {!isLoading && nodeList.length === 0 && allNodes.length > 0 && (
              <div className="empty-state">
                <div className="empty-icon" style={{ fontSize: 36, opacity: 0.3 }}>◉</div>
                <h3>No {statusFilter} nodes</h3>
                <p>
                  No nodes currently have this status.{' '}
                  <button
                    onClick={() => setStatusFilter(null)}
                    style={{ background: 'none', border: 'none', color: 'var(--cyan)', cursor: 'pointer', fontSize: 12, padding: 0 }}
                  >
                    Clear filter
                  </button>
                </p>
              </div>
            )}

            {/* True empty — no nodes at all */}
            {!isLoading && allNodes.length === 0 && (
              <div className="empty-state">
                <div className="empty-icon" style={{ fontSize: 48, opacity: 0.3 }}>◉</div>
                <h3>No nodes detected</h3>
                <p>
                  Start GhostNet and run the simulator to begin monitoring.<br /><br />
                  <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--cyan)' }}>
                    python engine.py
                  </code>
                  <br />
                  <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--cyan)' }}>
                    python -m ghostnet.simulator.fake_node --connection http --mode normal
                  </code>
                </p>
              </div>
            )}

            {/* Node cards */}
            {!isLoading && nodeList.length > 0 && (
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

          {/* Right: live event log */}
          <EventLog events={displayEvents} onClear={handleClear} wsStatus={wsStatus} />
        </div>
      </div>

      {/* Node detail drawer */}
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

