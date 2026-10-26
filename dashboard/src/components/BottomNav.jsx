import { motion, useReducedMotion } from 'framer-motion'
import { AlertTriangle, Radio, Server } from 'lucide-react'

const ITEMS = [
  { id: 'overview', label: 'Floor', icon: Radio },
  { id: 'alerts', label: 'Alerts', icon: AlertTriangle },
  { id: 'devices', label: 'Hosts', icon: Server },
]

export default function BottomNav({ currentView, onViewChange }) {
  const reduced = useReducedMotion()

  return (
    <nav className="wf-dock" aria-label="Mobile views">
      {ITEMS.map(item => {
        const Icon = item.icon
        const on = currentView === item.id
        return (
          <button
            key={item.id}
            type="button"
            className={`wf-dock-btn${on ? ' is-on' : ''}`}
            onClick={() => onViewChange(item.id)}
            aria-current={on ? 'page' : undefined}
            aria-label={item.label}
          >
            {on && (
              <motion.span
                className="wf-dock-pip"
                layoutId={reduced ? undefined : 'wf-dock-pip'}
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              />
            )}
            <Icon size={18} style={{ position: 'relative', zIndex: 1 }} />
          </button>
        )
      })}
    </nav>
  )
}
