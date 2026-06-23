#!/bin/sh
# Start Express backend in background
cd /app/backend
NODE_ENV=production PORT=4000 node server.js &
BACKEND_PID=$!

# Start nginx in foreground
nginx -g 'daemon off;'
