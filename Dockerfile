FROM node:20-bookworm-slim

# 設定工作目錄
WORKDIR /app

# 複製 package.json 和 package-lock.json
COPY package*.json ./

# 安裝依賴套件
RUN npm install

# 複製所有原始碼
COPY . .

# 編譯專案
RUN npm run build

# 根據環境變數執行 preview 伺服器
# 預設對外曝露的 Port
ENV PORT=443
EXPOSE 443

# 啟動命令，使用 vite preview 並綁定 host 與 port
CMD ["sh", "-c", "npm run preview -- --host 0.0.0.0 --port ${PORT}"]
