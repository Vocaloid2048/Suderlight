import crypto from 'node:crypto';
import config from '../config.js';
import { UnauthorizedError } from './errors.js';

function authSignatureMiddleware(req, res, next) {
  const playerId = req.playerId;
  const signature = String(req.headers['x-player-signature'] || '').trim();
  const timestampRaw = String(req.headers['x-timestamp'] || '').trim();

  if (!playerId) return next(new UnauthorizedError('Missing X-Player-Id header'));
  if (!signature || !timestampRaw) return next(new UnauthorizedError('Missing signature headers'));

  const timestamp = parseInt(timestampRaw, 10);
  if (!timestamp || Math.abs(Date.now() - timestamp) > config.auth.maxSkewMs) {
    return next(new UnauthorizedError('Request signature expired'));
  }

  const expected = crypto.createHmac('sha256', config.auth.signatureSecret)
    .update(`${playerId}.${timestamp}`)
    .digest('hex');

  const a = Buffer.from(String(signature), 'utf8');
  const b = Buffer.from(String(expected), 'utf8');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return next(new UnauthorizedError('Invalid request signature'));
  }

  next();
}

export default authSignatureMiddleware;
