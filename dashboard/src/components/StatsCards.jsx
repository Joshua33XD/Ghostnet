// StatsCards — animated KPI cards with count-up + staggered entrance
import { useEffect, useRef, useState } from 'react'
import { motion, useInView } from 'framer-motion'
import { Monitor, ShieldCheck, AlertTriangle, ShieldX } from 'lucide-react'
import { getTrustScore } from '../utils.js'
import { stagger, fadeUp, SPRING } from '../motion.js'

function AnimatedNumber({ value, duration = 0.8 }) {
  const [display, setDisplay] = useState(0)
  const ref = useRef(null)
  const inView = useInView(ref, { once: true })
  const prevRef = useRef(0)

  useEffect(() => {
    if (!inView) return
    const from = prevRef.current
    const to = value
    if (from === to) { setDisplay(to); return }
    const start = performance.now()
    const tick = (now) => {
      const elapsed = (now - start) / (duration * 1000)
      const t = Math.min(elapsed, 1)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(Math.round(from + (to - from) * eased))
      if (t < 1) requestAnimationFrame(tick)
      else prevRef.current = to
    }
    requestAnimationFrame(tick)
  }, [value, inView, duration])

  return <span ref={ref}>{display}</span>
}

export default function StatsCards({ nodes, activeFilter, onFilter }) {
  const list = Object.values(nodes)
  const total       = list.length
  const healthy     = list.filter(n => n.status === 'HEALTHY').length
  const suspicious  = list.filter(n => n.status === 'SUSPICIOUS').length
  const quarantined = list.filter(n => n.status === 'QUARANTINED').length

  const pct = (n) => total ? Math.round(n / total * 100) : 0

  const cards = [
    {
      label: 'Total Devices',
      value: total,
      sub: `${healthy} Online · ${total - healthy} Other`,
      icon: Monitor,
      iconClass: 'blue',
      filter: null,
      barColor: 'var(--accent)',
      barPct: 100,
    },
    {
      label: 'Trusted',
      value: healthy,
      sub: `${pct(healthy)}% of network`,
      icon: ShieldCheck,
      iconClass: 'green',
      filter: 'HEALTHY',
      barColor: 'var(--status-healthy)',
      barPct: pct(healthy),
    },
    {
      label: 'Suspicious',
      value: suspicious,
      sub: `${pct(suspicious)}% of network`,
      icon: AlertTriangle,
      iconClass: 'amber',
      filter: 'SUSPICIOUS',
      barColor: 'var(--status-warn)',
      barPct: pct(suspicious),
    },
    {
      label: 'Quarantined',
      value: quarantined,
      sub: `${pct(quarantined)}% isolated`,
      icon: ShieldX,
      iconClass: 'red',
      filter: 'QUARANTINED',
      barColor: 'var(--status-danger)',
      barPct: pct(quarantined),
    },
  ]

  return (
    <motion.div
      className="stat-cards-row"
      variants={stagger(0.08)}
      initial="hidden"
      animate="visible"
    >
      {cards.map(c => {
        const Icon = c.icon
        const isActive = activeFilter === c.filter
        return (
          <motion.div
            key={c.label}
            className="stat-card"
            variants={fadeUp}
            whileHover={{ y: -2, transition: SPRING.snappy }}
            whileTap={{ scale: 0.98 }}
            onClick={() => c.filter && onFilter(c.filter)}
            style={isActive ? { borderColor: 'var(--accent)', background: 'var(--accent-bg)' } : {}}
          >
            <div className={`stat-card-icon ${c.iconClass}`}>
              <Icon size={20} />
            </div>
            <div className="stat-card-body">
              <div className="stat-card-label">{c.label}</div>
              <div className="stat-card-value">
                <AnimatedNumber value={c.value} />
              </div>
              <div className="stat-card-sub">{c.sub}</div>
              <div className="stat-card-bar">
                <motion.div
                  className="stat-card-bar-fill"
                  initial={{ width: 0 }}
                  animate={{ width: `${c.barPct}%` }}
                  transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
                  style={{ background: c.barColor }}
                />
              </div>
            </div>
          </motion.div>
        )
      })}
    </motion.div>
  )
}
