import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const apiTarget = process.env.VITE_API_TARGET ?? 'http://localhost:8787'
const devHost = process.env.VITE_HOST
const devPort = Number(process.env.VITE_DEV_PORT ?? 5173)
const strictPort = process.env.VITE_STRICT_PORT === 'true'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: devHost,
    port: devPort,
    strictPort,
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
      },
      '/health': apiTarget,
    },
  },
})
