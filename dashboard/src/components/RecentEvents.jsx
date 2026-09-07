// RecentEvents — compact inline event feed
import { Shield } from 'lucide-react'

const SEV = e => {
  const t = (e.event_type ?? e.tag ?? '').toUpperCase()
  if (['QUARANTINE','ATTACK','THREAT'].some(x => t.includes(x))) return 'critical'
  if (['SUSPICIOUS','WARN','ANOMALY'].some(x => t.includes(x))) return 'warning'
  if (['RECOVER','HEAL','CLEAR'].some(x => t.includes(x))) return 'success'
  return 'info'
}

const DOT_CLASS = { critical:'critical', warning:'warning', info:'info', success:'success' }

export default function RecentEvents({ events, onViewAll }) {
  const shown = events.slice(0, 6)
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      {shown.length === 0 ? (
        <div className="glass-empty-state" style={{ padding:16 }}>
          <Shield size={20} style={{ opacity:0.2 }} />
          <span style={{ fontSize:'var(--text-xs)' }}>No events yet</span>
        </div>
      ) : shown.map(evt => {
        const sev = SEV(evt)
        const time = evt.timestamp
          ? new Date(evt.timestamp * 1000).toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit', hour12:false })
          : '—'
        return (
          <div key={evt.id ?? evt.timestamp} className="event-row">
            <span className={`event-dot ${DOT_CLASS[sev]}`} />
            <span className="event-time">{time}</span>
            <span className="event-text">{evt.message ?? evt.msg ?? '—'}</span>
            {evt.node_id && <span className="event-node-tag">{evt.node_id.slice(-8)}</span>}
          </div>
        )
      })}
      {events.length > 6 && (
        <button className="view-all-btn" onClick={onViewAll}
          style={{ alignSelf:'center', marginTop:8, padding:'4px 12px' }}>
          View All ({events.length}) →
        </button>
      )}
    </div>
  )
}
