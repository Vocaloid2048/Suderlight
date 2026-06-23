/**
 * EdgeOne Pages Cloud Functions — 情绪修复师：微光城市
 * cloud-functions/api/[[default]].js — 整合 backend 游戏逻辑 + EdgeOne 部署适配
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import crypto from 'node:crypto';

// 内联数据模块
import INLINE_NPC from './data/npcs.js';
import INLINE_CLUES from './data/clues.js';
import INLINE_WORLDBOOK from './data/worldbook.js';
import INLINE_INNER_WORLDS from './data/innerWorlds.js';
import INLINE_DICTIONARY from './data/dictionary.js';
import { ARTIST_PROMPT } from './data/prompts.js';
import CHARACTER_CARDS from './data/character-cards.js';

// ============================================================
// 配置
// ============================================================
const nodeEnv = process.env.NODE_ENV || 'production';
const config = {
  nodeEnv,
  cors: {
    origin: (process.env.CORS_ORIGIN || '*').split(',').map(s => s.trim()).filter(Boolean),
  },
  auth: {
    signatureSecret: process.env.PLAYER_SIGNATURE_SECRET || 'dev-signature-secret-change-me',
    maxSkewMs: parseInt(process.env.PLAYER_SIGNATURE_MAX_SKEW_MS || '300000', 10),
  },
  deepseek: {
    apiKey: process.env.DEEPSEEK_API_KEY,
    model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
  },
};

// ============================================================
// Logger
// ============================================================
const logger = {
  info: (...a) => console.log('[INFO]', ...a),
  warn: (...a) => console.warn('[WARN]', ...a),
  error: (...a) => console.error('[ERROR]', ...a),
};

// ============================================================
// 内存数据存储
// ============================================================
const memoryStore = {
  saves: {}, memories: {}, npcs: {}, clues: [],
  worldbook: { entries: [] }, innerWorlds: {}, dictionary: [],
};

function loadStaticData() {
  try {
    if (INLINE_NPC) memoryStore.npcs = INLINE_NPC;
    if (INLINE_CLUES) memoryStore.clues = INLINE_CLUES;
    if (INLINE_WORLDBOOK) memoryStore.worldbook = INLINE_WORLDBOOK;
    if (INLINE_INNER_WORLDS) memoryStore.innerWorlds = INLINE_INNER_WORLDS;
    if (INLINE_DICTIONARY) memoryStore.dictionary = INLINE_DICTIONARY;
    logger.info('Static data loaded');
  } catch (e) { logger.warn('Static data load failed:', e.message); }
}
loadStaticData();

// ============================================================
// 错误类
// ============================================================
class AppError extends Error {
  constructor(message, status = 500, code = 'INTERNAL_ERROR') {
    super(message); this.status = status; this.code = code;
  }
}
class ValidationError extends AppError { constructor(m) { super(m, 400, 'VALIDATION_ERROR'); } }
class NotFoundError extends AppError { constructor(type, id) { super(`${type} not found: ${id}`, 404, 'NOT_FOUND'); } }
class UnauthorizedError extends AppError { constructor(m) { super(m, 401, 'UNAUTHORIZED'); } }

// ============================================================
// 中间件
// ============================================================
function requestIdMiddleware(req, res, next) {
  req.id = `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  res.setHeader('X-Request-Id', req.id);
  next();
}

function playerIdMiddleware(req, res, next) {
  req.playerId = String(req.headers['x-player-id'] || '').trim() || null;
  next();
}

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
  const expected = crypto.createHmac('sha256', config.auth.signatureSecret).update(`${playerId}.${timestamp}`).digest('hex');
  const a = Buffer.from(String(signature), 'utf8');
  const b = Buffer.from(String(expected), 'utf8');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return next(new UnauthorizedError('Invalid request signature'));
  }
  next();
}

const llmLimiter = rateLimit({
  windowMs: 60 * 1000, max: 15,
  standardHeaders: true, legacyHeaders: false,
  message: { code: 'RATE_LIMITED', error: 'Too many requests, please slow down' },
});

// ============================================================
// NPC 状态引擎 (Backend 类别体系 + context-aware + trust labels)
// ============================================================
function clamp(v, min = 0, max = 100) { return Math.max(min, Math.min(max, v)); }
function hasAny(input, words) { return words.some(w => input.includes(w)); }

function classifyDialogue(message, recentInputTypes = []) {
  const input = String(message || '').trim().toLowerCase();

  const harmfulComfort = ['加油', '振作', '會好的', '一定會好', '好起來', '重新開始', '復出', '再畫', '一定可以'];
  const empathyWords = ['我陪你', '陪你', '不用立刻', '不用馬上', '慢慢來', '可以沉默', '不說話', '我願意聽', '聽你說', '不畫畫也沒關係', '你現在這樣也可以'];
  const grounding = ['雨聲', '風', '沉默', '聽見'];
  const contradict = ['不應該', '不同意', '不對', '不是這樣', '其實還是', '你只是', '逃避', '別把', '怪在', '你錯了'];
  const irrelevant = ['午餐', '咖哩', '手機', '沒電', '天氣預報', '放晴', '看到一隻貓', '電腦', '鍵盤'];
  const hostile = ['廢物', '去死', '沒用', '垃圾', '活該', '可悲', '軟弱', '懦夫', '裝病', '演的', '滾', '閉嘴', '殺', '爛'];
  const dismiss = ['隨便', '算了', '反正', '不重要', '無所謂', '懶得管', '不關我的事', '無聊', '嗯', '喔'];
  const roleRelated = ['畫', '藝術', '創作', '色彩', '顏料', '畫布'];

  // 1. 关键词初步分类
  let type = 'ordinary';
  if (hasAny(input, hostile)) type = 'hostile';
  else if (hasAny(input, dismiss) && input.length < 4) type = 'dismiss';
  else if (hasAny(input, harmfulComfort)) type = 'comfort';
  else if (hasAny(input, empathyWords) || hasAny(input, grounding)) type = 'empathy';
  else if (hasAny(input, contradict)) type = 'contradict';
  else if (hasAny(input, irrelevant)) type = 'neutral';
  else if (hasAny(input, roleRelated)) type = 'role_related';

  // 2. Context-aware: empathy 用超過2次 → 降級為 comfort (有害)
  if (type === 'empathy' && recentInputTypes.length >= 3) {
    const recentEmpathy = recentInputTypes.slice(-3).filter(t => t === 'empathy').length;
    if (recentEmpathy >= 2) type = 'comfort';
  }

  return type;
}

function getDialogueDelta(message, knownType, recentInputTypes = []) {
  const dialogueType = knownType || classifyDialogue(message, recentInputTypes);

  if (dialogueType === 'hostile')     return { dialogueType, trustDelta: -8, stressDelta: 12 };
  if (dialogueType === 'comfort')     return { dialogueType, trustDelta: -3, stressDelta: 5 };
  if (dialogueType === 'empathy')      return { dialogueType, trustDelta: 10, stressDelta: -6 };
  if (dialogueType === 'contradict')  return { dialogueType, trustDelta: 0, stressDelta: 5 };
  if (dialogueType === 'dismiss')     return { dialogueType, trustDelta: -3, stressDelta: 3 };
  if (dialogueType === 'neutral')     return { dialogueType, trustDelta: 0, stressDelta: 0 };
  if (dialogueType === 'role_related') return { dialogueType, trustDelta: 2, stressDelta: -1 };
  return { dialogueType, trustDelta: 0, stressDelta: 0 };
}

function checkUnlock(npc) {
  if (npc.knowledge >= (npc.knowledgeRequired || 70) && npc.trust >= 50) {
    npc.innerWorldUnlocked = true;
  }
  return npc;
}

function updateAfterDialogue(npc, message, knownType, recentInputTypes = []) {
  const { dialogueType, trustDelta, stressDelta } = getDialogueDelta(message, knownType, recentInputTypes);
  npc.trust = clamp((npc.trust || 20) + trustDelta);
  npc.stress = clamp((npc.stress || 80) + stressDelta);

  // role_related: +3 knowledge, 其余不自动加
  if (dialogueType === 'role_related') {
    npc.knowledge = clamp((npc.knowledge || 0) + 3);
  }

  checkUnlock(npc);
  return { npc, dialogueType, trustDelta, stressDelta };
}

function getStateLabel(npc) {
  // Backend stress-based + Cloud trust-based (合并)
  if (npc.ending === 'success') return '修復完成';
  if (npc.ending === 'failure') return '失敗殘影';
  if (npc.innerWorldUnlocked) return '鬆動';
  if (npc.trust >= 70) return '信任';
  if (npc.stress >= 85) return '緊繃';
  if (npc.trust >= 40) return '試探';
  if (npc.stress <= 45) return '平靜';
  return '防備';
}

function setEnding(npc, ending) {
  if (!['success', 'failure', 'none'].includes(ending)) throw new Error('Invalid ending');
  npc.ending = ending;
  return npc;
}

// ============================================================
// Memory Service
// ============================================================
function getDefaultNpcMemory() {
  return { lastInputTypes: [], history: [], fullHistory: [], summary: '', roundCount: 0 };
}
function getNpcMemory(npcId, playerId) {
  if (!memoryStore.memories[playerId]) memoryStore.memories[playerId] = {};
  if (!memoryStore.memories[playerId][npcId]) memoryStore.memories[playerId][npcId] = getDefaultNpcMemory();
  return memoryStore.memories[playerId][npcId];
}

const memoryService = {
  getRecentTypes(npcId, playerId) {
    return Array.isArray(getNpcMemory(npcId, playerId).lastInputTypes) ? getNpcMemory(npcId, playerId).lastInputTypes : [];
  },
  addInputType(npcId, inputType, playerId) {
    const m = getNpcMemory(npcId, playerId);
    m.lastInputTypes = [...(m.lastInputTypes || []), inputType].slice(-10);
  },
  saveDialogue(npcId, userMsg, npcReply, playerId, ts, judgement) {
    const m = getNpcMemory(npcId, playerId);
    if (!Array.isArray(m.fullHistory)) m.fullHistory = [];
    if (!Array.isArray(m.history)) m.history = [];
    const clean = String(npcReply || '').replace(/```json/gi, '').replace(/```/g, '').trim();
    const u = { role: 'user', content: String(userMsg || '').trim(), timestamp: ts || Date.now() };
    const a = { role: 'assistant', content: clean, timestamp: Date.now() };
    if (judgement && typeof judgement === 'object') {
      a.systemJudgement = {
        stateLabel: String(judgement.stateLabel || ''),
        trustDelta: Number(judgement.trustDelta) || 0,
        stressDelta: Number(judgement.stressDelta) || 0,
      };
      if (judgement.trust !== undefined) a.systemJudgement.trust = Number(judgement.trust);
      if (judgement.stress !== undefined) a.systemJudgement.stress = Number(judgement.stress);
      if (judgement.knowledge !== undefined) a.systemJudgement.knowledge = Number(judgement.knowledge);
    }
    m.fullHistory.push(u, a);
    if (m.fullHistory.length > 2000) m.fullHistory = m.fullHistory.slice(-2000);
    m.history.push(u, a);
  },
  getRecentDialogue(npcId, limit, playerId) {
    const h = Array.isArray(getNpcMemory(npcId, playerId).history) ? getNpcMemory(npcId, playerId).history : [];
    return h.slice(-(limit || 20)).map(i => ({ role: i.role, content: i.content }));
  },
  getFullDialogue(npcId, playerId) {
    const m = getNpcMemory(npcId, playerId);
    const h = (Array.isArray(m.fullHistory) && m.fullHistory.length > 0) ? m.fullHistory : (Array.isArray(m.history) ? m.history : []);
    return h.map(i => ({ role: i.role, content: i.content, timestamp: i.timestamp, systemJudgement: i.systemJudgement || undefined }));
  },
  getSummary(npcId, playerId) { return getNpcMemory(npcId, playerId).summary || ''; },
  updateSummary(npcId, s, playerId) { getNpcMemory(npcId, playerId).summary = String(s || '').trim(); },
  resetCurrentHistory(npcId, playerId) { getNpcMemory(npcId, playerId).history = []; },
  resetHistory(npcId, playerId) {
    const m = getNpcMemory(npcId, playerId); m.history = []; m.fullHistory = []; m.summary = '';
  },
  resetAll(playerId) { memoryStore.memories[playerId] = {}; },
  getRoundCount(npcId, playerId) {
    const m = getNpcMemory(npcId, playerId);
    const len = Array.isArray(m.fullHistory) ? m.fullHistory.length : 0;
    return Math.floor(len / 2);
  },
};

// ============================================================
// Save Service
// ============================================================
function defaultSave() {
  return { player: { knowledge: 0 }, currentLocation: 'skybridge', collectedClues: [], npcs: {}, ghosts: [], unlockedWorldbookIds: [1, 2, 3, 10, 11, 12] };
}
const saveService = {
  readNpcs() { return memoryStore.npcs; },
  writeNpcs(npcs) { memoryStore.npcs = npcs; },
  getNpc(npcId, playerId) {
    if (playerId && memoryStore.saves[playerId]?.npcs?.[npcId]) return memoryStore.saves[playerId].npcs[npcId];
    return memoryStore.npcs[npcId] || null;
  },
  saveNpc(npc, playerId) {
    if (!playerId) { memoryStore.npcs[npc.id] = npc; return npc; }
    if (!memoryStore.saves[playerId]) memoryStore.saves[playerId] = defaultSave();
    if (!memoryStore.saves[playerId].npcs) memoryStore.saves[playerId].npcs = {};
    memoryStore.saves[playerId].npcs[npc.id] = npc;
    return npc;
  },
  getClue(clueId) { return (memoryStore.clues || []).find(c => c.id === clueId) || null; },
  readSave(playerId) {
    if (!playerId) return defaultSave();
    if (!memoryStore.saves[playerId]) memoryStore.saves[playerId] = defaultSave();
    return memoryStore.saves[playerId];
  },
  writeSave(playerId, save) { memoryStore.saves[playerId] = save; return save; },
  listPlayerIds() { return Object.keys(memoryStore.saves); },
};

// ============================================================
// Worldbook Service (Backend 版本)
// ============================================================
const worldbookService = {
  getEntries() { return memoryStore.worldbook?.entries || []; },
  getTriggeredEntries(npcId, playerMessage, playerId) {
    const entries = this.getEntries();
    const unlockedIds = playerId ? (saveService.readSave(playerId).unlockedWorldbookIds || []) : [1, 2, 3, 10, 11, 12];
    const msgLower = String(playerMessage || '').toLowerCase();

    const isUnlocked = (entry) => {
      if (entry.constant || entry.unlockedByDefault) return true;
      return unlockedIds.includes(entry.id);
    };

    const matched = entries.filter(entry => {
      if (entry.enabled === false || entry.disable === true) return false;
      if (!isUnlocked(entry)) return false;
      if (entry.constant) return true;
      const keys = Array.isArray(entry.keys) ? entry.keys : [];
      if (keys.length === 0) return false;
      return keys.some(key => {
        const k = String(key || '').toLowerCase().trim();
        return k && msgLower.includes(k);
      });
    });

    // 自动匹配 NPC 场景条目
    const npcScene = entries.find(entry =>
      entry.npcId === npcId && entry.enabled !== false && entry.disable !== true && isUnlocked(entry)
    );
    if (npcScene && !matched.some(e => e.id === npcScene.id)) matched.push(npcScene);

    return matched.sort((a, b) => (b.priority || 0) - (a.priority || 0));
  },
  unlockEntry(entryId, playerId) {
    if (!playerId) return;
    const save = saveService.readSave(playerId);
    if (!save.unlockedWorldbookIds) save.unlockedWorldbookIds = [1, 2, 3, 10, 11, 12];
    const id = Number(entryId);
    if (!save.unlockedWorldbookIds.includes(id)) {
      save.unlockedWorldbookIds.push(id);
      saveService.writeSave(playerId, save);
    }
  },
};

// ============================================================
// Ghost Engine
// ============================================================
const ghostEngine = {
  addFailedNPC(npcId, playerId) {
    const save = saveService.readSave(playerId);
    const exists = save.ghosts.some(g => g.npc === npcId && g.failed === true);
    if (!exists) {
      save.ghosts.push({ npc: npcId, failed: true, createdAt: new Date().toISOString() });
      saveService.writeSave(playerId, save);
    }
    return save.ghosts;
  },
};

// ============================================================
// Player Lock
// ============================================================
const playerLocks = {};
function withPlayerLock(playerId, fn) {
  if (!playerLocks[playerId]) playerLocks[playerId] = Promise.resolve();
  const r = playerLocks[playerId].then(() => fn()).finally(() => {});
  playerLocks[playerId] = r.catch(() => {});
  return r;
}

// ============================================================
// DeepSeek Service
// ============================================================
async function deepseekChat(messages) {
  const { apiKey, model } = config.deepseek;
  if (apiKey && apiKey !== 'YOUR_KEY' && apiKey.trim() !== '') {
    try {
      const resp = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model, messages, temperature: 0.8, stream: false }),
      });
      if (resp.ok) {
        const data = await resp.json();
        const content = data.choices?.[0]?.message?.content || '';
        const cleaned = String(content).replace(/```json/gi, '').replace(/```/g, '').trim();
        try { const p = JSON.parse(cleaned); return p.text || p.dialogue || cleaned; }
        catch { return cleaned; }
      }
    } catch (err) { logger.error('DeepSeek API error:', err.message); }
  }
  // Fallback
  const last = [...messages].reverse().find(m => m.role === 'user');
  const msg = String(last?.content || '').toLowerCase();
  if (msg.includes('你好')) return '……你好。\n如果你也是來問我什麼時候復出，那就別開口了。';
  if (msg.includes('陪') || msg.includes('慢慢') || msg.includes('不說話')) return '……你不急著把我變回去？\n那就站遠一點吧。雨聲會比較清楚。';
  if (msg.includes('雨聲')) return '雨聲……\n很久沒聽過了。我一直以為它也變成灰色了。';
  return '他沒有立刻回答。畫筆停在半空，像一個還沒決定要不要落下的句號。';
}

// ============================================================
// Prompt Builder (Backend 角色卡结构 + 丰富对话 + 文学感)
// ============================================================
function formatWorldbookEntries(entries) {
  return entries.map(e => `【${e.comment || e.id}】\n${e.content}`).join('\n\n');
}

function buildPrompt(npcId, playerMessage, recentInputTypes = [], playerId = null) {
  const card = CHARACTER_CARDS[npcId] || {};
  const npc = card;

  // 世界书
  const triggered = worldbookService.getTriggeredEntries(npcId, playerMessage, playerId);
  const worldbookText = formatWorldbookEntries(triggered);

  // 长期摘要
  const summary = playerId ? memoryService.getSummary(npcId, playerId) : '';

  // 近期历史
  const history = playerId ? memoryService.getRecentDialogue(npcId, 20, playerId) : [];

  const name = npc.name || npcId;
  const desc = npc.description || '';
  const personality = npc.personality || '';
  const scenario = npc.scenario || '';
  const firstMsg = npc.first_mes || '';
  const examples = npc.mes_example || '';
  const sysPrompt = npc.system_prompt || '';
  const notes = npc.creator_notes || '';

  const systemContent = `你正在《情緒修復師：微光城市》中扮演 NPC。

【當前場景感知】
${worldbookText || '無特殊感知'}

【角色名稱】${name}
【角色描述】${desc}
【個性與心理狀態】${personality}
【長期記憶與進度摘要】
${summary || '這是你們的初次交談。'}

【場景】${scenario}
【第一句台詞參考】${firstMsg}
【對話範例】${examples}
【角色系統規則】
${sysPrompt}
【創作者補充】${notes}

【最近玩家輸入類型】${recentInputTypes.length > 0 ? recentInputTypes.join(' → ') : '首次對話'}

【演出要求 — 非常重要】
- 請以 NPC 身份回覆，融入自然的肢體動作與場景細節（例如：「他停頓了一下，手指在斷裂的欄杆上輕輕敲了兩下」）
- 對話要有文學感與沉浸感，不要只回一句就結束
- 不要變成心理醫生，不要分析自己或玩家
- 不要一次說太多，但要有足夠的情感厚度
- 參考前情提要中的記憶摘要，保持情感連貫
- 不要判定通關，不要宣告心理世界是否解鎖
- 只輸出 NPC 的台詞與動作描寫`;

  return [
    { role: 'system', content: systemContent.trim() },
    ...history,
    { role: 'user', content: playerMessage },
  ];
}

// ============================================================
// Summary Service (200字 + 记住重点)
// ============================================================
async function generateUpdatedSummary(oldSummary, dialogueSegment) {
  const formatted = dialogueSegment.map(m => `${m.role === 'user' ? '玩家(修復師)' : 'NPC'}: ${m.content}`).join('\n');

  const sys = `你是一位專業的心理對話分析師與文學顧問。
你的任務是根據「先前的長期情感摘要」以及「新發生的對話片斷」，提煉出更新後、最精煉的【長期情感與修復狀態摘要】。

【摘要撰寫規則】
1. 字數限制：請完全控制在 200 字內（繁體中文），不說廢話、直接切入重點。
2. 滾動更新：請將新對話中發生的「最新進展」或「心防突破」融入到先前的摘要中。
3. 格式要求：你必須嚴格按照以下格式輸出，不要輸出任何 JSON、Markdown 標籤或分析性廢話：

[核心心結]：(NPC 尚未解決的痛苦)
[已建立聯繫]：(玩家做過哪些讓 NPC 感動或信任的事)
[約定事項]：(雙方達成過什麼承諾，如果沒有請寫無)`;

  const msgs = [
    { role: 'system', content: sys },
    { role: 'user', content: `【先前的長期情感摘要】：\n${oldSummary || '無'}\n\n【新發生的對話片斷】：\n${formatted}\n\n請嚴格依照指定格式，輸出更新後的繁體中文摘要：` },
  ];
  try {
    const reply = await deepseekChat(msgs);
    const cleaned = String(reply || '').replace(/```json/gi, '').replace(/```/g, '').trim();
    try { const p = JSON.parse(cleaned); return p.summary || p.text || cleaned; } catch { return cleaned; }
  } catch { return oldSummary || ''; }
}

// ============================================================
// Express App
// ============================================================
const app = express();

app.use(requestIdMiddleware);
app.use(playerIdMiddleware);
app.use(helmet());
app.use(cors({
  origin: config.cors.origin,
  credentials: true,
  allowedHeaders: ['Content-Type', 'X-Player-Id', 'X-Request-Id', 'X-Timestamp', 'X-Player-Signature'],
}));
app.use(express.json({ limit: '50kb' }));
app.use(rateLimit({ windowMs: 60 * 1000, max: 100, standardHeaders: true, legacyHeaders: false }));

app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`);
  next();
});

// Health
app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'glimmer-city-backend', version: '0.3.0-merged' });
});

// ========== Chat 路由 ==========

function unlockNpcWorldbookEntries(npcId, npcState, playerId) {
  const npcs = saveService.readNpcs();
  const tpl = npcs[npcId] || {};
  const ids = Array.isArray(tpl.worldbookUnlockIds) ? tpl.worldbookUnlockIds : [];
  if (ids.length === 0) return;
  if (npcState.innerWorldUnlocked || npcState.knowledge >= (npcState.knowledgeRequired || 70)) {
    ids.forEach(id => worldbookService.unlockEntry(id, playerId));
  }
}

// Chat: 获取历史
app.get('/chat/history/:npcId', authSignatureMiddleware, (req, res, next) => {
  try {
    const history = req.playerId ? memoryService.getFullDialogue(req.params.npcId, req.playerId) : [];
    res.json({ history });
  } catch (e) { next(e); }
});

// Chat: 重置单个 NPC
app.post('/chat/reset/:npcId', authSignatureMiddleware, (req, res, next) => {
  try {
    if (req.playerId) memoryService.resetHistory(req.params.npcId, req.playerId);
    res.json({ success: true });
  } catch (e) { next(e); }
});

// Chat: 重置全部
app.post('/chat/reset-all', authSignatureMiddleware, (req, res, next) => {
  try {
    if (req.playerId) memoryService.resetAll(req.playerId);
    res.json({ success: true });
  } catch (e) { next(e); }
});

// Chat: 发送对话
app.post('/chat', authSignatureMiddleware, llmLimiter, async (req, res, next) => {
  try {
    const { npcId, message, roundCount: clientRoundCount } = req.body;
    const playerId = req.playerId;
    if (!npcId || !message) throw new ValidationError('npcId and message are required');
    if (!playerId) throw new ValidationError('Missing X-Player-Id header');

    await withPlayerLock(playerId, async () => {
      const ts = Date.now();
      const npc = saveService.getNpc(npcId, playerId);
      if (!npc) throw new NotFoundError('NPC', npcId);

      // 已结局 NPC
      if (npc.ending && npc.ending !== 'none') {
        return res.json({
          text: npc.ending === 'success'
            ? '雨聲還在。他沒有痊癒，但沒有再把自己藏進空白裡。'
            : '天橋上只剩潮濕的紙張。那個人影沒有再回頭。',
          psychology: { trustDelta: 0, stressDelta: 0, stateLabel: getStateLabel(npc) },
          npcState: { trust: npc.trust, stress: npc.stress, knowledge: npc.knowledge, innerWorldUnlocked: npc.innerWorldUnlocked, ending: npc.ending },
          roundCount: memoryService.getRoundCount(npcId, playerId),
          summary: memoryService.getSummary(npcId, playerId),
        });
      }

      const recentInputTypes = memoryService.getRecentTypes(npcId, playerId);
      const dialogueType = classifyDialogue(message, recentInputTypes);
      const messages = buildPrompt(npcId, message, recentInputTypes, playerId);

      let reply = await deepseekChat(messages);
      if (!reply || reply.trim() === '') reply = '他只是沈默地看著畫布，雨聲填滿了對話的空白。';

      const stateUpdate = updateAfterDialogue(npc, message, dialogueType, recentInputTypes);
      const systemJudgement = {
        stateLabel: getStateLabel(stateUpdate.npc),
        trustDelta: stateUpdate.trustDelta,
        stressDelta: stateUpdate.stressDelta,
        knowledgeDelta: stateUpdate.npc.knowledge - (npc.knowledge || 0),
        trust: stateUpdate.npc.trust,
        stress: stateUpdate.npc.stress,
        knowledge: stateUpdate.npc.knowledge,
      };

      memoryService.addInputType(npcId, stateUpdate.dialogueType, playerId);
      memoryService.saveDialogue(npcId, message, reply, playerId, ts, systemJudgement);
      saveService.saveNpc(stateUpdate.npc, playerId);

      unlockNpcWorldbookEntries(npcId, stateUpdate.npc, playerId);

      const historyRoundCount = memoryService.getRoundCount(npcId, playerId);
      const currentRoundCount = Math.max(
        (typeof clientRoundCount === 'number' ? clientRoundCount : 0) + 1,
        historyRoundCount,
      );
      const currentSummary = memoryService.getSummary(npcId, playerId);

      res.json({
        text: reply,
        psychology: { trustDelta: stateUpdate.trustDelta, stressDelta: stateUpdate.stressDelta, stateLabel: systemJudgement.stateLabel, inputType: stateUpdate.dialogueType },
        npcState: { trust: stateUpdate.npc.trust, stress: stateUpdate.npc.stress, knowledge: stateUpdate.npc.knowledge, innerWorldUnlocked: stateUpdate.npc.innerWorldUnlocked, ending: stateUpdate.npc.ending },
        roundCount: currentRoundCount,
        summary: currentSummary,
      });

      // 每10轮生成摘要
      if (history.length % 20 === 0) {
        const oldSummary = memoryService.getSummary(npcId, playerId);
        const segment = memoryService.getRecentDialogue(npcId, 20, playerId);
        memoryService.resetCurrentHistory(npcId, playerId);
        void generateUpdatedSummary(oldSummary, segment).then(s => {
          if (s && s.trim() && s !== '無') memoryService.updateSummary(npcId, s, playerId);
        }).catch(() => {});
      }
    });
  } catch (e) { next(e); }
});

// ========== NPC 路由 ==========
app.get('/npc/:id', authSignatureMiddleware, (req, res, next) => {
  try {
    const npc = saveService.getNpc(req.params.id, req.playerId);
    if (!npc) throw new NotFoundError('NPC', req.params.id);
    res.json({ npc: { ...npc, stateLabel: getStateLabel(npc) } });
  } catch (e) { next(e); }
});

app.post('/npc/:id/ending', authSignatureMiddleware, (req, res, next) => {
  try {
    const npc = saveService.getNpc(req.params.id, req.playerId);
    if (!npc) throw new NotFoundError('NPC', req.params.id);
    const { ending } = req.body;
    if (!['success', 'failure', 'none'].includes(ending)) throw new ValidationError('ending must be success, failure, or none');
    setEnding(npc, ending);
    if (ending === 'failure') ghostEngine.addFailedNPC(req.params.id, req.playerId);
    saveService.saveNpc(npc, req.playerId);
    res.json({ success: true, npc: { ...npc, stateLabel: getStateLabel(npc) } });
  } catch (e) { next(e); }
});

// ========== Save 路由 ==========
app.get('/save', authSignatureMiddleware, (req, res, next) => {
  try { res.json(saveService.readSave(req.playerId)); } catch (e) { next(e); }
});
app.post('/save', authSignatureMiddleware, (req, res, next) => {
  try { res.json(saveService.writeSave(req.playerId, req.body)); } catch (e) { next(e); }
});
app.post('/save/lookup', authSignatureMiddleware, (req, res, next) => {
  try {
    const { playerId } = req.body;
    if (!playerId) throw new ValidationError('playerId is required');
    res.json({ save: saveService.readSave(playerId) });
  } catch (e) { next(e); }
});

// ========== Investigation 路由 (知识收集) ==========
app.post('/investigation/collect', authSignatureMiddleware, (req, res, next) => {
  try {
    const { clueId } = req.body;
    if (!req.playerId) throw new ValidationError('Missing X-Player-Id header');
    if (!clueId) throw new ValidationError('clueId is required');

    const clue = saveService.getClue(clueId);
    if (!clue) throw new NotFoundError('Clue', clueId);

    const save = saveService.readSave(req.playerId);
    const npc = saveService.getNpc(clue.npcId, req.playerId);
    const alreadyCollected = save.collectedClues.includes(clueId);

    if (!alreadyCollected) {
      save.collectedClues.push(clueId);
      save.player.knowledge = Math.min(100, save.player.knowledge + (clue.knowledge || 20));
      if (npc) {
        npc.knowledge = Math.min(100, npc.knowledge + (clue.knowledge || 20));
        checkUnlock(npc);
        saveService.saveNpc(npc, req.playerId);
      }
      saveService.writeSave(req.playerId, save);
    }

    res.json({ success: true, clue, npc: npc ? { ...npc, stateLabel: getStateLabel(npc) } : null, alreadyCollected, collectedClues: save.collectedClues });
  } catch (e) { next(e); }
});

// ========== Inner World ==========
app.get('/inner-world/:npcId', authSignatureMiddleware, (req, res, next) => {
  try {
    const world = memoryStore.innerWorlds[req.params.npcId];
    if (!world) throw new NotFoundError('Inner world', req.params.npcId);
    res.json(world);
  } catch (e) { next(e); }
});

// ========== Dictionary ==========
app.get('/dictionary', (req, res, next) => {
  try { res.json(memoryStore.dictionary || []); } catch (e) { next(e); }
});

// ========== Worldbook ==========
app.get('/worldbook', authSignatureMiddleware, (req, res, next) => {
  try { res.json({ entries: worldbookService.getEntries() }); } catch (e) { next(e); }
});
app.post('/worldbook/triggered', authSignatureMiddleware, (req, res, next) => {
  try {
    const { keywords } = req.body;
    res.json({ entries: worldbookService.getTriggeredEntries(req.body.npcId || 'bridge_artist', (keywords || []).join(' '), req.playerId) });
  } catch (e) { next(e); }
});

// 404
app.use((req, res) => {
  res.status(404).json({ code: 'NOT_FOUND', status: 404, detail: `Route not found: ${req.method} ${req.url}`, request_id: req.id });
});

// Error handler
app.use((error, req, res, _next) => {
  const status = error.status || 500;
  const code = error.code || 'INTERNAL_ERROR';
  logger.error(`[${req.id}] ${status} ${code}: ${error.message}`);
  res.status(status).json({ code, status, detail: error.message, request_id: req.id });
});

export default app;
