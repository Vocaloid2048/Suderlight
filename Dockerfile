# ---- Stage 1: Build Frontend ----
FROM node:20-bookworm-slim AS frontend-build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- Stage 2: Final Serve ----
FROM nginx:1.27-bookworm

# Install Node.js + openssl (for self-signed cert)
RUN apt-get update && apt-get install -y curl openssl && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy frontend build products
COPY --from=frontend-build /app/dist /usr/share/nginx/html

# Copy unified server code & install deps
COPY cloud-functions/api/ /app/server/
COPY package*.json /app/
RUN cd /app && npm ci --omit=dev

# Copy entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 80
EXPOSE 443

CMD ["/entrypoint.sh"]
