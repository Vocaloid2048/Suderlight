# ---- Stage 1: Build ----
FROM node:20-bookworm-slim AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ARG VITE_SIGNATURE_SECRET
ENV VITE_SIGNATURE_SECRET=$VITE_SIGNATURE_SECRET

RUN npm run build


# ---- Stage 2: Serve (nginx) ----
FROM nginx:1.27-bookworm

# 复制 nginx 配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 复制构建产物
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
