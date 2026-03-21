import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const sharedServerConfig = {
  host: '0.0.0.0',
  port: 3000,
  allowedHosts: ['device.menusifu.cloud'],
  proxy: {
    '/api': {
      target: 'http://localhost:5000',
      changeOrigin: true,
    },
    '/api/linux/upgrade/stream': {
      target: 'http://localhost:5000',
      changeOrigin: true,
      configure: (proxy, _options) => {
        proxy.on('proxyReq', (proxyReq, _req, _res) => {
          proxyReq.setHeader('Connection', 'keep-alive')
          proxyReq.setHeader('Cache-Control', 'no-cache')
        })
      },
    },
    '/uploads': {
      target: 'http://localhost:5000',
      changeOrigin: true,
    },
    '/ws': {
      target: 'ws://localhost:5000',
      ws: true,
    },
  },
}

export default defineConfig({
  plugins: [react()],
  server: sharedServerConfig,
  preview: sharedServerConfig,
})
