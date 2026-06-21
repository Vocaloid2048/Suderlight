const crypto = require('crypto');

/**
 * 为每个请求生成唯一 requestId，注入 req.id 并通过响应头返回。
 */
function requestIdMiddleware(req, res, next) {
  req.id = crypto.randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
}

module.exports = requestIdMiddleware;
