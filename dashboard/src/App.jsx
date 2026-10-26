import { useCallback, useState, useEffect, useRef } from 'react'
import { AnimatePresence, motion, MotionConfig } from 'framer-motion'
import { useGhostNet } from './useGhostNet.js'
import CommandBar from './components/CommandBar.jsx'
import OverviewView from './components/OverviewView.jsx'
import AlertsView from './components/AlertsView.jsx'
import DevicesView from './components/DevicesView.jsx'
import PcapStudioView from './components/PcapStudioView.jsx'
import PacketDrillDownModal from './components/PacketDrillDownModal.jsx'
import { initTheme, applyTheme } from './utils/theme.js'
import { getApiUrl } from './apiConfig.js'
import { viewTransition } from './motion.js'

// Simple synthesized Web Audio cyber beep
function playCyberAlertSiren() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(880, ctx.currentTime) // A5
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.18)

    gain.gain.setValueAtTime(0.08, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start()
    osc.stop(ctx.currentTime + 0.22)
  } catch (e) {
    // Ignore audio autoplay restrictions
  }
}

export default function App() {
  const {
    devices,
    stats,
    alerts,
    events,
    wsStatus,
    isLoading,
    error,
    releaseDevice,
    quarantineDevice,
    fetchCaptureFiles,
    inspectPackets,
  } = useGhostNet()

  const [theme, setTheme] = useState(initTheme)
  const [currentView, setCurrentView] = useState('overview')
  const [selectedDeviceIp, setSelectedDeviceIp] = useState(null)
  const [packetModalOpen, setPacketModalOpen] = useState(false)
  const [packetModalIp, setPacketModalIp] = useState('')
  const [audioEnabled, setAudioEnabled] = useState(false)

  // Track latest alert to trigger cyber audio chime if enabled
  const lastAlertTimestampRef = useRef(null)
  useEffect(() => {
    if (!audioEnabled || alerts.length === 0) return
    const topAlert = alerts[0]
    if (topAlert && topAlert.timestamp !== lastAlertTimestampRef.current) {
      lastAlertTimestampRef.current = topAlert.timestamp
      if (topAlert.alert?.severity === 1) {
        playCyberAlertSiren()
      }
    }
  }, [alerts, audioEnabled])

  const handleSelectTheme = useCallback((newTheme) => {
    applyTheme(newTheme)
    setTheme(newTheme)
  }, [])

  const handleSelectDeviceFromAlert = useCallback((ip) => {
    setSelectedDeviceIp(ip)
    setCurrentView('devices')
  }, [])

  const handleOpenPacketDrillDown = useCallback((ip = '') => {
    setPacketModalIp(ip)
    setPacketModalOpen(true)
  }, [])

  const quarantinedCount = devices.filter(d => (d.status || '').toUpperCase() === 'QUARANTINED').length
  const suspiciousCount = devices.filter(d => (d.status || '').toUpperCase() === 'SUSPICIOUS').length
  const networkState = quarantinedCount > 0 ? 'recovering' : suspiciousCount > 0 ? 'degraded' : 'healthy'
  const apiConfigured = Boolean(getApiUrl())

  return (
    <MotionConfig reducedMotion="user">
      <div className="wf-app">
        <a className="wf-skip" href="#main-content">Skip to content</a>

        <CommandBar
          currentView={currentView}
          onViewChange={setCurrentView}
          wsStatus={wsStatus}
          nodeCount={devices.length}
          alertCount={alerts.length}
          quarantinedCount={quarantinedCount}
          suspiciousCount={suspiciousCount}
          theme={theme}
          onThemeSelect={handleSelectTheme}
          networkState={networkState}
          audioEnabled={audioEnabled}
          onToggleAudio={() => setAudioEnabled(!audioEnabled)}
          stats={stats}
          onOpenCapture={handleOpenPacketDrillDown}
        />

        <main className="wf-stage" id="main-content" tabIndex={-1}>
          {!apiConfigured && (
            <div className="wf-banner" role="alert">
              API endpoint not configured. Set VITE_API_URL or save a URL from the overflow menu.
            </div>
          )}
          {error && (
            <div className="wf-banner" role="alert">{String(error)}</div>
          )}

          <AnimatePresence mode="wait">
            {currentView === 'overview' && (
              <motion.div key="overview" {...viewTransition}>
                <OverviewView
                  devices={devices}
                  stats={stats}
                  alerts={alerts}
                  events={events}
                  onNavigate={setCurrentView}
                  onSelectDevice={handleSelectDeviceFromAlert}
                  isLoading={isLoading}
                />
              </motion.div>
            )}

            {currentView === 'alerts' && (
              <motion.div key="alerts" {...viewTransition}>
                <AlertsView
                  alerts={alerts}
                  devices={devices}
                  onSelectDevice={handleSelectDeviceFromAlert}
                  isLoading={isLoading}
                />
              </motion.div>
            )}

            {currentView === 'devices' && (
              <motion.div key="devices" {...viewTransition}>
                <DevicesView
                  devices={devices}
                  selectedIp={selectedDeviceIp}
                  onRelease={releaseDevice}
                  onQuarantine={quarantineDevice}
                  onOpenPacketDrillDown={handleOpenPacketDrillDown}
                  isLoading={isLoading}
                />
              </motion.div>
            )}

            {currentView === 'pcap' && (
              <motion.div key="pcap" {...viewTransition}>
                <PcapStudioView
                  fetchCaptureFiles={fetchCaptureFiles}
                  inspectPackets={inspectPackets}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        <PacketDrillDownModal
          isOpen={packetModalOpen}
          onClose={() => setPacketModalOpen(false)}
          initialIp={packetModalIp}
          fetchCaptureFiles={fetchCaptureFiles}
          inspectPackets={inspectPackets}
        />
      </div>
    </MotionConfig>
  )
}
