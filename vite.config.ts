import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  // 當執行 npm run preview 時 (Docker 預設行為)，為 production 模式
  const isProduction = mode === 'production'

  // 在 Production 下設定 HTTPS 憑證 (如果存在)
  let httpsConfig = undefined
  if (isProduction) {
    try {
      httpsConfig = {
        key: fs.readFileSync(path.resolve(__dirname, 'cert/key.pem')),
        cert: fs.readFileSync(path.resolve(__dirname, 'cert/cert.pem')),
      }
    } catch (err) {
      console.warn('Production 模式下找不到憑證 (cert/key.pem 或 cert/cert.pem)，將退回使用 HTTP。請確保已將憑證放置於 ./cert 資料夾內。')
    }
  }

  return {
    plugins: [react()],
    preview: {
      port: 443,
      host: true,
      // 如果是 production 且讀取到憑證，則啟用 https
      https: httpsConfig
    },
    server: {
      port: 3000,
      // Development 預設使用 HTTP，不需要 httpsConfig
      https: false 
    }
  }
})
