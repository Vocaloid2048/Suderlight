import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production'

  // EdgeOne Pages 部署：後端 API 由 Node Functions 處理，部署在同一域名下
  // 開發環境仍使用 proxy 轉發到本地 Express 服務器
  const backendTarget = isProduction
    ? (process.env.BACKEND_URL || 'http://backend:4000') 
    : (process.env.BACKEND_URL || 'http://127.0.0.1:4000')

  const proxyOptions = {
    target: backendTarget,
    changeOrigin: true,
    configure: (proxy: any) => {
      proxy.on('proxyReq', (proxyReq: any) => {
        proxyReq.removeHeader('origin');
        proxyReq.removeHeader('referer');
      });
    }
  }

  return {
    plugins: [react()],
    // EdgeOne Pages 部署時使用 '/' 作為 base（同一域名）
    base: isProduction ? '/' : './',
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
    },
    // 在 EdgeOne Pages 上，前端靜態文件由平台託管
    // /api 路由由 Node Functions 自動處理，不需要 proxy
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
