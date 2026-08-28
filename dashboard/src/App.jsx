// App.jsx — root layout with score history wired to NodeCard
import { useState, useCallback } from 'react'
import { useGhostNet } from './useGhostNet.js'
import Header    from './components/Header.jsx'
import Sidebar   from './components/Sidebar.jsx'
import StatsBar  from './components/StatsBar.jsx'
import NodeCard  from './components/NodeCard.jsx'
import EventLog  from './components/EventLog.jsx'
import ThreatRadar from './components/ThreatRadar.jsx'

export default function App() {
  const { nodes, events, wsStatus, releaseNode, scoreHistory } = useGhostNet()
  const [cleared, setCleared] = useState(false)

  const displayEvents = cleared ? [] : events

  const handleClear = useCallback(() => {
    setCleared(true)
    setTimeout(() => setCleared(false), 100)
  }, [])

  const nodeList = Object.values(nodes)
  const ORDER = { QUARANTINED: 0, SUSPICIOUS: 1, OFFLINE: 2, HEALTHY: 3 }
  nodeList.sort((a, b) => (ORDER[a.status] ?? 9) - (ORDER[b.status] ?? 9))

  return (
    <div className="app">
      <Header wsStatus={wsStatus} />
      <Sidebar nodes={nodes} />

      <div className="main">
        <StatsBar nodes={nodes} />

        <div className="main-content">
          {/* Centre: node cards + threat radar */}
          <div className="center-panel">
            {/* Threat radar — shown when nodes exist */}
            {nodeList.length > 0 && <ThreatRadar nodes={nodes} />}

            <div className="section-heading">
              <h2>Node Monitor</h2>
              <span className="count-badge">{nodeList.length} node{nodeList.length !== 1 ? 's' : ''}</span>
            </div>

            {nodeList.length === 0 ? (
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
            ) : (
              <div className="nodes-grid">
                {nodeList.map(node => (
                  <NodeCard
                    key={node.node_id}
                    node={node}
                    onRelease={releaseNode}
                    history={scoreHistory[node.node_id]}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Right: live event log */}
          <EventLog events={displayEvents} onClear={handleClear} />
        </div>
      </div>
    </div>
  )
}
