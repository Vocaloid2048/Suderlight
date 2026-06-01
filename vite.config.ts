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

  // 設定 SillyTavern 的 proxy 轉發目標
  // 在 Docker 中 (production 模式)，使用 host.docker.internal 指向主機上的 SillyTavern
  // 在本機開發時 (development 模式)，使用 127.0.0.1 指向本機上的 SillyTavern
  const sillyTavernTarget = isProduction 
    ? (process.env.SILLY_TAVERN_URL || 'http://host.docker.internal:8000') 
    : (process.env.SILLY_TAVERN_URL || 'http://127.0.0.1:8000')

  // 設定 proxy 的共用選項
  const proxyOptions = {
    target: sillyTavernTarget,
    changeOrigin: true,
    configure: (proxy: any) => {
      proxy.on('proxyReq', (proxyReq: any) => {
        // 移除從前端瀏覽器傳來的 Origin 與 Referer，
        // 讓 API 轉發時避免 403 Forbidden 錯誤
        proxyReq.removeHeader('origin');
        proxyReq.removeHeader('referer');

        // 🔑 方案 2 與 方案 3 的全相容設計：
        // 如果您在 Docker 中找不到並關閉密碼 (無法使用方案 3)，請在此處或環境變數中設定您的帳號密碼。
        // 若 SillyTavern 已關閉密碼驗證 (成功使用方案 3)，則此處不填寫即可自動跳過，安全無副作用。
        const username = process.env.SILLY_TAVERN_USERNAME || ''; // 可在此填入您的 SillyTavern 帳號，例如 'admin'
        const password = process.env.SILLY_TAVERN_PASSWORD || ''; // 可在此填入您的 SillyTavern 密碼，例如 '123456'
        if (username && password) {
          const auth = Buffer.from(`${username}:${password}`).toString('base64');
          proxyReq.setHeader('Authorization', `Basic ${auth}`);
        }
      });
    }
  }

  return {
    plugins: [react()],
    preview: {
      port: 8483,
      host: true,
      // 如果是 production 且讀取到憑證，則啟用 https
      https: httpsConfig,
      proxy: {
        '/api': proxyOptions
      }
    },
    server: {
      port: 3000,
      // Development 預設使用 HTTP，不需要 httpsConfig
      https: false,
      proxy: {
        '/api': proxyOptions
      }
    }
  }
})
