const fs = require('fs');
const path = require('path');
const logger = require('../middleware/logger');

const dataDir = path.join(__dirname, '..', 'data');
const memoriesDir = path.join(dataDir, 'memories');
const MAX_TYPES = 10;
// We no longer strictly limit history inside recentDialogue slice, but we will store full history

if (!fs.existsSync(memoriesDir)) {
  fs.mkdirSync(memoriesDir, { recursive: true });
}

function memoryPath(playerId) {
  const sanitized = String(playerId || 'global').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
  return path.join(memoriesDir, `${sanitized}.json`);
}

function ensureMemoryFile(playerId) {
  const p = memoryPath(playerId);
  if (!fs.existsSync(p)) {
    fs.writeFileSync(p, '{}\n', 'utf8');
  }
}

function readMemory(playerId) {
  ensureMemoryFile(playerId);
  try {
    return JSON.parse(fs.readFileSync(memoryPath(playerId), 'utf8'));
  } catch (err) {
    logger.error({ err, playerId }, 'Failed to parse dialogueMemory — resetting');
    return {};
  }
}

function writeMemory(playerId, memory) {
  fs.writeFileSync(memoryPath(playerId), `${JSON.stringify(memory, null, 2)}\n`, 'utf8');
}

function getDefaultNpcMemory() {
  return { lastInputTypes: [], history: [], fullHistory: [], summary: '', roundCount: 0 };
}

function getRecentTypes(npcId, playerId) {
  const memory = readMemory(playerId);
  const npcMemory = memory[npcId] || getDefaultNpcMemory();
  return Array.isArray(npcMemory.lastInputTypes) ? npcMemory.lastInputTypes : [];
}

function addInputType(npcId, inputType, playerId) {
  const memory = readMemory(playerId);
  const npcMemory = memory[npcId] || getDefaultNpcMemory();
  const nextTypes = [...(npcMemory.lastInputTypes || []), inputType].slice(-MAX_TYPES);

  memory[npcId] = { ...npcMemory, lastInputTypes: nextTypes };
  writeMemory(playerId, memory);
  return nextTypes;
}

function saveDialogue(npcId, userMessage, npcReply, playerId, userTimestamp) {
  const memory = readMemory(playerId);
  const npcMemory = memory[npcId] || getDefaultNpcMemory();
  
  if (!Array.isArray(npcMemory.fullHistory)) {
    // 兼容舊資料：若沒有 fullHistory，就把舊的 history 搬過來
    npcMemory.fullHistory = Array.isArray(npcMemory.history) ? [...npcMemory.history] : [];
  }
  if (!Array.isArray(npcMemory.history)) {
    npcMemory.history = [];
  }

  const cleanReply = String(npcReply || '')
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();

  const userEntry = {
    role: 'user',
    content: String(userMessage || '').trim(),
    timestamp: userTimestamp || Date.now(),
  };

  const assistantEntry = {
    role: 'assistant',
    content: cleanReply,
    timestamp: Date.now(),
  };

  npcMemory.fullHistory.push(userEntry, assistantEntry);
  npcMemory.history.push(userEntry, assistantEntry);
  npcMemory.roundCount = (npcMemory.roundCount || 0) + 1;

  memory[npcId] = npcMemory;
  writeMemory(playerId, memory);
}

function getRecentDialogue(npcId, limit = 20, playerId) { // default 20 messages = 10 rounds
  const memory = readMemory(playerId);
  const npcMemory = memory[npcId] || getDefaultNpcMemory();
  // 只返回當前 10 輪循環內的歷史
  const history = Array.isArray(npcMemory.history) ? npcMemory.history : [];

  return history.slice(-limit).map(item => ({
    role: item.role,
    content: item.content,
  }));
}

function getFullDialogue(npcId, playerId) {
  const memory = readMemory(playerId);
  const npcMemory = memory[npcId] || getDefaultNpcMemory();
  const history = Array.isArray(npcMemory.fullHistory) && npcMemory.fullHistory.length > 0 
    ? npcMemory.fullHistory 
    : (Array.isArray(npcMemory.history) ? npcMemory.history : []);
    
  return history.map(item => ({
    role: item.role,
    content: item.content,
  }));
}

function getSummary(npcId, playerId) {
  const memory = readMemory(playerId);
  const npcMemory = memory[npcId] || getDefaultNpcMemory();
  return npcMemory.summary || '';
}

function updateSummary(npcId, newSummary, playerId) {
  const memory = readMemory(playerId);
  const npcMemory = memory[npcId] || getDefaultNpcMemory();
  memory[npcId] = { ...npcMemory, summary: String(newSummary || '').trim() };
  writeMemory(playerId, memory);
}

function resetCurrentHistory(npcId, playerId) {
  const memory = readMemory(playerId);
  const npcMemory = memory[npcId] || getDefaultNpcMemory();
  npcMemory.history = [];
  memory[npcId] = npcMemory;
  writeMemory(playerId, memory);
}

function resetHistory(npcId, playerId) {
  const memory = readMemory(playerId);
  const npcMemory = memory[npcId] || getDefaultNpcMemory();
  memory[npcId] = { ...npcMemory, history: [], fullHistory: [], summary: '', roundCount: 0 };
  writeMemory(playerId, memory);
}

function resetAll(playerId) {
  logger.info({ playerId }, 'Resetting all memory for player');
  writeMemory(playerId, {});
}

function getRoundCount(npcId, playerId) {
  const memory = readMemory(playerId);
  const npcMemory = memory[npcId] || getDefaultNpcMemory();
  return npcMemory.roundCount || 0;
}

module.exports = {
  getRecentTypes,
  addInputType,
  saveDialogue,
  getRecentDialogue,
  getFullDialogue,
  getSummary,
  updateSummary,
  resetCurrentHistory,
  resetHistory,
  resetAll,
  getRoundCount
};
