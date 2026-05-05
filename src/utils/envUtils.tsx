import React, { createContext, useContext, ReactNode } from 'react';

// 定義環境變數設定的型別
interface EnvConfig {
  isProduction: boolean;
  protocol: string;
  apiBaseUrl: string;
  useHttps: boolean;
}

// 根據 Vite 預設的環境變數判斷 (npm run dev 為 development, npm run build/preview 為 production)
const isProduction = import.meta.env.PROD;

// 設定預設的環境設定檔
export const envConfig: EnvConfig = {
  isProduction,
  // 依照環境給予不同的通訊協定
  protocol: isProduction ? 'https:' : 'http:',
  // 是否強制使用 HTTPS
  useHttps: isProduction,
  // 假設有後端 API 請求，可在此設定對應的基礎網址
  // 生產環境對接 https, 開發環境對接 http
  apiBaseUrl: isProduction 
    ? `https://${window.location.hostname}` // 生產環境預設使用同網域的 HTTPS API
    : `http://localhost:8080`,              // 開發環境的本機 API (可依據需求調整)
};

// 建立 Context，方便全域元件取得當前環境狀態
const EnvContext = createContext<EnvConfig>(envConfig);

interface EnvProviderProps {
  children: ReactNode;
}

// EnvProvider 元件，可包覆在 main.tsx 或 App.tsx 最外層
export const EnvProvider: React.FC<EnvProviderProps> = ({ children }) => {
  return (
    <EnvContext.Provider value={envConfig}>
      {children}
    </EnvContext.Provider>
  );
};

// 自訂 Hook，讓其他元件能夠輕鬆獲取當前的環境設定
export const useEnv = () => {
  return useContext(EnvContext);
};
