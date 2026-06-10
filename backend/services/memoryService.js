const fs = require('fs');
const path = require('path');

const memoryPath = path.join(__dirname, '..', 'data', 'dialogueMemory.json');
const MAX_TYPES = 10;
const MAX_HISTORY = 100; // 最多保留 100 條實體歷史以節省磁碟空間

function ensureMemoryFile() {
  if (!fs.existsSync(memoryPath)) {
    fs.writeFileSync(memoryPath, '{}\n', 'utf8');
  }
}

function readMemory() {
  ensureMemoryFile();
  try {
    return JSON.parse(fs.readFileSync(memoryPath, 'utf8'));
  } catch (err) {
    console.error('Failed to parse dialogueMemory.json, resetting to empty object', err);
    return {};
  }
}

function writeMemory(memory) {
  fs.writeFileSync(memoryPath, `${JSON.stringify(memory, null, 2)}\n`, 'utf8');
}

function getRecentTypes(npcId) {
  const memory = readMemory();
  const npcMemory = memory[npcId] || {};
  return Array.isArray(npcMemory.lastInputTypes) ? npcMemory.lastInputTypes : [];
}

function addInputType(npcId, inputType) {
  const memory = readMemory();
  const npcMemory = memory[npcId] || { lastInputTypes: [], history: [], summary: '' };
  const nextTypes = [...(npcMemory.lastInputTypes || []), inputType].slice(-MAX_TYPES);

  memory[npcId] = {
    ...npcMemory,
    lastInputTypes: nextTypes,
  };

  writeMemory(memory);
  return nextTypes;
}

/**
 * 儲存單輪對話
 */
function saveDialogue(npcId, userMessage, npcReply) {
  const memory = readMemory();
  const npcMemory = memory[npcId] || { lastInputTypes: [], history: [], summary: '' };
  if (!Array.isArray(npcMemory.history)) {
    npcMemory.history = [];
  }

  // 清洗對話格式，移除可能殘留的 markdown / JSON tags
  const cleanReply = String(npcReply || '')
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();

  const userEntry = {
    role: 'user',
    content: String(userMessage || '').trim(),
    timestamp: Date.now()
  };

  const assistantEntry = {
    role: 'assistant',
    content: cleanReply,
    timestamp: Date.now()
  };

  // 追加對話歷史並截斷至最大歷史數
  const nextHistory = [...npcMemory.history, userEntry, assistantEntry].slice(-MAX_HISTORY);

  memory[npcId] = {
    ...npcMemory,
    history: nextHistory
  };

  writeMemory(memory);
}

/**
 * 獲取最近 limit 條對話歷史（用於滑動窗口）
 * 返回格式符合 OpenAI/DeepSeek messages 陣列
 */
function getRecentDialogue(npcId, limit = 20) {
  const memory = readMemory();
  const npcMemory = memory[npcId] || {};
  const history = Array.isArray(npcMemory.history) ? npcMemory.history : [];
  
  // 只返回最後 limit 條，且只提取 role 與 content
  return history.slice(-limit).map(item => ({
    role: item.role,
    content: item.content
  }));
}

/**
 * 獲取長期情感與對話摘要
 */
function getSummary(npcId) {
  const memory = readMemory();
  const npcMemory = memory[npcId] || {};
  return npcMemory.summary || '';
}

/**
 * 更新長期情感與對話摘要
 */
function updateSummary(npcId, newSummary) {
  const memory = readMemory();
  const npcMemory = memory[npcId] || { lastInputTypes: [], history: [], summary: '' };
  
  memory[npcId] = {
    ...npcMemory,
    summary: String(newSummary || '').trim()
  };
  
  writeMemory(memory);
}

/**
 * 獲取未摘要的新對話片斷用於滾動更新
 */
function getDialogueHistorySlice(npcId, startOffsetFromEnd = 30, endOffsetFromEnd = 10) {
  const memory = readMemory();
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
  getDialogueHistorySlice
};
