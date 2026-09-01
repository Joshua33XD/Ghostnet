// Sidebar — node list with search filter and live status dots
import { useState } from 'react'
import { getStatusIcon } from '../utils.js'

export default function Sidebar({ nodes, selectedNodeId, onSelectNode }) {
  const [search, setSearch] = useState('')
  const list = Object.values(nodes)

  // Severity sort: quarantined → suspicious → offline → healthy
  const ORDER = { QUARANTINED: 0, SUSPICIOUS: 1, OFFLINE: 2, HEALTHY: 3 }
  list.sort((a, b) => (ORDER[a.status] ?? 9) - (ORDER[b.status] ?? 9))

  const q        = search.trim().toLowerCase()
  const filtered = q
    ? list.filter(n =>
        n.node_id.toLowerCase().includes(q) ||
        n.status.toLowerCase().includes(q)
      )
    : list

  return (
    <nav className="sidebar">
      <div className="sidebar-section-label">Nodes ({list.length})</div>

      {/* Search */}
      <div className="sidebar-search">
        <span className="sidebar-search-icon">⌕</span>
        <input
          id="sidebar-search"
          className="sidebar-search-input"
          type="text"
          placeholder="Search by name or status…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          aria-label="Filter nodes"
        />
      </div>

      {/* Empty — no nodes at all */}
      {list.length === 0 && (
        <div style={{ padding: '20px 8px', fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.6 }}>
          No nodes yet.<br />Start the simulator.
        </div>
      )}

      {/* Empty — search returned nothing */}
      {list.length > 0 && filtered.length === 0 && (
        <div style={{ padding: '12px 8px', fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
          No nodes match "{search}"
        </div>
      )}

      {filtered.map(node => (
        <div
          key={node.node_id}
          className={`sidebar-node-item${selectedNodeId === node.node_id ? ' active' : ''}`}
          onClick={() => onSelectNode?.(node)}
          role="button"
          tabIndex={0}
          onKeyDown={e => e.key === 'Enter' && onSelectNode?.(node)}
          aria-label={`${node.node_id} — ${node.status}`}
          aria-pressed={selectedNodeId === node.node_id}
        >
          <div
            className={`sidebar-status-dot ${node.status}`}
            aria-hidden="true"
            title={node.status}
          />
          <span className="sidebar-node-name">{node.node_id}</span>
          <span className="sidebar-node-score">{node.anomaly_score.toFixed(2)}</span>
        </div>
      ))}
    </nav>
  )
}
