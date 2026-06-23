# ---- Stage 1: Build Frontend ----
FROM node:20-bookworm-slim AS frontend-build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

ARG VITE_SIGNATURE_SECRET
ENV VITE_SIGNATURE_SECRET=$VITE_SIGNATURE_SECRET

RUN npm run build

# ---- Stage 2: Install Backend Dependencies ----
FROM node:20-bookworm-slim AS backend-deps
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci --only=production

# ---- Stage 3: Final Serve ----
FROM nginx:1.27-bookworm

# Install Node.js
RUN apt-get update && apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy frontend build products
COPY --from=frontend-build /app/dist /usr/share/nginx/html

# Copy backend dependencies and source
COPY --from=backend-deps /app/backend/node_modules /app/backend/node_modules
COPY backend/ /app/backend/

# Copy entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 80

CMD ["/entrypoint.sh"]
