import { useEffect } from 'react'
import { motion, useReducedMotion, useSpring, useTransform } from 'framer-motion'

export default function AnimatedNumber({ value = 0, format, className }) {
  const reduced = useReducedMotion()
  const spring = useSpring(Number(value) || 0, { stiffness: 300, damping: 30, mass: 0.6 })
  const display = useTransform(spring, latest => {
    const n = Number.isFinite(latest) ? latest : 0
    return format ? format(n) : Math.round(n).toLocaleString()
  })

  useEffect(() => {
    spring.set(Number(value) || 0)
  }, [value, spring])

  if (reduced) {
    const n = Number(value) || 0
    return <span className={className}>{format ? format(n) : Math.round(n).toLocaleString()}</span>
  }

  return <motion.span className={className}>{display}</motion.span>
}
