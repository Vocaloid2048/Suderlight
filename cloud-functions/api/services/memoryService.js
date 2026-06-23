/**
 * Memory Service —— 对话记忆管理 (内存存储版本)
 */
import memoryStore from './store.js';

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
    return Array.isArray(getNpcMemory(npcId, playerId).lastInputTypes)
      ? getNpcMemory(npcId, playerId).lastInputTypes : [];
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
  },

  resetCurrentHistory(npcId, playerId) {
    getNpcMemory(npcId, playerId).history = [];
  },

  resetHistory(npcId, playerId) {
    const m = getNpcMemory(npcId, playerId);
    m.history = []; m.fullHistory = []; m.summary = '';
  },

  resetAll(playerId) { memoryStore.memories[playerId] = {}; },

  getRoundCount(npcId, playerId) {
    const m = getNpcMemory(npcId, playerId);
    const len = Array.isArray(m.fullHistory) ? m.fullHistory.length : 0;
    return Math.floor(len / 2);
  },
};

export default memoryService;
