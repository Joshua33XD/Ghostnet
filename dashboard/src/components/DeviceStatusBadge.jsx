import React from 'react'
import { Lock, AlertTriangle, ShieldCheck } from 'lucide-react'

export default function DeviceStatusBadge({ status }) {
  const st = (status || 'HEALTHY').toUpperCase()

  let Icon = ShieldCheck
  let text = 'HEALTHY'
  let badgeClass = 'device-badge--healthy'

  if (st === 'QUARANTINED') {
    Icon = Lock
    text = 'QUARANTINED'
    badgeClass = 'device-badge--quarantined'
  } else if (st === 'SUSPICIOUS') {
    Icon = AlertTriangle
    text = 'SUSPICIOUS'
    badgeClass = 'device-badge--suspicious'
  }

  return (
    <span
      className={`device-status-badge ${badgeClass}`}
      role="status"
      aria-label={`Device status: ${text}`}
    >
      <Icon size={13} className="device-badge-icon" aria-hidden="true" />
      <span className="device-badge-text">{text}</span>
    </span>
  )
}
