/**
 * 集中化配置 —— 所有 env 统一在此，EdgeOne Cloud Functions 适配
 */
const nodeEnv = process.env.NODE_ENV || 'production';

const config = {
  nodeEnv,
  cors: {
    origin: (process.env.CORS_ORIGIN || '*').split(',').map(s => s.trim()).filter(Boolean),
  },
  auth: {
    signatureSecret: process.env.PLAYER_SIGNATURE_SECRET || 'i-dont-have-enough-credit-to-make-this-game',
    maxSkewMs: parseInt(process.env.PLAYER_SIGNATURE_MAX_SKEW_MS || '300000', 10),
  },
  deepseek: {
    apiKey: process.env.DEEPSEEK_API_KEY,
    model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
  },
};

if (nodeEnv === 'production' && (!config.deepseek.apiKey || config.deepseek.apiKey === 'YOUR_KEY')) {
  console.warn('[Config] WARNING: DEEPSEEK_API_KEY not set.');
}

export default config;
