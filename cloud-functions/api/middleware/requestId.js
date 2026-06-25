/**
 * 为每个请求生成唯一 requestId，注入 req.id 并通过响应头返回。
 */
function requestIdMiddleware(req, res, next) {
  req.id = `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  res.setHeader('X-Request-Id', req.id);
  next();
}

export default requestIdMiddleware;
