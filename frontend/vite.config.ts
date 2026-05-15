import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const backend = (import.meta as { env?: Record<string, string> }).env?.VITE_DEV_API_PROXY_TARGET ?? 'http://localhost:8080'

const apiProxy = {
  '/api': { target: backend, changeOrigin: true },
  '/user': { target: backend, changeOrigin: true },
  '/public': { target: backend, changeOrigin: true },
  '/admin': { target: backend, changeOrigin: true },
} as const

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { ...apiProxy },
  },
  // `vite preview` does not reuse `server.proxy` in all versions; keep `/api` routed to Spring Boot.
  preview: {
    proxy: { ...apiProxy },
  },
})
