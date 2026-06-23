import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production'

  // 設定 Express 後端服務的 proxy 轉發目標
  const backendTarget = isProduction
    ? (process.env.BACKEND_URL || 'http://backend:4000') 
    : (process.env.BACKEND_URL || 'http://127.0.0.1:4000')

  const proxyOptions = {
    target: backendTarget,
    changeOrigin: true,
    configure: (proxy: any) => {
      proxy.on('proxyReq', (proxyReq: any) => {
        // 確保轉發正確
        proxyReq.removeHeader('origin');
        proxyReq.removeHeader('referer');
      });
    }
  }

  return {
    plugins: [react()],
    base: './',
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
    },
    preview: {
      port: 80,
      host: true,
      https: false,
      proxy: {
        '/api': proxyOptions
      }
    },
    server: {
      port: 3000,
      https: false,
      proxy: {
        '/api': proxyOptions
      }
    }
  }
})
