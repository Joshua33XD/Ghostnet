export const THEMES = ['dark', 'clean', 'colorful']

export const THEME_LABELS = {
  dark: 'Dark',
  clean: 'Clean',
  colorful: 'Colorful',
}

export function applyTheme(name) {
  const root = document.documentElement
  root.classList.remove('theme-clean', 'theme-colorful', 'theme-bright')
  if (name === 'clean') root.classList.add('theme-clean')
  if (name === 'colorful') root.classList.add('theme-colorful')
  localStorage.setItem('gn-theme', name)
}

export function initTheme() {
  let saved = localStorage.getItem('gn-theme') ?? 'clean'
  if (saved === 'bright') saved = 'clean'
  if (!THEMES.includes(saved)) saved = 'clean'
  applyTheme(saved)
  return saved
}

export function cycleTheme(current) {
  const idx = THEMES.indexOf(current)
  const next = THEMES[(idx + 1) % THEMES.length]
  applyTheme(next)
  return next
}
