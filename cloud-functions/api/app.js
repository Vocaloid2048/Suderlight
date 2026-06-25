/**
 * Express App 工厂 —— 统一构建 API 应用
 *
 * 通过 API_PREFIX 环境变量控制路由前缀:
 *   - EdgeOne:    不设置 → 路由为 /chat, /npc, ...
 *   - 本地/Docker: 设置为 /api → 路由为 /api/chat, /api/npc, ...
 */
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

// ---- 配置 ----
import config from './config.js';

// ---- 中间件 ----
import logger from './middleware/logger.js';
import requestIdMiddleware from './middleware/requestId.js';
import playerIdMiddleware from './middleware/playerId.js';
import authSignatureMiddleware from './middleware/authSignature.js';

// ---- 路由 ----
import chatRoutes from './routes/chat.js';
import npcRoutes from './routes/npc.js';
import saveRoutes from './routes/save.js';
import investigationRoutes from './routes/investigation.js';
import innerWorldRoutes from './routes/innerWorld.js';
import dictionaryRoutes from './routes/dictionary.js';
import worldbookRoutes from './routes/worldbook.js';

// ---- 静态数据初始化 ----
import saveService from './services/saveService.js';
import memoryStore from './services/store.js';
import INLINE_WORLDBOOK from './data/worldbook.js';
import INLINE_INNER_WORLDS from './data/innerWorlds.js';
import INLINE_DICTIONARY from './data/dictionary.js';
import { readWorldbook, readInnerWorlds, readDictionary } from './services/persistence.js';

function loadStaticData() {
  try {
    saveService.init(); // NPCs & Clues

    // Worldbook: 优先从持久化层加载
    const persistedWB = readWorldbook();
    if (persistedWB?.entries?.length > 0) {
      memoryStore.worldbook = persistedWB;
    } else if (INLINE_WORLDBOOK) {
      memoryStore.worldbook = INLINE_WORLDBOOK;
    }

    // Inner Worlds
    const persistedIW = readInnerWorlds();
    if (Object.keys(persistedIW).length > 0) {
      memoryStore.innerWorlds = persistedIW;
    } else if (INLINE_INNER_WORLDS) {
      memoryStore.innerWorlds = INLINE_INNER_WORLDS;
    }

    // Dictionary
    const persistedDict = readDictionary();
    if (persistedDict.length > 0) {
      memoryStore.dictionary = persistedDict;
    } else if (INLINE_DICTIONARY) {
      memoryStore.dictionary = INLINE_DICTIONARY;
    }

    logger.info('Static data loaded');
  } catch (e) { logger.warn('Static data load failed:', e.message); }
}

/**
 * 构建 Express 应用
 * @returns {import('express').Express}
 */
function createApp() {
  loadStaticData();

  const app = express();
  const apiPrefix = process.env.API_PREFIX || '';

  // Infrastructure middleware
  app.use(requestIdMiddleware);
  app.use(playerIdMiddleware);
  app.use(helmet());
  app.use(cors({
    origin: config.cors.origin,
    credentials: true,
    allowedHeaders: ['Content-Type', 'X-Player-Id', 'X-Request-Id', 'X-Timestamp', 'X-Player-Signature'],
  }));
  app.use(express.json({ limit: '50kb' }));

  // Global rate limit
  app.use(rateLimit({
    windowMs: 60 * 1000, max: 100,
    standardHeaders: true, legacyHeaders: false,
  }));

  // Request logging
  app.use((req, res, next) => {
    logger.info(`${req.method} ${req.url}`);
    next();
  });

  // LLM rate limiter
  const llmLimiter = rateLimit({
    windowMs: 60 * 1000, max: 15,
    standardHeaders: true, legacyHeaders: false,
    message: { code: 'RATE_LIMITED', error: 'Too many requests, please slow down' },
  });

  // ---- Health (同时挂载在根和 apiPrefix 下) ----
  app.get(`${apiPrefix}/health`, (req, res) => {
    res.json({ ok: true, service: 'glimmer-city-backend', version: '0.5.0-unified' });
  });
  if (apiPrefix) {
    app.get('/health', (req, res) => {
      res.json({ ok: true, service: 'glimmer-city-backend', version: '0.5.0-unified' });
    });
  }

  // ---- Routes ----
  app.use(`${apiPrefix}/chat`, authSignatureMiddleware, llmLimiter, chatRoutes);
  app.use(`${apiPrefix}/npc`, authSignatureMiddleware, npcRoutes);
  app.use(`${apiPrefix}/save`, authSignatureMiddleware, saveRoutes);
  app.use(`${apiPrefix}/investigation`, authSignatureMiddleware, investigationRoutes);
  app.use(`${apiPrefix}/inner-world`, authSignatureMiddleware, innerWorldRoutes);
  app.use(`${apiPrefix}/dictionary`, dictionaryRoutes);
  app.use(`${apiPrefix}/worldbook`, authSignatureMiddleware, worldbookRoutes);

  // ---- 404 ----
  app.use((req, res) => {
    res.status(404).json({
      code: 'NOT_FOUND', status: 404,
      detail: `Route not found: ${req.method} ${req.url}`,
      request_id: req.id,
    });
  });

  // ---- Error Handler ----
  app.use((error, req, res, _next) => {
    const status = error.status || 500;
    const code = error.code || 'INTERNAL_ERROR';
    logger.error(`[${req.id}] ${status} ${code}: ${error.message}`);
    res.status(status).json({ code, status, detail: error.message, request_id: req.id });
  });

  return app;
}

export default createApp;
