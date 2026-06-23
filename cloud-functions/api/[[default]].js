/**
 * EdgeOne Pages Cloud Functions — 情绪修复师：微光城市
 * cloud-functions/api/[[default]].js — 精简入口，模块化架构
 *
 * 目录结构 (仿 backend/):
 *   config.js                  — 集中化配置
 *   middleware/
 *     requestId.js, playerId.js, authSignature.js, errors.js, logger.js
 *   services/
 *     store.js                 — 共享内存数据存储
 *     npcStateEngine.js        — NPC 状态引擎
 *     memoryService.js         — 对话记忆管理
 *     saveService.js           — 存档管理
 *     worldbookService.js      — 世界书检索与解锁
 *     ghostEngine.js           — 失败 NPC 记录
 *     playerLockService.js     — 玩家操作互斥锁
 *     deepseekService.js       — LLM 对话调用
 *     promptBuilder.js         — System prompt 构建
 *     summaryService.js        — 长期对话摘要生成
 *   routes/
 *     chat.js, npc.js, save.js, investigation.js, innerWorld.js, dictionary.js, worldbook.js
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

// ---- 初始化静态数据 ----
import saveService from './services/saveService.js';
import memoryStore from './services/store.js';
import INLINE_WORLDBOOK from './data/worldbook.js';
import INLINE_INNER_WORLDS from './data/innerWorlds.js';
import INLINE_DICTIONARY from './data/dictionary.js';

function loadStaticData() {
  try {
    saveService.init(); // NPCs & Clues
    if (INLINE_WORLDBOOK) memoryStore.worldbook = INLINE_WORLDBOOK;
    if (INLINE_INNER_WORLDS) memoryStore.innerWorlds = INLINE_INNER_WORLDS;
    if (INLINE_DICTIONARY) memoryStore.dictionary = INLINE_DICTIONARY;
    logger.info('Static data loaded');
  } catch (e) { logger.warn('Static data load failed:', e.message); }
}
loadStaticData();

// ---- Express App ----
const app = express();

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

// ---- Health ----
app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'glimmer-city-backend', version: '0.4.0-modular' });
});

// ---- Routes ----
app.use('/chat', authSignatureMiddleware, llmLimiter, chatRoutes);
app.use('/npc', authSignatureMiddleware, npcRoutes);
app.use('/save', authSignatureMiddleware, saveRoutes);
app.use('/investigation', authSignatureMiddleware, investigationRoutes);
app.use('/inner-world', authSignatureMiddleware, innerWorldRoutes);
app.use('/dictionary', dictionaryRoutes);
app.use('/worldbook', authSignatureMiddleware, worldbookRoutes);

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

export default app;
