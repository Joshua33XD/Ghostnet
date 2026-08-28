import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/nodes':   { target: 'http://localhost:8000', changeOrigin: true },
      '/alerts':  { target: 'http://localhost:8000', changeOrigin: true },
      '/ingest':  { target: 'http://localhost:8000', changeOrigin: true },
      '/ws':      { target: 'ws://localhost:8000',   changeOrigin: true, ws: true },
    },
  },
})
