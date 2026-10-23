import React from 'react'
import { AlertOctagon, AlertTriangle, Info } from 'lucide-react'

export default function SeverityBadge({ severity, compact = false, showIcon = true }) {
  const sev = Number(severity) || 3

  let label = 'SEV 3 • LOW'
  let shortLabel = 'SEV 3'
  let Icon = Info
  let badgeClass = 'sev-badge--low'

  if (sev === 1) {
    label = 'SEV 1 • CRITICAL'
    shortLabel = 'SEV 1'
    Icon = AlertOctagon
    badgeClass = 'sev-badge--critical'
  } else if (sev === 2) {
    label = 'SEV 2 • MEDIUM'
    shortLabel = 'SEV 2'
    Icon = AlertTriangle
    badgeClass = 'sev-badge--medium'
  }

  return (
    <span
      className={`sev-badge ${badgeClass}`}
      role="status"
      aria-label={`Severity ${sev}: ${label}`}
    >
      {showIcon && <Icon size={12} className="sev-badge-icon" aria-hidden="true" />}
      <span className="sev-badge-text">{compact ? shortLabel : label}</span>
    </span>
  )
}
