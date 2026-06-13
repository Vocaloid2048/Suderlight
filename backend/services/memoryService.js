const fs = require('fs');
const path = require('path');
const logger = require('../middleware/logger');

const dataDir = path.join(__dirname, '..', 'data');
const memoriesDir = path.join(dataDir, 'memories');
const MAX_TYPES = 10;
const MAX_HISTORY = 100;

// 确保记忆目录存在
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

function getRecentTypes(npcId, playerId) {
  const memory = readMemory(playerId);
  const npcMemory = memory[npcId] || {};
  return Array.isArray(npcMemory.lastInputTypes) ? npcMemory.lastInputTypes : [];
}

function addInputType(npcId, inputType, playerId) {
  const memory = readMemory(playerId);
  const npcMemory = memory[npcId] || { lastInputTypes: [], history: [], summary: '' };
  const nextTypes = [...(npcMemory.lastInputTypes || []), inputType].slice(-MAX_TYPES);

  memory[npcId] = { ...npcMemory, lastInputTypes: nextTypes };
  writeMemory(playerId, memory);
  return nextTypes;
}

function saveDialogue(npcId, userMessage, npcReply, playerId) {
  const memory = readMemory(playerId);
  const npcMemory = memory[npcId] || { lastInputTypes: [], history: [], summary: '' };
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
    timestamp: Date.now(),
  };

  const assistantEntry = {
    role: 'assistant',
    content: cleanReply,
    timestamp: Date.now(),
  };

  const nextHistory = [...npcMemory.history, userEntry, assistantEntry].slice(-MAX_HISTORY);
  memory[npcId] = { ...npcMemory, history: nextHistory };
  writeMemory(playerId, memory);
}

function getRecentDialogue(npcId, limit = 20, playerId) {
  const memory = readMemory(playerId);
  const npcMemory = memory[npcId] || {};
  const history = Array.isArray(npcMemory.history) ? npcMemory.history : [];

  return history.slice(-limit).map(item => ({
    role: item.role,
    content: item.content,
  }));
}

function getSummary(npcId, playerId) {
  const memory = readMemory(playerId);
  const npcMemory = memory[npcId] || {};
  return npcMemory.summary || '';
}

function updateSummary(npcId, newSummary, playerId) {
  const memory = readMemory(playerId);
  const npcMemory = memory[npcId] || { lastInputTypes: [], history: [], summary: '' };
  memory[npcId] = { ...npcMemory, summary: String(newSummary || '').trim() };
  writeMemory(playerId, memory);
}

function getDialogueHistorySlice(npcId, startOffsetFromEnd = 30, endOffsetFromEnd = 10, playerId) {
  const memory = readMemory(playerId);
  const npcMemory = memory[npcId] || {};
  const history = Array.isArray(npcMemory.history) ? npcMemory.history : [];

  if (history.length <= endOffsetFromEnd) {
    return history.map(item => ({ role: item.role, content: item.content }));
  }

  return history
    .slice(-startOffsetFromEnd, -endOffsetFromEnd)
    .map(item => ({ role: item.role, content: item.content }));
}

module.exports = {
  getRecentTypes,
  addInputType,
  saveDialogue,
  getRecentDialogue,
  getSummary,
  updateSummary,
  getDialogueHistorySlice,
};
