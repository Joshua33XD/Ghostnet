// =============================================================================
// GhostNet Network IDS — App.jsx
// 3-View Architecture: Overview, Alerts, Devices + Packet Drill-Down
// =============================================================================
import React, { useState, useCallback } from 'react'
import { AnimatePresence, motion, MotionConfig } from 'framer-motion'
import { useGhostNet } from './useGhostNet.js'
import Header from './components/Header.jsx'
import Sidebar from './components/Sidebar.jsx'
import OverviewView from './components/OverviewView.jsx'
import AlertsView from './components/AlertsView.jsx'
import DevicesView from './components/DevicesView.jsx'
import DetectionToast from './components/DetectionToast.jsx'
import PacketDrillDownModal from './components/PacketDrillDownModal.jsx'
import { initTheme, cycleTheme, applyTheme, THEMES } from './utils/theme.js'
import { getApiUrl } from './apiConfig.js'
import { viewTransition } from './motion.js'

export default function App() {
  const {
    devices,
    stats,
    alerts,
    events,
    wsStatus,
    isLoading,
    releaseDevice,
    quarantineDevice,
    fetchCaptureFiles,
    inspectPackets,
  } = useGhostNet()

  const [theme, setTheme] = useState(initTheme)
  const [currentView, setCurrentView] = useState('overview') // 'overview' | 'alerts' | 'devices'
  const [selectedDeviceIp, setSelectedDeviceIp] = useState(null)
  const [packetModalOpen, setPacketModalOpen] = useState(false)
  const [packetModalIp, setPacketModalIp] = useState('')

  const toggleTheme = useCallback(() => {
    setTheme(prev => cycleTheme(prev))
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
    <MotionConfig reducedMotion={import.meta.env.PROD ? 'user' : 'never'}>
      <div className="app-root">
        <Header
          wsStatus={wsStatus}
          nodeCount={devices.length}
          eventCount={events.length}
          theme={theme}
          onThemeToggle={toggleTheme}
          networkState={networkState}
        />

        <DetectionToast events={events} />

        <div className="app-layout">
          <Sidebar
            currentView={currentView}
            onViewChange={setCurrentView}
            devices={devices}
            alertCount={alerts.length}
          />

          <main className="app-main" id="main-content" tabIndex={-1}>
            {!apiConfigured && (
              <div className="api-missing-banner" role="alert">
                API endpoint not configured. Set VITE_GHOSTNET_API_URL or use local backend.
              </div>
            )}

            <div className="main-scroll">
              <AnimatePresence mode="wait">
                {currentView === 'overview' && (
                  <motion.div key="overview" {...viewTransition} style={{ display: 'contents' }}>
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
                  <motion.div key="alerts" {...viewTransition} style={{ display: 'contents' }}>
                    <AlertsView
                      alerts={alerts}
                      devices={devices}
                      onSelectDevice={handleSelectDeviceFromAlert}
                      isLoading={isLoading}
                    />
                  </motion.div>
                )}

                {currentView === 'devices' && (
                  <motion.div key="devices" {...viewTransition} style={{ display: 'contents' }}>
                    <DevicesView
                      devices={devices}
                      onRelease={releaseDevice}
                      onQuarantine={quarantineDevice}
                      onOpenPacketDrillDown={handleOpenPacketDrillDown}
                      isLoading={isLoading}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </main>
        </div>

        {/* Phase 3: Packet Drill-Down Modal */}
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
