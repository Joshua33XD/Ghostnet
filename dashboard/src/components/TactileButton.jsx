// TactileButton — useLayouts tactile-button with spring response & accessible focus
import React from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { SPRING } from '../motion.js'

export default function TactileButton({
  children,
  onClick,
  tone = 'default', // 'default' | 'primary' | 'danger' | 'ghost'
  size = 'md', // 'sm' | 'md'
  icon: Icon,
  className = '',
  disabled = false,
  type = 'button',
  ariaLabel,
  title,
  ...props
}) {
  const shouldReduceMotion = useReducedMotion()

  const toneClass = `tactile-btn--${tone}`
  const sizeClass = size === 'sm' ? 'tactile-btn--sm' : ''

  return (
    <motion.button
      type={type}
      className={`tactile-btn ${toneClass} ${sizeClass} ${className}`}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      title={title}
      whileHover={shouldReduceMotion || disabled ? {} : { y: -1, transition: SPRING.snappy }}
      whileTap={shouldReduceMotion || disabled ? {} : { scale: 0.97, y: 1 }}
      transition={SPRING.snappy}
      {...props}
    >
      {Icon && <Icon size={size === 'sm' ? 12 : 14} className="tactile-btn-icon" aria-hidden="true" />}
      <span>{children}</span>
    </motion.button>
  )
}
