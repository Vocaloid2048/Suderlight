# ---- Stage 1: Build frontend + prepare backend ----
FROM node:20-bookworm-slim AS build

WORKDIR /app

# Build frontend
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_SIGNATURE_SECRET
ENV VITE_SIGNATURE_SECRET=$VITE_SIGNATURE_SECRET
RUN npm run build

# Install backend production dependencies
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci --only=production

# ---- Stage 2: Serve (nginx + node backend) ----
FROM node:20-bookworm-slim

# Install nginx
RUN apt-get update && apt-get install -y nginx && rm -rf /var/lib/apt/lists/*

# Copy nginx config
COPY nginx.conf /etc/nginx/sites-available/default

# Remove default nginx site if exists, ensure our config is active
RUN rm -f /etc/nginx/sites-enabled/default && \
    ln -sf /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default

# Copy frontend build output
COPY --from=build /app/dist /usr/share/nginx/html

# Copy backend
COPY backend/ /app/backend/
COPY --from=build /app/backend/node_modules /app/backend/node_modules

# Copy entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Create non-root user for backend
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 --gid 1001 nodejs

# Create data directory for backend persistence
RUN mkdir -p /app/backend/data && chown nodejs:nodejs /app/backend/data

EXPOSE 80

ENV NODE_ENV=production
ENV PORT=4000

CMD ["/entrypoint.sh"]
