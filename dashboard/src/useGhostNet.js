// WebSocket hook — streams all GhostNet events in real time
import { useState, useEffect, useCallback, useRef } from 'react'

// In production (Vercel) the dashboard and API share the same origin.
// In local dev, the Vite proxy forwards /nodes and /alerts to localhost:8000.
const IS_DEV = import.meta.env.DEV
const API_URL = IS_DEV ? 'http://localhost:8000' : ''
const WS_PROTOCOL = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
const WS_URL = IS_DEV
  ? 'ws://localhost:8000/ws/events'
  : `${WS_PROTOCOL}//${window.location.host}/ws/events`
const MAX_EVENTS = 300
const POLL_INTERVAL_MS = 2000
const MAX_HISTORY = 60  // score history points per node

export function useGhostNet() {
  const [nodes, setNodes] = useState({})        // { node_id: nodeState }
  const [events, setEvents] = useState([])      // ring buffer of log events
  const [scoreHistory, setScoreHistory] = useState({}) // { node_id: [{t, score}] }
  const [wsStatus, setWsStatus] = useState('connecting')
  const wsRef = useRef(null)
  const reconnectTimer = useRef(null)
  const eventIdRef = useRef(0)

  // ── Fetch node list via REST ──────────────────────────────────────────────
  const fetchNodes = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/nodes`)
      if (!res.ok) return
      const list = await res.json()
      setNodes(prev => {
        const next = { ...prev }
        list.forEach(n => { next[n.node_id] = n })
        return next
      })
      // Record score history for sparklines
      setScoreHistory(prev => {
        const next = { ...prev }
        list.forEach(n => {
          const arr = next[n.node_id] || []
          const point = { t: Date.now(), score: n.anomaly_score ?? 0 }
          next[n.node_id] = [...arr, point].slice(-MAX_HISTORY)
        })
        return next
      })
    } catch {
      // backend not ready yet
    }
  }, [])

  // ── Release a quarantined node ────────────────────────────────────────────
  const releaseNode = useCallback(async (nodeId) => {
    try {
      await fetch(`${API_URL}/nodes/${nodeId}/release`, { method: 'POST' })
      await fetchNodes()
    } catch (e) {
      console.error('Release failed', e)
    }
  }, [fetchNodes])

  // ── Push a new event into the ring buffer ─────────────────────────────────
  const pushEvent = useCallback((evt) => {
    setEvents(prev => {
      const id = ++eventIdRef.current
      const enriched = { ...evt, _id: id, _new: true }
      const next = [enriched, ...prev].slice(0, MAX_EVENTS)
      return next
    })
    if (evt.node_id) {
      fetchNodes()
    }
  }, [fetchNodes])

  // ── WebSocket connection ───────────────────────────────────────────────────
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return
    setWsStatus('connecting')

    const ws = new WebSocket(WS_URL)
    wsRef.current = ws

    ws.onopen = () => {
      setWsStatus('connected')
      clearTimeout(reconnectTimer.current)
    }

    ws.onmessage = (e) => {
      try {
        const evt = JSON.parse(e.data)
        pushEvent(evt)
      } catch { /* ignore malformed */ }
    }

    ws.onerror = () => { setWsStatus('disconnected') }

    ws.onclose = () => {
      setWsStatus('disconnected')
      reconnectTimer.current = setTimeout(connect, 3000)
    }
  }, [pushEvent])

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  useEffect(() => {
    connect()
    fetchNodes()
    const poll = setInterval(fetchNodes, POLL_INTERVAL_MS)
    return () => {
      clearInterval(poll)
      clearTimeout(reconnectTimer.current)
      wsRef.current?.close()
    }
  }, [connect, fetchNodes])

  return { nodes, events, wsStatus, releaseNode, scoreHistory }
}
