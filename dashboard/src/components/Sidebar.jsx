// Sidebar — node list with live status dots
import { getStatusIcon } from '../utils.js'

export default function Sidebar({ nodes }) {
  const list = Object.values(nodes)

  // Sort: quarantined → suspicious → offline → healthy
  const ORDER = { QUARANTINED: 0, SUSPICIOUS: 1, OFFLINE: 2, HEALTHY: 3 }
  list.sort((a, b) => (ORDER[a.status] ?? 9) - (ORDER[b.status] ?? 9))

  return (
    <nav className="sidebar">
      <div className="sidebar-section-label">Nodes ({list.length})</div>

      {list.length === 0 && (
        <div style={{ padding: '20px 8px', fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
          No nodes yet.<br />Start the simulator to see nodes appear here.
        </div>
      )}

      {list.map(node => (
        <div key={node.node_id} className="sidebar-node-item">
          <div className={`sidebar-status-dot ${node.status}`} />
          <span className="sidebar-node-name">{node.node_id}</span>
          <span className="sidebar-node-score">{node.anomaly_score.toFixed(2)}</span>
        </div>
      ))}
    </nav>
  )
}
