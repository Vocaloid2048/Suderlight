const crypto = require('crypto');
const config = require('../config');
const { UnauthorizedError } = require('./errors');

const PLAYER_ID_HEADER = 'x-player-id';
const PLAYER_SIGNATURE_HEADER = 'x-player-signature';
const TIMESTAMP_HEADER = 'x-timestamp';

function buildPayload(playerId, timestamp) {
  return `${playerId}.${timestamp}`;
}

function signPayload(payload, secret) {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

function safeEqual(a, b) {
  const aa = Buffer.from(String(a || ''), 'utf8');
  const bb = Buffer.from(String(b || ''), 'utf8');
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

function authSignatureMiddleware(req, _res, next) {
  const playerId = String(req.headers[PLAYER_ID_HEADER] || '').trim();
  const signature = String(req.headers[PLAYER_SIGNATURE_HEADER] || '').trim();
  const timestampRaw = String(req.headers[TIMESTAMP_HEADER] || '').trim();

  if (!playerId) {
    return next(new UnauthorizedError('Missing X-Player-Id header'));
  }

  if (!signature || !timestampRaw) {
    return next(new UnauthorizedError('Missing signature headers'));
  }

  const timestamp = Number(timestampRaw);
  if (!Number.isFinite(timestamp)) {
    return next(new UnauthorizedError('Invalid X-Timestamp header'));
  }

  const now = Date.now();
  if (Math.abs(now - timestamp) > config.auth.maxSkewMs) {
    return next(new UnauthorizedError('Request signature expired'));
  }

  const payload = buildPayload(playerId, timestamp);
  const expected = signPayload(payload, config.auth.signatureSecret);

  if (!safeEqual(signature, expected)) {
    return next(new UnauthorizedError('Invalid request signature'));
  }

  return next();
}

module.exports = authSignatureMiddleware;
