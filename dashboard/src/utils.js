// Utility helpers shared across components

export function getScoreClass(score) {
  if (score >= 0.75) return 'critical'
  if (score >= 0.5)  return 'high'
  if (score >= 0.25) return 'medium'
  return 'low'
}

/**
 * Trust Score = 1 − anomaly_score  (frontend-only, backend field is unchanged)
 * 0.0 = no trust (fully malicious), 1.0 = fully trusted (clean)
 */
export function getTrustScore(anomalyScore) {
  return Math.max(0, Math.min(1, 1 - (anomalyScore ?? 0)))
}

/**
 * CSS class for a Trust Score level (reuses same colour tokens as getScoreClass
 * but inverted: high trust = 'low' concern = green, low trust = 'critical' = red)
 */
export function getTrustClass(anomalyScore) {
  const trust = getTrustScore(anomalyScore)
  if (trust < 0.25) return 'critical'
  if (trust < 0.5)  return 'high'
  if (trust < 0.75) return 'medium'
  return 'low'   // "low" concern = good
}

/**
 * Human-readable trust colour using design tokens (theme-aware).
 */
export function getTrustColor(anomalyScore) {
  const t = getTrustScore(anomalyScore)
  if (t >= 0.75) return 'var(--status-healthy)'
  if (t >= 0.40) return 'var(--status-warn)'
  return 'var(--status-danger)'
}

export function getStatusIcon(status) {
  switch (status) {
    case 'HEALTHY':     return '●'
    case 'SUSPICIOUS':  return '◐'
    case 'QUARANTINED': return '⊗'
    case 'OFFLINE':     return '○'
    default:            return '·'
  }
}

export function getEventIcon(tag) {
  if (!tag) return '·'
  if (tag.startsWith('THREAT')) return '!'
  const map = {
    'INFO':           'i',
    'MQTT-RX':        '↓',
    'MQTT-TX':        '↑',
    'HEARTBEAT':      '♥',
    'ONLINE':         '●',
    'OFFLINE':        '○',
    'SCORE':          '~',
    'WARN':           '!',
    'ATTACK':         '⚡',
    'QUARANTINE':     '⊗',
    'RECOVERY-CHECK': '?',
    'RECOVERED':      '✓',
    'PROTECT':        '⊞',
    'SELF-HEAL':      '+',
    'THREAT-CLEAR':   '✓',
    'ERROR':          '✕',
  }
  return map[tag] ?? '·'
}

export function isCriticalTag(tag) {
  return ['ATTACK', 'QUARANTINE', 'OFFLINE'].includes(tag) ||
    (tag && tag.startsWith('THREAT:'))
}

export function isGoodTag(tag) {
  return ['RECOVERED', 'ONLINE', 'HEARTBEAT', 'THREAT-CLEAR', 'SELF-HEAL'].includes(tag)
}

export function formatElapsed(ts) {
  if (!ts) return '—'
  const now = Date.now() / 1000
  const diff = now - ts
  if (diff < 5)    return 'just now'
  if (diff < 60)   return `${Math.round(diff)}s ago`
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`
  return `${Math.round(diff / 3600)}h ago`
}

export function formatBytes(bytes) {
  if (!bytes) return '0 B'
  if (bytes < 1024) return `${bytes.toFixed(0)} B`
  return `${(bytes / 1024).toFixed(1)} KB`
}

// --- Event-timestamp helpers ---
// Events from the WS hook are stamped with _received (Date.now() ms) by useGhostNet.
// Fall back to parsing evt.ts as ISO if _received is absent.

export function formatRelativeTime(receivedMs, rawTs) {
  // Prefer the _received epoch added by the hook; fall back to parsing rawTs
  let epochMs = receivedMs
  if (!epochMs && rawTs) {
    const d = new Date(rawTs)
    epochMs = isNaN(d.getTime()) ? null : d.getTime()
  }
  if (!epochMs) return rawTs ?? '—'

  const diff = (Date.now() - epochMs) / 1000
  if (diff < 5)     return 'just now'
  if (diff < 60)    return `${Math.floor(diff)}s ago`
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export function formatExactTime(receivedMs, rawTs) {
  let epochMs = receivedMs
  if (!epochMs && rawTs) {
    const d = new Date(rawTs)
    epochMs = isNaN(d.getTime()) ? null : d.getTime()
  }
  if (!epochMs) return rawTs ?? '—'
  return new Date(epochMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

/**
 * Format a rate number nicely (e.g. 1234 → "1.2 k/s")
 */
export function formatRate(n) {
  if (n == null) return '—'
  if (n >= 1000) return (n / 1000).toFixed(1) + ' k/s'
  return n.toFixed(0) + '/s'
}
