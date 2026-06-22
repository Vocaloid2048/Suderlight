const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const config = require('./config');
const logger = require('./middleware/logger');
const requestIdMiddleware = require('./middleware/requestId');
const playerIdMiddleware = require('./middleware/playerId');
const { AppError } = require('./middleware/errors');

const chatRoutes = require('./routes/chat');
const npcRoutes = require('./routes/npc');
const investigationRoutes = require('./routes/investigation');
const saveRoutes = require('./routes/save');
const innerWorldRoutes = require('./routes/innerWorld');
const dictionaryRoutes = require('./routes/dictionary');
const worldbookRoutes = require('./routes/worldbook');


const app = express();

// ---- Security & Infrastructure Middleware ----
app.set('trust proxy', 1); // Docker 反向代理后面
app.use(requestIdMiddleware);
app.use(playerIdMiddleware); // 提取 X-Player-Id → req.playerId
app.use(helmet());
app.use(cors({ origin: config.cors.origin, methods: ['GET', 'POST'], allowedHeaders: ['Content-Type', 'X-Player-Id', 'X-Request-Id'] }));
app.use(express.json({ limit: '50kb' })); // 限制请求体大小

// ---- Rate Limiting ----
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分钟窗口
  max: 300,                 // 最多 300 个请求
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      code: 'RATE_LIMITED',
      error: 'Too many requests. Please wait a moment.',
      request_id: req.id,
    });
  },
});
app.use(globalLimiter);

// LLM 端点更严格的限流
const llmLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,                  // 每分钟最多 15 次 LLM 调用
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      code: 'RATE_LIMITED',
      error: 'Too many LLM requests. Please wait a moment.',
      request_id: req.id,
    });
  },
});

// ---- Request Logging ----
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    logger.info({ req, res, duration_ms: Date.now() - start }, 'request completed');
  });
  next();
});

// ---- Health Check ----
app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'glimmer-city-backend', version: '0.1.0' });
});

// ---- Routes ----
app.use('/api/chat', authSignatureMiddleware, llmLimiter, chatRoutes);
app.use('/api/npc', authSignatureMiddleware, npcRoutes);
app.use('/api/investigation', authSignatureMiddleware, investigationRoutes);
app.use('/api/save', authSignatureMiddleware, saveRoutes);
app.use('/api/inner-world', authSignatureMiddleware, innerWorldRoutes);
app.use('/api/worldbook', authSignatureMiddleware, worldbookRoutes);
app.use('/api/dictionary', dictionaryRoutes);

// ---- 404 Catch-all ----
app.use((req, res) => {
  res.status(404).json({ code: 'NOT_FOUND', error: 'Route not found', request_id: req.id });
});

// ---- Global Error Handler ----
app.use((error, req, res, _next) => {
  if (error instanceof AppError && error.isOperational) {
    // 已知/预期错误
    logger.warn({ err: error, request_id: req.id }, 'operational error');
    return res.status(error.status).json({
      code: error.code,
      status: error.status,
      detail: error.message,
      errors: error.errors || undefined,
      request_id: req.id,
    });
  }

  // 未预期/编程错误
  logger.error({ err: error, request_id: req.id }, 'unexpected error');
  const isProduction = config.nodeEnv === 'production';
  res.status(500).json({
    code: 'INTERNAL_ERROR',
    status: 500,
    detail: isProduction ? 'Internal server error' : error.message,
    request_id: req.id,
  });
});

// ---- Start Server with Graceful Shutdown ----
const server = app.listen(config.port, () => {
  logger.info({ port: config.port, env: config.nodeEnv }, 'Glimmer City backend started');
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received — shutting down gracefully');
  server.close((err) => {
    if (err) {
      logger.error({ err }, 'error during graceful shutdown');
      process.exit(1);
    }
    logger.info('Server closed');
    process.exit(0);
  });
  // 10 秒超时强制退出
  setTimeout(() => {
    logger.error('Graceful shutdown timed out — forcing exit');
    process.exit(1);
  }, 10000);
});
