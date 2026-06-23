#!/bin/sh

# 启动后端 (Express)
echo "Starting backend server..."
cd /app/backend && node server.js &

# 启动前端 (Nginx)
echo "Starting nginx..."
nginx -g "daemon off;"
