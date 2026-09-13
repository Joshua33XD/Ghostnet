// useSteppedNumber — animates a value toward `target` in visible integer steps
// (e.g. trust falling 82 → 78 → 71 → 63 → 56 → 48) instead of a silent jump.
import { useEffect, useState } from 'react'
import { useReducedMotion } from 'framer-motion'

export default function useSteppedNumber(target, { stepMs = 320, minStep = 1 } = {}) {
  const reduced = useReducedMotion()
  const [value, setValue] = useState(target)

  useEffect(() => {
    if (reduced) return
    const id = setInterval(() => {
      setValue(v => {
        if (v === target) { clearInterval(id); return v }
        const gap = target - v
        const step = Math.max(minStep, Math.min(Math.abs(gap), Math.ceil(Math.abs(gap))))
        const next = gap > 0 ? Math.min(target, v + step) : Math.max(target, v - step)
        if (next === target) clearInterval(id)
        return Math.round(next)
      })
    }, stepMs)
    return () => clearInterval(id)
  }, [target, stepMs, minStep, reduced])

  return value
}