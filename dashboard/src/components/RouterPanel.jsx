export default function RouterPanel({ nodes }) {
  const list = Object.values(nodes)
  if (list.length === 0) return (
    <div style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)', textAlign: 'center', padding: 12 }}>
      No routing data
    </div>
  )
  return (
    <div>
      <table className="route-table">
        <thead>
          <tr>
            <th>Destination</th>
            <th>Next Hop</th>
            <th>Interface</th>
          </tr>
        </thead>
        <tbody>
          {list.slice(0, 5).map(n => (
            <tr key={n.node_id}>
              <td>{n.ip_address ?? `10.0.0.${Math.abs(n.node_id.charCodeAt(0)) % 254}`}</td>
              <td>192.168.1.1</td>
              <td>{n.status === 'OFFLINE' ? 'WAN' : 'LAN'}</td>
            </tr>
          ))}
          <tr>
            <td>0.0.0.0/0</td>
            <td>192.168.1.1</td>
            <td>WAN</td>
          </tr>
        </tbody>
      </table>
      <div style={{ marginTop: 8, fontSize: 'var(--text-xs)', color: 'var(--text-muted)', padding: '0 var(--sp-3)' }}>
        Recent Activity
      </div>
      {list.slice(0, 3).map(n => (
        <div key={n.node_id} style={{
          fontSize: 10, color: 'var(--text-secondary)',
          padding: '3px var(--sp-3)', fontFamily: 'var(--font-mono)'
        }}>
          · Lookup: routing table ({n.ip_address ?? '—'} → 63)
        </div>
      ))}
    </div>
  )
}
