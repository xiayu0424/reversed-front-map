import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // 監聽所有網路介面，讓 LAN 與 tailscale funnel 都連得進來
    host: true,
    // 透過 tailscale funnel 存取時 Host header 會是 *.ts.net
    allowedHosts: ['.ts.net'],
    proxy: {
      // String shorthand: http://localhost:5173/api -> http://localhost:3001/api
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      // WebSocket 也走同源 proxy，手機從外網（funnel）才連得到後端
      '/ws': {
        target: 'ws://localhost:3001',
        ws: true,
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/ws/, '') || '/',
      },
    }
  }
})
