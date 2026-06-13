/**
 * 球员身份中间件 —— 提取 X-Player-Id 头，附加到 req.playerId
 * 每个球员对应独立的存档和记忆空间
 */
const logger = require('./logger');

const PLAYER_ID_HEADER = 'x-player-id';
const VALID_ID = /^[a-zA-Z0-9_-]{4,64}$/;

function playerIdMiddleware(req, res, next) {
  const id = (req.headers[PLAYER_ID_HEADER] || '').trim();

  if (!id || !VALID_ID.test(id)) {
    // 如果缺失或格式错误，记录警告但继续（向后兼容公开路由如 /api/health）
    if (req.path !== '/api/health') {
      logger.warn({ path: req.path, rawId: id }, 'missing or invalid player-id header');
    }
    req.playerId = null;
    return next();
  }

  req.playerId = id;
  next();
}

module.exports = playerIdMiddleware;
