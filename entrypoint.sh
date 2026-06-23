#!/bin/sh

# 启动后端 (Express，统一代码库)
echo "Starting backend server..."
cd /app/server && STORAGE_MODE=fs API_PREFIX=/api PORT=4000 node index.js &

# 启动前端 (Nginx)
echo "Starting nginx..."
nginx -g "daemon off;"
