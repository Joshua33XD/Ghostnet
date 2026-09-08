import { useEffect, useRef, useState } from 'react'
import { Activity, Flame, Link2, Play, Square } from 'lucide-react'
import { getApiUrl, getDefaultApiUrl, pingApi, setApiUrl } from '../apiConfig.js'

export default function SettingsPanel({ theme, themes, onThemeDirect }) {
  const [apiInput, setApiInput] = useState(getApiUrl)
  const [pingState, setPingState] = useState('')
  const [nodeId, setNodeId] = useState('locust-target-01')
  const [users, setUsers] = useState(20)
  const [running, setRunning] = useState(false)
  const [sent, setSent] = useState(0)
  const [errors, setErrors] = useState(0)
  const runningRef = useRef(false)
  const sentRef = useRef(0)
  const errRef = useRef(0)

  useEffect(() => {
    runningRef.current = running
  }, [running])

  const saveApi = () => {
    setApiUrl(apiInput)
    window.location.reload()
  }

  const testApi = async () => {
    setPingState('Testing…')
    try {
      const data = await pingApi(apiInput.trim().replace(/\/$/, ''))
      setPingState(data.status || 'OK')
    } catch (err) {
      setPingState(`Failed: ${err.message}`)
    }
  }

  const injectOnce = async (mode) => {
    const api = getApiUrl()
    const isAttack = mode !== 'NORMAL'
    await fetch(`${api}/ingest/telemetry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        node_id: nodeId,
        seq: Math.floor(Math.random() * 999999),
        ts: Date.now() / 1000,
        padding: isAttack ? 'x'.repeat(80) : '',
        attack_type: isAttack ? mode : 'None',
      }),
    })
  }

  const floodLoop = async () => {
    const api = getApiUrl()
    const workers = Math.max(1, Math.min(50, Number(users) || 1))
    const runWorker = async () => {
      while (runningRef.current) {
        try {
          const res = await fetch(`${api}/ingest/telemetry`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              node_id: nodeId,
              seq: Math.floor(Math.random() * 999999),
              ts: Date.now() / 1000,
            }),
          })
          if (res.ok) sentRef.current += 1
          else errRef.current += 1
        } catch {
          errRef.current += 1
        }
        setSent(sentRef.current)
        setErrors(errRef.current)
      }
    }
    await Promise.all(Array.from({ length: workers }, runWorker))
  }

  const startFlood = () => {
    sentRef.current = 0
    errRef.current = 0
    setSent(0)
    setErrors(0)
    setRunning(true)
    runningRef.current = true
    floodLoop().finally(() => setRunning(false))
  }

  const stopFlood = () => {
    runningRef.current = false
    setRunning(false)
  }

  return (
    <div className="settings-stack">
      <section className="settings-block">
        <div className="settings-block-title">Appearance</div>
        <div className="settings-block-copy">Choose your dashboard theme</div>
        <div className="theme-picker">
          {themes.map(t => (
            <button
              key={t}
              className={`theme-picker-btn${theme === t ? ' active' : ''}`}
              onClick={() => onThemeDirect(t)}
            >
              <span className={`theme-picker-swatch theme-picker-swatch--${t}`} />
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </section>

      <section className="settings-block">
        <div className="settings-block-title">
          <Link2 size={14} /> Railway backend
        </div>
        <div className="settings-block-copy">
          In Railway open your service → Settings → Networking → generate a public domain.
          Paste that URL here (example: https://ghostnet-production.up.railway.app).
          You can also set VITE_API_URL on Vercel and redeploy; this field overrides it on this browser.
        </div>
        <input
          className="settings-url-input"
          value={apiInput}
          onChange={e => setApiInput(e.target.value)}
          placeholder={getDefaultApiUrl() || 'https://your-app.up.railway.app'}
        />
        <div className="settings-actions">
          <button className="settings-btn" type="button" onClick={testApi}>Test connection</button>
          <button className="settings-btn primary" type="button" onClick={saveApi}>Save and reconnect</button>
        </div>
        {pingState && <div className="settings-ping">{pingState}</div>}
      </section>

      <section className="settings-block">
        <div className="settings-block-title">
          <Flame size={14} /> Load test (no terminal)
        </div>
        <div className="settings-block-copy">
          This hits Railway <code>/ingest/telemetry</code> from this browser — same path Locust uses.
          For heavier Locust stats, double-click <code>start-locust.bat</code> on your PC, then use
          <a href="http://localhost:8089" target="_blank" rel="noreferrer"> http://localhost:8089</a>.
        </div>
        <div className="settings-actions">
          <label className="settings-field">
            Node
            <input className="attack-input" value={nodeId} onChange={e => setNodeId(e.target.value)} />
          </label>
          <label className="settings-field">
            Virtual users
            <input
              className="attack-input"
              type="number"
              min="1"
              max="50"
              value={users}
              onChange={e => setUsers(e.target.value)}
            />
          </label>
        </div>
        <div className="settings-actions">
          <button className="sim-btn normal" type="button" onClick={() => injectOnce('NORMAL')}>
            <Activity size={12} /> Normal ping
          </button>
          <button className="sim-btn attack" type="button" onClick={() => injectOnce('HTTP_FLOOD')}>
            <Flame size={12} /> Single flood packet
          </button>
          {running ? (
            <button className="settings-btn danger" type="button" onClick={stopFlood}>
              <Square size={12} /> Stop load test
            </button>
          ) : (
            <button className="settings-btn primary" type="button" onClick={startFlood}>
              <Play size={12} /> Start load test
            </button>
          )}
        </div>
        <div className="settings-ping">
          Sent {sent} · Errors {errors}
          {running ? ' · running' : ''}
        </div>
      </section>
    </div>
  )
}
