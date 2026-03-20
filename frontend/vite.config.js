import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
	  // 添加这一行，允许特定主机访问
    allowedHosts: ['device.menusifu.cloud'], // 将花生壳域名和您的自定义域名都加进去
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true
      },
      // SSE 代理 - 需要特殊配置
      '/api/linux/upgrade/stream': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        configure: (proxy, _options) => {
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            // SSE 需要保持连接
            proxyReq.setHeader('Connection', 'keep-alive');
            proxyReq.setHeader('Cache-Control', 'no-cache');
          });
        }
      },
      '/uploads': {
        target: 'http://localhost:5000',
        changeOrigin: true
      },
      '/ws': {
        target: 'ws://localhost:5000',
        ws: true
      }
    }
  }
})
