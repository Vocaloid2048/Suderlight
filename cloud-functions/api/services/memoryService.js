/**
 * Memory Service —— 对话记忆管理 (支持 memory / fs 双模式)
 *
 * STORAGE_MODE=memory (默认): EdgeOne 内存存储，完全兼容原行为
 * STORAGE_MODE=fs: 文件系统存储，用于本地开发 / Docker 部署
 */
import memoryStore from './store.js';
import {
  readPlayerMemories as readPersistedMemories,
  writePlayerMemories as writePersistedMemories,
} from './persistence.js';

function getDefaultNpcMemory() {
  return { lastInputTypes: [], history: [], fullHistory: [], summary: '', roundCount: 0 };
}

/**
 * 获取指定玩家/指定 NPC 的记忆对象。
 * 读取时优先从持久化层获取，写入时自动同步回持久化层。
 */
function getNpcMemory(npcId, playerId) {
  // 先检查内存缓存
  if (memoryStore.memories[playerId]?.[npcId]) {
    return memoryStore.memories[playerId][npcId];
  }

  // 从持久化层读取
  const persisted = readPersistedMemories(playerId);
  if (persisted && persisted[npcId]) {
    if (!memoryStore.memories[playerId]) memoryStore.memories[playerId] = {};
    memoryStore.memories[playerId][npcId] = persisted[npcId];
    return memoryStore.memories[playerId][npcId];
  }

  // 创建新的
  if (!memoryStore.memories[playerId]) memoryStore.memories[playerId] = {};
  memoryStore.memories[playerId][npcId] = getDefaultNpcMemory();
  return memoryStore.memories[playerId][npcId];
}

/** 将玩家的全部 NPC 记忆写回持久化层 */
function persistMemories(playerId) {
  if (memoryStore.memories[playerId]) {
    writePersistedMemories(playerId, memoryStore.memories[playerId]);
  }
}

const memoryService = {
  getRecentTypes(npcId, playerId) {
    return Array.isArray(getNpcMemory(npcId, playerId).lastInputTypes)
      ? getNpcMemory(npcId, playerId).lastInputTypes : [];
  },

  addInputType(npcId, inputType, playerId) {
    const m = getNpcMemory(npcId, playerId);
    m.lastInputTypes = [...(m.lastInputTypes || []), inputType].slice(-10);
    persistMemories(playerId);
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
    persistMemories(playerId);
  },

  getRecentDialogue(npcId, limit, playerId) {
    const h = Array.isArray(getNpcMemory(npcId, playerId).history)
      ? getNpcMemory(npcId, playerId).history : [];
    return h.slice(-(limit || 20)).map(i => ({ role: i.role, content: i.content }));
  },

  getFullDialogue(npcId, playerId) {
    const m = getNpcMemory(npcId, playerId);
    const h = (Array.isArray(m.fullHistory) && m.fullHistory.length > 0)
      ? m.fullHistory : (Array.isArray(m.history) ? m.history : []);
    return h.map(i => ({
      role: i.role, content: i.content, timestamp: i.timestamp,
      systemJudgement: i.systemJudgement || undefined,
    }));
  },

  getSummary(npcId, playerId) { return getNpcMemory(npcId, playerId).summary || ''; },

  updateSummary(npcId, s, playerId) {
    getNpcMemory(npcId, playerId).summary = String(s || '').trim();
    persistMemories(playerId);
  },

  resetCurrentHistory(npcId, playerId) {
    getNpcMemory(npcId, playerId).history = [];
    persistMemories(playerId);
  },

  resetHistory(npcId, playerId) {
    const m = getNpcMemory(npcId, playerId);
    m.history = []; m.fullHistory = []; m.summary = '';
    persistMemories(playerId);
  },

  resetAll(playerId) {
    memoryStore.memories[playerId] = {};
    persistMemories(playerId);
  },

  getRoundCount(npcId, playerId) {
    const m = getNpcMemory(npcId, playerId);
    const len = Array.isArray(m.fullHistory) ? m.fullHistory.length : 0;
    return Math.floor(len / 2);
  },
};

export default memoryService;
