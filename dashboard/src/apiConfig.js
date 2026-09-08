const STORAGE_KEY = 'ghostnet.apiUrl'

function stripSlash(url) {
  return (url || '').trim().replace(/\/$/, '')
}

export function getDefaultApiUrl() {
  if (import.meta.env.DEV) return 'http://localhost:8000'
  return stripSlash(import.meta.env.VITE_API_URL || 'https://ghostnet-production-77ad.up.railway.app')
}

export function getApiUrl() {
  try {
    const saved = stripSlash(localStorage.getItem(STORAGE_KEY) || '')
    if (saved) return saved
  } catch {
    /* ignore */
  }
  return getDefaultApiUrl()
}

export function setApiUrl(url) {
  const cleaned = stripSlash(url)
  if (cleaned) localStorage.setItem(STORAGE_KEY, cleaned)
  else localStorage.removeItem(STORAGE_KEY)
}

export function getWsUrl() {
  const api = getApiUrl()
  if (!api) {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${proto}//${window.location.host}/ws/events`
  }
  return `${api.replace(/^http/, 'ws')}/ws/events`
}

export async function pingApi(apiUrl = getApiUrl()) {
  const res = await fetch(`${apiUrl}/`, { method: 'GET' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}
