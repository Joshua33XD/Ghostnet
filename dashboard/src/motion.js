// GhostNet Motion Design System — centralized animation variants & springs
import { useReducedMotion } from 'framer-motion'

// ── Spring presets ──────────────────────────────────────────────────────────
export const SPRING = {
  gentle:    { type: 'spring', stiffness: 300, damping: 30 },
  snappy:    { type: 'spring', stiffness: 400, damping: 28 },
  bouncy:    { type: 'spring', stiffness: 260, damping: 20 },
  stiff:     { type: 'spring', stiffness: 500, damping: 35 },
}

// ── Duration presets (for tween) ───────────────────────────────────────────
export const DUR = {
  instant: 0.15,
  fast:    0.2,
  normal:  0.35,
  slow:    0.5,
}

// ── Stagger container ──────────────────────────────────────────────────────
export const stagger = (staggerChildren = 0.06, delayChildren = 0) => ({
  hidden: {},
  visible: { transition: { staggerChildren, delayChildren } },
})

// ── Entrance variants ──────────────────────────────────────────────────────
export const fadeUp = {
  hidden:  { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: SPRING.gentle },
}

export const fadeIn = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1, transition: { duration: DUR.normal } },
}

export const scaleIn = {
  hidden:  { opacity: 0, scale: 0.92 },
  visible: { opacity: 1, scale: 1, transition: SPRING.gentle },
}

export const slideInLeft = {
  hidden:  { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0, transition: SPRING.gentle },
}

export const slideInRight = {
  hidden:  { opacity: 0, x: 20 },
  visible: { opacity: 1, x: 0, transition: SPRING.gentle },
}

export const slideInUp = {
  hidden:  { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: SPRING.gentle },
}

// ── View transition variants ───────────────────────────────────────────────
export const viewTransition = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: DUR.normal, ease: [0.16, 1, 0.3, 1] } },
  exit:    { opacity: 0, y: -6, transition: { duration: DUR.fast } },
}

// ── Hover / tap interactions ───────────────────────────────────────────────
export const hoverLift = {
  scale: 1,
  y: -2,
  transition: SPRING.snappy,
}

export const tapScale = {
  scale: 0.98,
  transition: { duration: DUR.instant },
}

// ── Hook: returns disabled state if user prefers reduced motion ────────────
export function useMotionDisabled() {
  return useReducedMotion()
}
