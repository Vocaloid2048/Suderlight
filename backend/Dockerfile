FROM node:20-bookworm-slim

# 設定工作目錄
WORKDIR /app

# 複製 package.json 和 package-lock.json (如果存在)
COPY package*.json ./

# 安裝依賴套件
RUN npm install

# 複製所有原始碼
COPY . .

# 預設對外曝露的 Port
ENV PORT=4000
EXPOSE 4000

# 啟動命令
CMD ["node", "server.js"]
