# ---- Stage 1: Build Frontend ----
FROM node:20-bookworm-slim AS frontend-build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- Stage 2: Final Serve ----
FROM nginx:1.27-bookworm

# Install Node.js for backend server
RUN apt-get update && apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy nginx config + SSL certs
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY cert/ /etc/nginx/ssl/

# Copy frontend build products
COPY --from=frontend-build /app/dist /usr/share/nginx/html

# Copy unified server code & install deps
COPY cloud-functions/api/ /app/server/
COPY package*.json /app/
RUN cd /app && npm ci --omit=dev

# Copy entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 443

CMD ["/entrypoint.sh"]
