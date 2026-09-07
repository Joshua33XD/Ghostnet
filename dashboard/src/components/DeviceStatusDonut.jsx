// DeviceStatusDonut — Recharts PieChart matching reference
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

const COLORS = {
  Trusted:    'var(--status-healthy)',
  Suspicious: 'var(--status-warn)',
  Quarantined:'var(--status-danger)',
  Offline:    'var(--status-offline)',
}

export default function DeviceStatusDonut({ nodes }) {
  const list = Object.values(nodes)
  const total = list.length
  const healthy     = list.filter(n => n.status === 'HEALTHY').length
  const suspicious  = list.filter(n => n.status === 'SUSPICIOUS').length
  const quarantined = list.filter(n => n.status === 'QUARANTINED').length
  const offline     = list.filter(n => n.status === 'OFFLINE').length

  const pct = n => total ? Math.round(n / total * 100) : 0

  const data = [
    { name:'Trusted',     value: healthy,     pct: pct(healthy) },
    { name:'Suspicious',  value: suspicious,  pct: pct(suspicious) },
    { name:'Quarantined', value: quarantined, pct: pct(quarantined) },
    { name:'Offline',     value: offline,     pct: pct(offline) },
  ].filter(d => d.value > 0)

  if (total === 0) data.push({ name:'No data', value:1, pct:0 })

  return (
    <div style={{ display:'flex', gap:'var(--sp-4)', alignItems:'center', height:'100%' }}>
      <div style={{ width:120, height:120, flexShrink:0, position:'relative' }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" innerRadius={38} outerRadius={52}
              dataKey="value" startAngle={90} endAngle={-270} stroke="none">
              {data.map((entry, i) => (
                <Cell key={i} fill={COLORS[entry.name] ?? 'var(--border)'} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ background:'var(--surface-raised)', border:'1px solid var(--border)', borderRadius:6, fontSize:11 }}
              formatter={(v, name, props) => [`${props.payload.pct}% (${v})`, name]}
            />
          </PieChart>
        </ResponsiveContainer>
        {/* center label */}
        <div style={{
          position:'absolute', inset:0, display:'flex', flexDirection:'column',
          alignItems:'center', justifyContent:'center', pointerEvents:'none'
        }}>
          <span style={{ fontSize:22, fontWeight:700, fontFamily:'var(--font-mono)', color:'var(--text-primary)', lineHeight:1 }}>{total}</span>
          <span style={{ fontSize:8, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em' }}>Devices</span>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display:'flex', flexDirection:'column', gap:6, flex:1 }}>
        {[
          { label:'Trusted',    count:healthy,     color:'var(--status-healthy)' },
          { label:'Suspicious', count:suspicious,  color:'var(--status-warn)' },
          { label:'Quarantined',count:quarantined, color:'var(--status-danger)' },
          { label:'Offline',    count:offline,     color:'var(--status-offline)' },
        ].map(row => (
          <div key={row.label} style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ width:8, height:8, borderRadius:'50%', background:row.color, flexShrink:0 }} />
            <span style={{ fontSize:'var(--text-xs)', color:'var(--text-secondary)', flex:1 }}>{row.label}</span>
            <span style={{ fontSize:'var(--text-xs)', fontFamily:'var(--font-mono)', fontWeight:600, color:'var(--text-primary)' }}>{row.count}</span>
            <span style={{ fontSize:10, color:'var(--text-muted)', fontFamily:'var(--font-mono)', minWidth:28, textAlign:'right' }}>
              {pct(row.count)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
