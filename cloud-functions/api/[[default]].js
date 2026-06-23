/**
 * EdgeOne Pages Cloud Functions - Express 入口
 * 
 * 將整個 Express 後端整合到單一入口文件，符合 EdgeOne Pages 的部署規範：
 * - 必須放在 ./cloud-functions/express/[[default]].js
 * - 必須使用 ES Module (import/export) 語法
 * - 必須導出 Express app 實例（不能手動調用 listen）
 * - 平台會自動處理 HTTP Server 和端口監聽
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import crypto from 'node:crypto';
import { INLINE_NPC, INLINE_CLUES, INLINE_WORLDBOOK, INLINE_INNER_WORLDS, INLINE_DICTIONARY, INLINE_PROMPT } from './inline-data.js';

// ============================================================
// 環境變數 & 配置
// ============================================================

const nodeEnv = process.env.NODE_ENV || 'production';
const isProduction = nodeEnv === 'production';

const config = {
  nodeEnv,
  cors: {
    origin: (process.env.CORS_ORIGIN || '*')
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

if (isProduction && (!config.deepseek.apiKey || config.deepseek.apiKey === 'YOUR_KEY')) {
  console.warn('[Config] WARNING: DEEPSEEK_API_KEY not set. Using fallback replies.');
}

// ============================================================
// Logger
// ============================================================
const logger = {
  info: (...args) => console.log('[INFO]', ...args),
  warn: (...args) => console.warn('[WARN]', ...args),
  error: (...args) => console.error('[ERROR]', ...args),
  debug: (...args) => console.log('[DEBUG]', ...args),
};

// ============================================================
// 內存數據存儲 (EdgeOne 無狀態環境)
// ============================================================

const memoryStore = {
  saves: {},
  memories: {},
  npcs: {},
  clues: [],
  worldbook: { entries: [] },
  innerWorlds: {},
  dictionary: [],
};

function loadStaticData() {
  // 直接从 inline-data.js 模块加载，无需文件 I/O
  try {
    if (INLINE_NPC) memoryStore.npcs = INLINE_NPC;
    if (INLINE_CLUES) memoryStore.clues = INLINE_CLUES;
    if (INLINE_WORLDBOOK) memoryStore.worldbook = INLINE_WORLDBOOK;
    if (INLINE_INNER_WORLDS) memoryStore.innerWorlds = INLINE_INNER_WORLDS;
    if (INLINE_DICTIONARY) memoryStore.dictionary = INLINE_DICTIONARY;
    logger.info('Static data loaded from inline-data module');
  } catch (e) {
    logger.warn('Could not load static data:', e.message);
  }
}

loadStaticData();

// ============================================================
// 自定義錯誤類
// ============================================================

class AppError extends Error {
  constructor(message, status = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.isOperational = true;
    this.status = status;
    this.code = code;
  }
}

class ValidationError extends AppError {
  constructor(message, errors) {
    super(message, 400, 'VALIDATION_ERROR');
    this.errors = errors;
  }
}

class UnauthorizedError extends AppError {
  constructor(message) { super(message, 401, 'UNAUTHORIZED'); }
}

class NotFoundError extends AppError {
  constructor(resource, id) {
    super(`${resource} not found: ${id}`, 404, 'NOT_FOUND');
  }
}

// ============================================================
// 中間件
// ============================================================

function requestIdMiddleware(req, res, next) {
  req.id = `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  next();
}

function playerIdMiddleware(req, res, next) {
  req.playerId = (req.headers['x-player-id'] || '').trim() || null;
  next();
}

function authSignatureMiddleware(req, res, next) {
  const playerId = String(req.headers['x-player-id'] || '').trim();
  const signature = String(req.headers['x-player-signature'] || '').trim();
  const timestampRaw = String(req.headers['x-timestamp'] || '').trim();

  if (!playerId) return next(new UnauthorizedError('Missing X-Player-Id header'));
  if (!signature || !timestampRaw) return next(new UnauthorizedError('Missing signature headers'));

  const timestamp = Number(timestampRaw);
  if (!Number.isFinite(timestamp)) return next(new UnauthorizedError('Invalid X-Timestamp header'));

  const now = Date.now();
  if (Math.abs(now - timestamp) > config.auth.maxSkewMs) {
    return next(new UnauthorizedError('Request signature expired'));
  }

  const payload = `${playerId}.${timestamp}`;
  const expected = crypto.createHmac('sha256', config.auth.signatureSecret).update(payload).digest('hex');

  const a = Buffer.from(String(signature || ''), 'utf8');
  const b = Buffer.from(String(expected || ''), 'utf8');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return next(new UnauthorizedError('Invalid request signature'));
  }

  next();
}

// ============================================================
// 服務層 (內存版本)
// ============================================================

// NPC State Engine
const npcStateEngine = {
  classifyDialogue(message) {
    const m = String(message || '').toLowerCase();
    if (m.includes('你好') || m.includes('hi') || m.includes('hello')) return 'greeting';
    if (m.includes('為什麼') || m.includes('why') || m.includes('怎麼會')) return 'questioning';
    if (m.includes('加油') || m.includes('你可以') || m.includes('相信')) return 'encouragement';
    if (m.includes('陪') || m.includes('一起') || m.includes('我在')) return 'companionship';
    if (m.includes('我懂') || m.includes('明白') || m.includes('理解') || m.includes('知道')) return 'empathy';
    if (m.includes('抱歉') || m.includes('對不起') || m.includes('不好意思')) return 'apology';
    if (m.includes('畫') || m.includes('藝術') || m.includes('創作')) return 'art_related';
    return 'neutral';
  },

  getStateLabel(npc) {
    if (npc.ending === 'success') return '和解';
    if (npc.ending === 'failure') return '斷裂';
    if (npc.innerWorldUnlocked) return '內心世界已解鎖';
    if (npc.trust >= 70) return '信任';
    if (npc.stress >= 80) return '高壓';
    if (npc.trust >= 40) return '試探';
    return '疏離';
  },

  updateAfterDialogue(npc, message, dialogueType) {
    const updated = { ...npc };
    let trustDelta = 0;
    let stressDelta = 0;

    switch (dialogueType) {
      case 'greeting': trustDelta = 1; stressDelta = 0; break;
      case 'questioning': trustDelta = -2; stressDelta = 3; break;
      case 'encouragement': trustDelta = 3; stressDelta = -2; break;
      case 'companionship': trustDelta = 5; stressDelta = -3; break;
      case 'empathy': trustDelta = 4; stressDelta = -3; break;
      case 'apology': trustDelta = 2; stressDelta = -1; break;
      case 'art_related': trustDelta = 2; stressDelta = -1; break;
      default: trustDelta = 1; stressDelta = 1;
    }

    updated.trust = Math.max(0, Math.min(100, (updated.trust || 50) + trustDelta));
    updated.stress = Math.max(0, Math.min(100, (updated.stress || 70) + stressDelta));
    updated.knowledge = Math.min(100, (updated.knowledge || 0) + (dialogueType === 'art_related' ? 5 : 1));

    if (updated.trust >= 70 && updated.stress <= 40 && updated.knowledge >= 50) {
      updated.innerWorldUnlocked = true;
    }
    if (updated.trust <= 10 || updated.stress >= 95) {
      updated.ending = 'failure';
    }
    if (updated.trust >= 90 && updated.stress <= 20 && updated.knowledge >= 80 && updated.innerWorldUnlocked) {
      updated.ending = 'success';
    }

    return { npc: updated, trustDelta, stressDelta, dialogueType };
  }
};

// Memory Service
function getDefaultNpcMemory() {
  return { lastInputTypes: [], history: [], fullHistory: [], summary: '', roundCount: 0 };
}

function getNpcMemory(npcId, playerId) {
  if (!memoryStore.memories[playerId]) memoryStore.memories[playerId] = {};
  if (!memoryStore.memories[playerId][npcId]) {
    memoryStore.memories[playerId][npcId] = getDefaultNpcMemory();
  }
  return memoryStore.memories[playerId][npcId];
}

const memoryService = {
  getRecentTypes(npcId, playerId) {
    const m = getNpcMemory(npcId, playerId);
    return Array.isArray(m.lastInputTypes) ? m.lastInputTypes : [];
  },

  addInputType(npcId, inputType, playerId) {
    const m = getNpcMemory(npcId, playerId);
    m.lastInputTypes = [...(m.lastInputTypes || []), inputType].slice(-10);
  },

  saveDialogue(npcId, userMessage, npcReply, playerId, userTimestamp, systemJudgement) {
    const m = getNpcMemory(npcId, playerId);
    if (!Array.isArray(m.fullHistory)) m.fullHistory = [];
    if (!Array.isArray(m.history)) m.history = [];

    const cleanReply = String(npcReply || '').replace(/```json/gi, '').replace(/```/g, '').trim();

    const userEntry = { role: 'user', content: String(userMessage || '').trim(), timestamp: userTimestamp || Date.now() };
    const assistantEntry = { role: 'assistant', content: cleanReply, timestamp: Date.now() };

    if (systemJudgement && typeof systemJudgement === 'object') {
      assistantEntry.systemJudgement = {
        stateLabel: String(systemJudgement.stateLabel || ''),
        trustDelta: Number(systemJudgement.trustDelta) || 0,
        stressDelta: Number(systemJudgement.stressDelta) || 0,
      };
      if (systemJudgement.trust !== undefined) assistantEntry.systemJudgement.trust = Number(systemJudgement.trust);
      if (systemJudgement.stress !== undefined) assistantEntry.systemJudgement.stress = Number(systemJudgement.stress);
      if (systemJudgement.knowledge !== undefined) assistantEntry.systemJudgement.knowledge = Number(systemJudgement.knowledge);
    }

    m.fullHistory.push(userEntry, assistantEntry);
    if (m.fullHistory.length > 2000) m.fullHistory = m.fullHistory.slice(-2000);
    m.history.push(userEntry, assistantEntry);
    m.roundCount = (m.roundCount || 0) + 1;
  },

  getRecentDialogue(npcId, limit, playerId) {
    const m = getNpcMemory(npcId, playerId);
    const history = Array.isArray(m.history) ? m.history : [];
    return history.slice(-(limit || 20)).map(item => ({ role: item.role, content: item.content }));
  },

  getFullDialogue(npcId, playerId) {
    const m = getNpcMemory(npcId, playerId);
    const history = (Array.isArray(m.fullHistory) && m.fullHistory.length > 0)
      ? m.fullHistory : (Array.isArray(m.history) ? m.history : []);
    return history.map(item => ({
      role: item.role, content: item.content, timestamp: item.timestamp,
      systemJudgement: item.systemJudgement || undefined,
    }));
  },

  getSummary(npcId, playerId) { return getNpcMemory(npcId, playerId).summary || ''; },

  updateSummary(npcId, newSummary, playerId) {
    getNpcMemory(npcId, playerId).summary = String(newSummary || '').trim();
  },

  resetCurrentHistory(npcId, playerId) { getNpcMemory(npcId, playerId).history = []; },

  resetHistory(npcId, playerId) {
    const m = getNpcMemory(npcId, playerId);
    m.history = []; m.fullHistory = []; m.summary = ''; m.roundCount = 0;
  },

  resetAll(playerId) { memoryStore.memories[playerId] = {}; },

  getRoundCount(npcId, playerId) { return getNpcMemory(npcId, playerId).roundCount || 0; }
};

// Save Service
function defaultSave() {
  return {
    player: { knowledge: 0 },
    currentLocation: 'skybridge',
    collectedClues: [],
    npcs: {},
    ghosts: [],
    unlockedWorldbookIds: [1, 2, 3, 10, 11, 12],
  };
}

const saveService = {
  readNpcs() { return memoryStore.npcs; },
  writeNpcs(npcs) { memoryStore.npcs = npcs; },

  getNpc(npcId, playerId) {
    if (playerId && memoryStore.saves[playerId]?.npcs?.[npcId]) {
      return memoryStore.saves[playerId].npcs[npcId];
    }
    return memoryStore.npcs[npcId] || null;
  },

  saveNpc(npc, playerId) {
    if (!playerId) { memoryStore.npcs[npc.id] = npc; return npc; }
    if (!memoryStore.saves[playerId]) memoryStore.saves[playerId] = defaultSave();
    if (!memoryStore.saves[playerId].npcs) memoryStore.saves[playerId].npcs = {};
    memoryStore.saves[playerId].npcs[npc.id] = npc;
    return npc;
  },

  getClue(clueId) {
    return (memoryStore.clues || []).find(c => c.id === clueId) || null;
  },

  readSave(playerId) {
    if (!playerId) return defaultSave();
    if (!memoryStore.saves[playerId]) memoryStore.saves[playerId] = defaultSave();
    return memoryStore.saves[playerId];
  },

  writeSave(playerId, save) { memoryStore.saves[playerId] = save; return save; },

  listPlayerIds() { return Object.keys(memoryStore.saves); }
};

// Worldbook Service
const worldbookService = {
  getEntries() { return memoryStore.worldbook?.entries || []; },

  getTriggeredEntries(keywords, playerId) {
    const entries = this.getEntries();
    const save = playerId ? saveService.readSave(playerId) : null;
    const unlocked = save?.unlockedWorldbookIds || [1, 2, 3, 10, 11, 12];
    if (!keywords || keywords.length === 0) return [];
    return entries.filter(entry => {
      if (!unlocked.includes(entry.id)) return false;
      const triggers = Array.isArray(entry.triggers) ? entry.triggers : [];
      return triggers.some(t => keywords.some(k => k.includes(t) || t.includes(k)));
    });
  },

  unlockEntry(entryId, playerId) {
    if (!playerId) return;
    const save = saveService.readSave(playerId);
    if (!save.unlockedWorldbookIds) save.unlockedWorldbookIds = [1, 2, 3, 10, 11, 12];
    if (!save.unlockedWorldbookIds.includes(entryId)) {
      save.unlockedWorldbookIds.push(entryId);
      saveService.writeSave(playerId, save);
    }
  }
};

// Player Lock Service
const playerLocks = {};
function withPlayerLock(playerId, fn) {
  if (!playerLocks[playerId]) playerLocks[playerId] = Promise.resolve();
  const result = playerLocks[playerId].then(() => fn()).finally(() => {});
  playerLocks[playerId] = result.catch(() => {});
  return result;
}

// DeepSeek Service
async function deepseekChat(messages) {
  const { apiKey, model } = config.deepseek;

  if (apiKey && apiKey !== 'YOUR_KEY' && apiKey.trim() !== '') {
    try {
      const response = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model, messages, temperature: 0.7, stream: false }),
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || '';
        const cleaned = String(content).replace(/```json/gi, '').replace(/```/g, '').trim();
        try { const parsed = JSON.parse(cleaned); return parsed.text || parsed.dialogue || cleaned; }
        catch { return cleaned; }
      }
    } catch (err) { logger.error('DeepSeek API error:', err.message); }
  }

  // Fallback replies
  const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
  const msg = String(lastUserMsg?.content || '').toLowerCase();
  if (msg.includes('你好')) return '……你好。\n如果你也是來問我什麼時候復出，那就別開口了。';
  if (msg.includes('陪') || msg.includes('慢慢') || msg.includes('不說話')) return '……你不急著把我變回去？\n那就站遠一點吧。雨聲會比較清楚。';
  if (msg.includes('雨聲')) return '雨聲……\n很久沒聽過了。我一直以為它也變成灰色了。';
  return '他沒有立刻回答。畫筆停在半空，像一個還沒決定要不要落下的句號。';
}

// Prompt Builder
function loadCharacterPrompt(npcId) {
  // 使用内联 prompt，无需文件 I/O
  return INLINE_PROMPT || '你是一位內心受創的藝術家。請用中文回應玩家的對話。';
}

const promptBuilder = {
  buildPrompt(npcId, userMessage, recentInputTypes, playerId) {
    const systemPrompt = loadCharacterPrompt(npcId);

    // 世界書觸發條目
    const triggeredEntries = worldbookService.getTriggeredEntries([userMessage], playerId);
    let worldbookContext = '';
    if (triggeredEntries.length > 0) {
      worldbookContext = '\n\n[當前相關的世界資訊]\n' + triggeredEntries.map(e => e.content).join('\n---\n');
    }

    // 長期摘要
    const summary = memoryService.getSummary(npcId, playerId);
    let summaryContext = summary ? `\n\n[先前的對話摘要]\n${summary}` : '';

    // 近期對話歷史
    const history = memoryService.getRecentDialogue(npcId, 20, playerId);

    return [
      { role: 'system', content: systemPrompt + worldbookContext + summaryContext },
      ...history,
      { role: 'user', content: userMessage },
    ];
  }
};

// Summary Service
const summaryService = {
  async generateUpdatedSummary(oldSummary, recentMessages) {
    try {
      const msgText = recentMessages.map(m => `[${m.role}]: ${m.content}`).join('\n');
      const prompt = oldSummary
        ? `之前的摘要：${oldSummary}\n\n新的對話：\n${msgText}\n\n請合併生成一個簡潔的摘要（50字以內，中文）。`
        : `對話：\n${msgText}\n\n請生成一個簡潔的摘要（50字以內，中文）。`;
      return await deepseekChat([
        { role: 'system', content: '你是一個對話摘要助手，請用中文輸出。' },
        { role: 'user', content: prompt },
      ]);
    } catch { return ''; }
  }
};

// ============================================================
// Express App 初始化
// ============================================================

const app = express();

app.set('trust proxy', 1);
app.use(requestIdMiddleware);
app.use(playerIdMiddleware);
app.use(helmet());

const corsOrigin = config.cors.origin;
app.use(cors({
  origin: corsOrigin.includes('*') ? '*' : corsOrigin,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-Player-Id', 'X-Request-Id', 'X-Timestamp', 'X-Player-Signature'],
  credentials: false,
}));
app.use(express.json({ limit: '50kb' }));

// 全域限流
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false,
  handler: (req, res) => res.status(429).json({ code: 'RATE_LIMITED', error: 'Too many requests.', request_id: req.id }),
}));

// LLM 限流
const llmLimiter = rateLimit({
  windowMs: 60 * 1000, max: 15, standardHeaders: true, legacyHeaders: false,
  handler: (req, res) => res.status(429).json({ code: 'RATE_LIMITED', error: 'Too many LLM requests.', request_id: req.id }),
});

// 請求日誌
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => logger.info(`${req.method} ${req.url} ${res.statusCode} ${Date.now() - start}ms`));
  next();
});

// ============================================================
// API 路由
// ============================================================

// Health Check
app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'glimmer-city-backend', version: '0.2.0-edgeone' });
});

// Chat: 獲取歷史
app.get('/chat/history/:npcId', authSignatureMiddleware, (req, res, next) => {
  try {
    const history = req.playerId ? memoryService.getFullDialogue(req.params.npcId, req.playerId) : [];
    res.json({ history });
  } catch (error) { next(error); }
});

// Chat: 重置單個 NPC
app.post('/chat/reset/:npcId', authSignatureMiddleware, (req, res, next) => {
  try {
    if (req.playerId) memoryService.resetHistory(req.params.npcId, req.playerId);
    res.json({ success: true });
  } catch (error) { next(error); }
});

// Chat: 重置全部
app.post('/chat/reset-all', authSignatureMiddleware, (req, res, next) => {
  try {
    if (req.playerId) memoryService.resetAll(req.playerId);
    res.json({ success: true });
  } catch (error) { next(error); }
});

// Chat: 發送對話
app.post('/chat', authSignatureMiddleware, llmLimiter, async (req, res, next) => {
  try {
    const { npcId, message } = req.body;
    const playerId = req.playerId;

    if (!npcId || !message) throw new ValidationError('npcId and message are required');
    if (!playerId) throw new ValidationError('Missing X-Player-Id header');

    await withPlayerLock(playerId, async () => {
      const userTimestamp = Date.now();
      const npc = saveService.getNpc(npcId, playerId);
      if (!npc) throw new NotFoundError('NPC', npcId);

      if (npc.ending && npc.ending !== 'none') {
        return res.json({
          text: npc.ending === 'success'
            ? '雨聲還在。他沒有痊癒，但沒有再把自己藏進空白裡。'
            : '天橋上只剩潮濕的紙張。那個人影沒有再回頭。',
          psychology: { trustDelta: 0, stressDelta: 0, stateLabel: npcStateEngine.getStateLabel(npc) },
          npcState: {
            trust: npc.trust, stress: npc.stress, knowledge: npc.knowledge,
            innerWorldUnlocked: npc.innerWorldUnlocked, ending: npc.ending,
          },
        });
      }

      const dialogueType = npcStateEngine.classifyDialogue(message);
      const recentInputTypes = memoryService.getRecentTypes(npcId, playerId);
      const messages = promptBuilder.buildPrompt(npcId, message, recentInputTypes, playerId);

      let reply = await deepseekChat(messages);
      if (!reply || reply.trim() === '') reply = '他只是沈默地看著畫布，雨聲填滿了對話的空白。';

      const stateUpdate = npcStateEngine.updateAfterDialogue(npc, message, dialogueType);
      const systemJudgement = {
        stateLabel: npcStateEngine.getStateLabel(stateUpdate.npc),
        trustDelta: stateUpdate.trustDelta,
        stressDelta: stateUpdate.stressDelta,
        knowledgeDelta: stateUpdate.npc.knowledge - (npc.knowledge || 0),
        trust: stateUpdate.npc.trust,
        stress: stateUpdate.npc.stress,
        knowledge: stateUpdate.npc.knowledge,
      };

      memoryService.addInputType(npcId, stateUpdate.dialogueType, playerId);
      memoryService.saveDialogue(npcId, message, reply, playerId, userTimestamp, systemJudgement);
      saveService.saveNpc(stateUpdate.npc, playerId);

      // 解鎖世界書條目
      const npcTemplate = memoryStore.npcs[npcId] || {};
      const unlockIds = Array.isArray(npcTemplate.worldbookUnlockIds) ? npcTemplate.worldbookUnlockIds : [];
      if (stateUpdate.npc.innerWorldUnlocked || stateUpdate.npc.knowledge >= 70) {
        unlockIds.forEach(id => worldbookService.unlockEntry(id, playerId));
      }

      res.json({
        text: reply,
        psychology: {
          trustDelta: stateUpdate.trustDelta, stressDelta: stateUpdate.stressDelta,
          stateLabel: systemJudgement.stateLabel, inputType: stateUpdate.dialogueType,
        },
        npcState: {
          trust: stateUpdate.npc.trust, stress: stateUpdate.npc.stress,
          knowledge: stateUpdate.npc.knowledge, innerWorldUnlocked: stateUpdate.npc.innerWorldUnlocked,
          ending: stateUpdate.npc.ending,
        },
      });

      // 異步生成摘要
      if (memoryService.getRoundCount(npcId, playerId) % 10 === 0) {
        const oldSummary = memoryService.getSummary(npcId, playerId);
        const segment = memoryService.getRecentDialogue(npcId, 20, playerId);
        memoryService.resetCurrentHistory(npcId, playerId);

        summaryService.generateUpdatedSummary(oldSummary, segment)
          .then(newSummary => {
            if (newSummary && newSummary.trim() && newSummary !== '無') {
              memoryService.updateSummary(npcId, newSummary, playerId);
            }
          })
          .catch(err => logger.error('Summary update failed:', err.message));
      }
    });
  } catch (error) { next(error); }
});

// NPC: 獲取狀態
app.get('/npc/:id', authSignatureMiddleware, (req, res, next) => {
  try {
    const npc = saveService.getNpc(req.params.id, req.playerId);
    if (!npc) throw new NotFoundError('NPC', req.params.id);
    res.json({
      id: npc.id, name: npc.name, trust: npc.trust, stress: npc.stress,
      knowledge: npc.knowledge, innerWorldUnlocked: npc.innerWorldUnlocked,
      ending: npc.ending, stateLabel: npcStateEngine.getStateLabel(npc),
    });
  } catch (error) { next(error); }
});

// NPC: 設置結局
app.post('/npc/:id/ending', authSignatureMiddleware, (req, res, next) => {
  try {
    const { ending } = req.body;
    if (!['success', 'failure', 'none'].includes(ending)) {
      throw new ValidationError('ending must be success, failure, or none');
    }
    const npc = saveService.getNpc(req.params.id, req.playerId);
    if (!npc) throw new NotFoundError('NPC', req.params.id);
    npc.ending = ending;
    saveService.saveNpc(npc, req.playerId);
    res.json({ success: true, npc });
  } catch (error) { next(error); }
});

// Save: 加載
app.get('/save', authSignatureMiddleware, (req, res, next) => {
  try {
    if (!req.playerId) throw new ValidationError('Missing X-Player-Id header');
    res.json(saveService.readSave(req.playerId));
  } catch (error) { next(error); }
});

// Save: 保存
app.post('/save', authSignatureMiddleware, (req, res, next) => {
  try {
    if (!req.playerId) throw new ValidationError('Missing X-Player-Id header');
    res.json({ success: true, save: saveService.writeSave(req.playerId, req.body) });
  } catch (error) { next(error); }
});

// Save: 查詢
app.post('/save/lookup', authSignatureMiddleware, (req, res, next) => {
  try {
    if (!req.playerId) throw new ValidationError('Missing X-Player-Id header');
    res.json({ exists: !!memoryStore.saves[req.playerId], playerId: req.playerId });
  } catch (error) { next(error); }
});

// Investigation: 收集線索
app.post('/investigation/collect', authSignatureMiddleware, (req, res, next) => {
  try {
    const { clueId } = req.body;
    if (!req.playerId) throw new ValidationError('Missing X-Player-Id header');
    if (!clueId) throw new ValidationError('clueId is required');

    const clue = saveService.getClue(clueId);
    if (!clue) throw new NotFoundError('Clue', clueId);

    const save = saveService.readSave(req.playerId);
    if (!save.collectedClues.includes(clueId)) {
      save.collectedClues.push(clueId);
      saveService.writeSave(req.playerId, save);
    }
    res.json({ success: true, clue, collectedClues: save.collectedClues });
  } catch (error) { next(error); }
});

// Inner World: 獲取
app.get('/inner-world/:npcId', authSignatureMiddleware, (req, res, next) => {
  try {
    const world = memoryStore.innerWorlds[req.params.npcId];
    if (!world) throw new NotFoundError('Inner world', req.params.npcId);
    res.json(world);
  } catch (error) { next(error); }
});

// Dictionary: 獲取
app.get('/dictionary', (req, res, next) => {
  try { res.json(memoryStore.dictionary || []); } catch (error) { next(error); }
});

// Worldbook: 獲取全部
app.get('/worldbook', authSignatureMiddleware, (req, res, next) => {
  try { res.json({ entries: worldbookService.getEntries() }); } catch (error) { next(error); }
});

// Worldbook: 觸發條目
app.post('/worldbook/triggered', authSignatureMiddleware, (req, res, next) => {
  try {
    const { keywords } = req.body;
    res.json({ entries: worldbookService.getTriggeredEntries(keywords || [], req.playerId) });
  } catch (error) { next(error); }
});

// 404
app.use((req, res) => {
  res.status(404).json({ code: 'NOT_FOUND', error: 'Route not found', request_id: req.id });
});

// Global Error Handler
app.use((error, req, res, _next) => {
  if (error instanceof AppError && error.isOperational) {
    logger.warn(`[${error.code}] ${error.message}`);
    return res.status(error.status).json({
      code: error.code, status: error.status, detail: error.message,
      errors: error.errors || undefined, request_id: req.id,
    });
  }

  logger.error('Unexpected error:', error.message, error.stack);
  res.status(500).json({
    code: 'INTERNAL_ERROR', status: 500,
    detail: isProduction ? 'Internal server error' : error.message,
    request_id: req.id,
  });
});

// ============================================================
// 導出 Express 實例 (EdgeOne Pages Cloud Functions 規範)
// ============================================================
export default app;
