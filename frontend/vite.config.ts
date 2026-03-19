import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    // Allow requests from any hostname (required for Cloudflare Tunnel / external access)
    // Must be boolean true in Vite 5 — the string 'all' is NOT valid and is treated
    // as a literal hostname, causing "Blocked request" errors for any external domain.
    allowedHosts: true,
    // Proxy API calls and WebSocket connections to the backend
    // The browser NEVER needs to know the backend's port
    proxy: {
      '/api': {
        target: 'http://backend:8000',
        changeOrigin: true,
        ws: true,
      },
      // Explicit WS proxy for the game loop
      '/api/v1/game/play': {
        target: 'http://backend:8000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
})
