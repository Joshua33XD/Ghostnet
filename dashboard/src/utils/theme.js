export const THEMES = ['dark', 'light', 'colorful']

export const THEME_LABELS = {
  dark: 'Dark',
  light: 'Light',
  colorful: 'Signal',
}

export function applyTheme(name) {
  const root = document.documentElement
  root.classList.remove('theme-clean', 'theme-colorful', 'theme-bright', 'theme-light')
  if (name === 'light') root.classList.add('theme-light')
  if (name === 'colorful') root.classList.add('theme-colorful')
  localStorage.setItem('gn-theme', name)
}

export function initTheme() {
  let saved = localStorage.getItem('gn-theme') ?? 'dark'
  if (saved === 'bright' || saved === 'clean') saved = 'light'
  if (!THEMES.includes(saved)) saved = 'dark'
  applyTheme(saved)
  return saved
}

export function cycleTheme(current) {
  const idx = THEMES.indexOf(current)
  const next = THEMES[(idx + 1) % THEMES.length]
  applyTheme(next)
  return next
}
