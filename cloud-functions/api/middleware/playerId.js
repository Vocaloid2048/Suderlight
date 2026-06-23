/**
 * 球员身份中间件 —— 提取 X-Player-Id 头，附加到 req.playerId
 */
function playerIdMiddleware(req, res, next) {
  req.playerId = String(req.headers['x-player-id'] || '').trim() || null;
  next();
}

export default playerIdMiddleware;
