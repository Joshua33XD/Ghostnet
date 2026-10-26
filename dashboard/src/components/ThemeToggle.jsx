import { motion, useReducedMotion } from 'framer-motion'
import { Sun, Moon, Sparkles } from 'lucide-react'
import { THEMES, THEME_LABELS } from '../utils/theme.js'

const THEME_ICONS = {
  dark: Moon,
  light: Sun,
  colorful: Sparkles,
}

export default function ThemeToggle({ currentTheme, onSelectTheme }) {
  const shouldReduceMotion = useReducedMotion()

  return (
    <div className="theme-toggle-segmented" role="radiogroup" aria-label="Color theme">
      {THEMES.map((t) => {
        const Icon = THEME_ICONS[t] ?? Sun
        const isActive = currentTheme === t
        const label = THEME_LABELS[t] ?? t

        return (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={isActive}
            className={`theme-segmented-item ${isActive ? 'is-active' : ''}`}
            onClick={() => onSelectTheme(t)}
            title={`Switch to ${label} theme`}
            aria-label={`${label} theme`}
          >
            {isActive && (
              <motion.div
                layoutId="theme-toggle-active-bg"
                className="theme-segmented-indicator"
                transition={
                  shouldReduceMotion
                    ? { duration: 0 }
                    : { type: 'spring', stiffness: 300, damping: 30 }
                }
              />
            )}
            <span className="theme-segmented-content">
              <Icon size={12} aria-hidden="true" />
              <span className="theme-segmented-label">{label}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
