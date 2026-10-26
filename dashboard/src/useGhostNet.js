// =============================================================================
// GhostNet IDS — useGhostNet.js
// Live telemetry hook: devices, stats, alerts, packet captures, and WS streaming
// =============================================================================
import { useState, useEffect, useCallback, useRef } from 'react'
import { getApiHeaders, getApiUrl, getWsUrl } from './apiConfig.js'

const MAX_EVENTS = 300
const POLL_INTERVAL_MS = 2000

export function useGhostNet() {
  const [devices, setDevices] = useState([])
  const [stats, setStats] = useState({
    total_alerts: 0,
    severity_counts: { 1: 0, 2: 0, 3: 0 },
    alerts_per_minute: [],
    top_signatures: [],
    total_devices: 0,
    active_quarantined: 0,
    active_suspicious: 0,
    active_healthy: 0,
    total_bytes: 0,
    total_packets: 0,
    total_bps: 0,
    total_pps: 0,
  })
  const [alerts, setAlerts] = useState([])
  const [events, setEvents] = useState([])
  const [wsStatus, setWsStatus] = useState('connecting')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  const wsRef = useRef(null)
  const reconnectTimer = useRef(null)
  const eventIdRef = useRef(0)

  // ── 1. Fetch Devices List ──────────────────────────────────────────────────
  const fetchDevices = useCallback(async () => {
    try {
      const apiUrl = getApiUrl()
      if (!apiUrl) {
        setIsLoading(false)
        return
      }
      const res = await fetch(`${apiUrl}/devices`, { signal: AbortSignal.timeout(4000) })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const list = await res.json()
      setDevices(list)
      setError(null)
    } catch (err) {
      setError(prev => prev || 'Cannot reach the GhostNet API. Start the backend or set the endpoint from the overflow menu.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  // ── 2. Fetch IDS Stats ─────────────────────────────────────────────────────
  const fetchStats = useCallback(async () => {
    try {
      const apiUrl = getApiUrl()
      if (!apiUrl) return
      const res = await fetch(`${apiUrl}/ids/stats`, { signal: AbortSignal.timeout(4000) })
      if (!res.ok) return
      const data = await res.json()
      setStats(data)
    } catch {
      // Backend not ready yet
    }
  }, [])

  // ── 3. Fetch Recent Alerts ─────────────────────────────────────────────────
  const fetchAlerts = useCallback(async (params = {}) => {
    try {
      const apiUrl = getApiUrl()
      if (!apiUrl) return
      const query = new URLSearchParams()
      query.set('limit', params.limit || 150)
      if (params.severity) query.set('severity', params.severity)
      if (params.ip) query.set('ip', params.ip)
      if (params.signature) query.set('signature', params.signature)

      const res = await fetch(`${apiUrl}/ids/alerts?${query.toString()}`, { signal: AbortSignal.timeout(4000) })
      if (!res.ok) return
      const list = await res.json()
      setAlerts(list)
    } catch {
      // Backend not ready
    }
  }, [])

  // ── 4. Quarantine & Release Actions ────────────────────────────────────────
  const releaseDevice = useCallback(async (ip) => {
    try {
      const apiUrl = getApiUrl()
      await fetch(`${apiUrl}/devices/${ip}/release`, {
        method: 'POST',
        headers: getApiHeaders(),
      })
      await fetchDevices()
      await fetchStats()
    } catch (e) {
      console.error('Release failed', e)
    }
  }, [fetchDevices, fetchStats])

  const quarantineDevice = useCallback(async (ip, reason = 'Operator manual quarantine') => {
    try {
      const apiUrl = getApiUrl()
      await fetch(`${apiUrl}/devices/${ip}/quarantine?reason=${encodeURIComponent(reason)}`, {
        method: 'POST',
        headers: getApiHeaders(),
      })
      await fetchDevices()
      await fetchStats()
    } catch (e) {
      console.error('Quarantine failed', e)
    }
  }, [fetchDevices, fetchStats])

  // ── 5. Push Live WS Event ──────────────────────────────────────────────────
  const pushEvent = useCallback((evt) => {
    setEvents(prev => {
      const id = ++eventIdRef.current
      const enriched = { ...evt, _id: id, _new: true, _received: Date.now() }
      return [enriched, ...prev].slice(0, MAX_EVENTS)
    })
    // Immediately refresh state on relevant IDS tag
    const tag = evt.tag || ''
    if (tag === 'QUARANTINE' || tag === 'RECOVERED' || tag.startsWith('THREAT') || tag === 'WARN') {
      fetchDevices()
      fetchStats()
      fetchAlerts()
    }
  }, [fetchDevices, fetchStats, fetchAlerts])

  // ── 6. WebSocket Connection ────────────────────────────────────────────────
  const connectWs = useCallback(() => {
    const wsUrl = getWsUrl()
    if (!wsUrl || wsRef.current?.readyState === WebSocket.OPEN) return
    setWsStatus('connecting')

    try {
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        setWsStatus('connected')
        setError(null)
        clearTimeout(reconnectTimer.current)
      }

      ws.onmessage = (e) => {
        try {
          const evt = JSON.parse(e.data)
          pushEvent(evt)
        } catch {
          // ignore malformed frame
        }
      }

      ws.onerror = () => {
        setWsStatus('disconnected')
      }

      ws.onclose = () => {
        setWsStatus('disconnected')
        reconnectTimer.current = setTimeout(connectWs, 3000)
      }
    } catch {
      setWsStatus('disconnected')
      reconnectTimer.current = setTimeout(connectWs, 3000)
    }
  }, [pushEvent])

  // ── 7. Packet Capture Helpers (Phase 3) ────────────────────────────────────
  const fetchCaptureFiles = useCallback(async () => {
    try {
      const apiUrl = getApiUrl()
      if (!apiUrl) return []
      const res = await fetch(`${apiUrl}/capture/files`)
      if (!res.ok) return []
      return await res.json()
    } catch {
      return []
    }
  }, [])

  const inspectPackets = useCallback(async (filename, filter = '', limit = 50) => {
    try {
      const apiUrl = getApiUrl()
      if (!apiUrl) return { tshark_available: false, packets: [] }
      const res = await fetch(`${apiUrl}/capture/packets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename, filter, limit }),
      })
      return await res.json()
    } catch (e) {
      return { tshark_available: false, packets: [], error: String(e) }
    }
  }, [])

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  useEffect(() => {
    connectWs()
    fetchDevices()
    fetchStats()
    fetchAlerts()

    const poll = setInterval(() => {
      fetchDevices()
      fetchStats()
      fetchAlerts()
    }, POLL_INTERVAL_MS)

    return () => {
      clearInterval(poll)
      clearTimeout(reconnectTimer.current)
      wsRef.current?.close()
    }
  }, [connectWs, fetchDevices, fetchStats, fetchAlerts])

  // Map devices list to object keyed by IP for backward compatibility
  const devicesByIp = {}
  devices.forEach(d => {
    devicesByIp[d.ip] = d
  })

  return {
    devices,
    devicesByIp,
    stats,
    alerts,
    events,
    wsStatus,
    isLoading,
    error,
    releaseDevice,
    quarantineDevice,
    fetchAlerts,
    fetchDevices,
    fetchStats,
    fetchCaptureFiles,
    inspectPackets,

    // Backward compatibility aliases
    nodes: devicesByIp,
    releaseNode: releaseDevice,
    scoreHistory: {},
  }
}
