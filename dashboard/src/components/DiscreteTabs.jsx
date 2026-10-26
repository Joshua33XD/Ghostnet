// DiscreteTabs — useLayouts discrete-tabs animated indicator with spring dynamics
import React from 'react'
import { motion, useReducedMotion } from 'framer-motion'

export default function DiscreteTabs({
  items = [],
  activeId = null,
  onChange,
  layoutId = 'discrete-tabs-indicator',
  ariaLabel = 'Filter tabs',
  size = 'md',
  className = '',
}) {
  const shouldReduceMotion = useReducedMotion()

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={`discrete-tabs-track ${size === 'sm' ? 'discrete-tabs-track--sm' : ''} ${className}`}
    >
      {items.map((tab) => {
        const isActive = activeId === tab.id
        const Icon = tab.icon

        return (
          <button
            key={String(tab.id)}
            type="button"
            className={`discrete-tab-btn ${isActive ? 'is-active' : ''} ${tab.tone ? `discrete-tab-btn--${tab.tone}` : ''}`}
            onClick={() => onChange(tab.id)}
            aria-pressed={isActive}
            aria-label={tab.ariaLabel || tab.label}
          >
            {isActive && (
              <motion.div
                layoutId={layoutId}
                className="discrete-tab-indicator"
                transition={
                  shouldReduceMotion
                    ? { duration: 0 }
                    : {
                        type: 'spring',
                        stiffness: 380,
                        damping: 28,
                        mass: 0.8,
                      }
                }
              />
            )}

            <span className="discrete-tab-content">
              {Icon && (
                <Icon
                  size={size === 'sm' ? 12 : 14}
                  className="discrete-tab-icon"
                  aria-hidden="true"
                />
              )}
              <span className="discrete-tab-label">{tab.label}</span>
              {(tab.count !== undefined || tab.badge !== undefined) && (
                <span className={`discrete-tab-badge ${tab.tone ? `badge-${tab.tone}` : ''}`}>
                  {tab.badge ?? tab.count}
                </span>
              )}
            </span>
          </button>
        )
      })}
    </div>
  )
}
