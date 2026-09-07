/**
 * LifecycleStepper -- GHOSTNET 7-stage security lifecycle visualiser
 * Stages: CONNECT . OBSERVE . DETECT . TRUST SCORE . ISOLATE . RECONFIGURE . RECOVER
 * Props:  status {HEALTHY|SUSPICIOUS|QUARANTINED|OFFLINE}, reroutePath, compact
 */
import { useEffect, useState } from 'react'

const STAGES = [
  { id: 'CONNECT',     label: 'CONNECT'     },
  { id: 'OBSERVE',     label: 'OBSERVE'     },
  { id: 'DETECT',      label: 'DETECT'      },
  { id: 'TRUST_SCORE', label: 'TRUST SCORE' },
  { id: 'ISOLATE',     label: 'ISOLATE'     },
  { id: 'RECONFIGURE', label: 'RECONFIGURE' },
  { id: 'RECOVER',     label: 'RECOVER'     },
]

function computeStages(status, reroutePath, recoveringFlash) {
  return STAGES.map((s, idx) => {
    let active = false, pulsing = false, dim = false
    switch (status) {
      case 'HEALTHY':
        if (recoveringFlash) { active = idx === 6 }
        else { active = idx <= 3; dim = idx >= 4 }
        break
      case 'SUSPICIOUS':
        active = idx <= 3; pulsing = idx === 3; dim = idx >= 4
        break
      case 'QUARANTINED':
        active = idx <= 4; pulsing = idx === 4; dim = idx === 6
        if (idx === 5 && reroutePath) active = true
        break
      case 'OFFLINE':
        active = idx === 0; dim = idx !== 0
        break
      default: dim = true
    }
    return { ...s, active, pulsing, dim }
  })
}

function StageChip({ label, active, pulsing, dim, compact }) {
  const chipStyle = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: 'var(--font-mono, monospace)', fontWeight: 700, letterSpacing: '0.06em',
    borderRadius: compact ? 4 : 6, border: '1px solid', whiteSpace: 'nowrap',
    transition: 'all 0.35s ease', userSelect: 'none',
    fontSize: compact ? 7 : 9, padding: compact ? '2px 5px' : '4px 10px',
  }
  if (dim) {
    Object.assign(chipStyle, { color: 'rgba(255,255,255,0.18)', borderColor: 'rgba(255,255,255,0.08)', background: 'transparent' })
  } else if (active) {
    Object.assign(chipStyle, {
      color: '#00f3ff', borderColor: 'rgba(0,243,255,0.45)', background: 'rgba(0,243,255,0.08)',
      boxShadow: pulsing ? '0 0 8px rgba(0,243,255,0.5)' : '0 0 4px rgba(0,243,255,0.2)',
      animation: pulsing ? 'lifecycle-pulse 1.2s ease-in-out infinite' : 'none',
    })
  }
  return <span style={chipStyle}>{label}</span>
}

export default function LifecycleStepper({ status = 'HEALTHY', reroutePath = null, compact = false }) {
  const [recoveringFlash, setRecoveringFlash] = useState(false)
  const [prevStatus, setPrevStatus] = useState(status)

  useEffect(() => {
    if (prevStatus === 'QUARANTINED' && status === 'HEALTHY') {
      setRecoveringFlash(true)
      const t = setTimeout(() => setRecoveringFlash(false), 3500)
      return () => clearTimeout(t)
    }
    setPrevStatus(status)
  }, [status]) // eslint-disable-line

  const stages = computeStages(status, reroutePath, recoveringFlash)

  const wrapStyle = compact
    ? { display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 3, padding: '4px 0' }
    : {
        display: 'flex', alignItems: 'center', flexWrap: 'nowrap', gap: 4,
        padding: '10px 14px', background: 'rgba(0,0,0,0.25)', borderRadius: 10,
        border: '1px solid rgba(0,243,255,0.1)', overflowX: 'auto',
      }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: '@keyframes lifecycle-pulse{0%,100%{opacity:1;box-shadow:0 0 8px rgba(0,243,255,.5)}50%{opacity:.55;box-shadow:0 0 16px rgba(0,243,255,.9)}}' }} />
      <div style={wrapStyle}>
        {!compact && (
          <span style={{ fontSize: 8, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)', marginRight: 6, flexShrink: 0 }}>
            Lifecycle
          </span>
        )}
        {stages.map((s, i) => (
          <span key={s.id} style={{ display: 'inline-flex', alignItems: 'center', gap: compact ? 3 : 4 }}>
            <StageChip label={s.label} active={s.active} pulsing={s.pulsing} dim={s.dim} compact={compact} />
            {i < stages.length - 1 && (
              <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: compact ? 8 : 10, flexShrink: 0 }}>·</span>
            )}
          </span>
        ))}
      </div>
    </>
  )
}
