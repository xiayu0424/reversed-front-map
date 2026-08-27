import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// dev server 與 preview server 共用同一組 proxy，
// 這樣不管對外暴露哪一個，前端都只需要用同源相對路徑。
const proxy = {
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
    rewrite: (p: string) => p.replace(/^\/ws/, '') || '/',
  },
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // 監聽所有網路介面，讓 LAN 與 tailscale funnel 都連得進來
    host: true,
    // 透過 tailscale funnel 存取時 Host header 會是 *.ts.net
    allowedHosts: ['.ts.net'],
    proxy,
  },
  // 對外（funnel / 行動網路）請用 preview 提供 production build：
  // dev server 會拆成數百個 module 請求，在高延遲連線上載不完會停在白畫面。
  preview: {
    host: true,
    port: 4173,
    allowedHosts: ['.ts.net'],
    proxy,
  },
})
