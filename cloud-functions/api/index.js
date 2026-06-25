/**
 * 本地 / Docker 部署入口
 *
 * 用法:
 *   node cloud-functions/api/index.js       (默认 STORAGE_MODE=fs, API_PREFIX=/api)
 *   STORAGE_MODE=memory node ...             (内存模式，非持久化)
 *
 * Docker 部署时 nginx 将 /api/* 反代到此服务 (:4000)
 */
import 'dotenv/config';  // 加载项目根目录的 .env

import createApp from './app.js';
import logger from './middleware/logger.js';

const PORT = parseInt(process.env.PORT || '4000', 10);

// 本地/Docker 默认启用文件系统存储和 /api 前缀
if (!process.env.STORAGE_MODE) process.env.STORAGE_MODE = 'fs';
if (!process.env.API_PREFIX) process.env.API_PREFIX = '/api';

const app = createApp();

const server = app.listen(PORT, () => {
  logger.info({
    port: PORT,
    storage: process.env.STORAGE_MODE,
    apiPrefix: process.env.API_PREFIX,
  }, 'Server started');
});

// 优雅退出
process.on('SIGTERM', () => {
  logger.info('SIGTERM received — shutting down');
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10000);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received — shutting down');
  server.close(() => process.exit(0));
});
