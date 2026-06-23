/**
 * 集中化配置 —— 所有 env 统一在此校验，fail-fast。
 * 禁止在业务代码中直接引用 process.env。
 */
function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}. Check your .env file.`);
  }
  return value;
}

const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  cors: {
    origin: (process.env.CORS_ORIGIN || 'http://localhost:3000')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
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

// 生产环境强制校验 DeepSeek key
if (config.nodeEnv === 'production' && (!config.deepseek.apiKey || config.deepseek.apiKey === 'YOUR_KEY')) {
  console.warn('[Config] WARNING: DEEPSEEK_API_KEY not set.');
}

module.exports = config;
