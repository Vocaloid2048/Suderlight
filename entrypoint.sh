#!/bin/sh

# 启动后端 (Express，统一代码库)
echo "[entrypoint] Starting backend server..."
cd /app/server && STORAGE_MODE=fs API_PREFIX=/api PORT=4000 node index.js &
SERVER_PID=$!

# 等待后端就绪 (最多 30 秒)
echo "[entrypoint] Waiting for backend to be ready..."
READY=0
for i in $(seq 1 30); do
    if curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:4000/health | grep -q 200; then
        echo "[entrypoint] Backend is ready!"
        READY=1
        break
    fi
    # 检查进程是否还活着
    if ! kill -0 $SERVER_PID 2>/dev/null; then
        echo "[entrypoint] ERROR: Backend process died unexpectedly!"
        exit 1
    fi
    sleep 1
done

if [ "$READY" = "0" ]; then
    echo "[entrypoint] ERROR: Backend failed to start within 30s!"
    exit 1
fi

# 启动前端 (Nginx)
echo "[entrypoint] Starting nginx..."
exec nginx -g "daemon off;"
