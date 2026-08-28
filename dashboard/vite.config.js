import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // REST API
      '/nodes': { target: 'http://localhost:8000', changeOrigin: true },
      '/alerts': { target: 'http://localhost:8000', changeOrigin: true },
      // WebSocket — keep as direct ws://localhost:8000/ws/events in the hook
    },
  },
})
