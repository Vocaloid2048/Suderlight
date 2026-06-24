#!/bin/sh

# ---- 生成 self-signed 证书 (Cloudflare Full SSL 模式用) ----
CERT_DIR="/etc/nginx/certs"
if [ ! -f "$CERT_DIR/server.crt" ]; then
    echo "[entrypoint] Generating self-signed certificate..."
    mkdir -p "$CERT_DIR"
    openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
        -keyout "$CERT_DIR/server.key" \
        -out "$CERT_DIR/server.crt" \
        -subj "/CN=suderlight" 2>/dev/null
    echo "[entrypoint] Certificate generated."
fi

# ---- 启动后端 (Express) ----
echo "[entrypoint] Starting backend server..."
cd /app/server && STORAGE_MODE=fs API_PREFIX=/api PORT=4000 node index.js &
SERVER_PID=$!

# ---- 等待后端就绪 ----
echo "[entrypoint] Waiting for backend to be ready..."
READY=0
for i in $(seq 1 30); do
    if curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:4000/health | grep -q 200; then
        echo "[entrypoint] Backend is ready!"
        READY=1
        break
    fi
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

# ---- 启动 Nginx (HTTP + HTTPS) ----
echo "[entrypoint] Starting nginx (port 80 + 443)..."
exec nginx -g "daemon off;"
