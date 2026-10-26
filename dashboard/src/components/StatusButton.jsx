// StatusButton — useLayouts status-button with idle -> loading -> success/error states
import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { Loader2, Check, AlertCircle } from 'lucide-react'
import { SPRING } from '../motion.js'

export default function StatusButton({
  onClick,
  idleIcon: IdleIcon,
  idleText = 'Execute',
  successText = 'Done!',
  errorText = 'Failed',
  tone = 'primary', // 'primary' | 'danger' | 'healthy' | 'neutral'
  className = '',
  size = 'md',
  disabled = false,
  ariaLabel,
}) {
  const [status, setStatus] = useState('idle') // 'idle' | 'loading' | 'success' | 'error'
  const timeoutRef = useRef(null)
  const shouldReduceMotion = useReducedMotion()

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  const handleClick = async (e) => {
    e.stopPropagation()
    if (status === 'loading' || disabled) return

    setStatus('loading')
    try {
      if (onClick) {
        await onClick(e)
      }
      setStatus('success')
      timeoutRef.current = setTimeout(() => {
        setStatus('idle')
      }, 1600)
    } catch {
      setStatus('error')
      timeoutRef.current = setTimeout(() => {
        setStatus('idle')
      }, 2000)
    }
  }

  const toneClass = `status-btn--${tone}`
  const sizeClass = size === 'sm' ? 'status-btn--sm' : ''

  return (
    <motion.button
      type="button"
      className={`status-btn ${toneClass} ${sizeClass} ${status !== 'idle' ? `is-${status}` : ''} ${className}`}
      onClick={handleClick}
      disabled={disabled || status === 'loading'}
      aria-busy={status === 'loading'}
      aria-label={ariaLabel || idleText}
      whileHover={shouldReduceMotion ? {} : { scale: 1.02 }}
      whileTap={shouldReduceMotion ? {} : { scale: 0.96, y: 1 }}
      transition={SPRING.snappy}
    >
      <div className="status-btn-inner">
        <AnimatePresence mode="popLayout" initial={false}>
          {status === 'idle' && (
            <motion.div
              key="idle"
              className="status-btn-state"
              initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
              transition={{ duration: 0.16 }}
            >
              {IdleIcon && <IdleIcon size={size === 'sm' ? 12 : 14} className="status-btn-icon" aria-hidden="true" />}
              <span>{idleText}</span>
            </motion.div>
          )}

          {status === 'loading' && (
            <motion.div
              key="loading"
              className="status-btn-state"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.15 }}
            >
              <Loader2
                size={size === 'sm' ? 12 : 14}
                className="status-btn-spinner"
                aria-hidden="true"
              />
              <span>Applying…</span>
            </motion.div>
          )}

          {status === 'success' && (
            <motion.div
              key="success"
              className="status-btn-state status-btn-state--success"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={SPRING.bouncy}
            >
              <Check size={size === 'sm' ? 13 : 15} aria-hidden="true" />
              <span>{successText}</span>
            </motion.div>
          )}

          {status === 'error' && (
            <motion.div
              key="error"
              className="status-btn-state status-btn-state--error"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={SPRING.bouncy}
            >
              <AlertCircle size={size === 'sm' ? 13 : 15} aria-hidden="true" />
              <span>{errorText}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.button>
  )
}
