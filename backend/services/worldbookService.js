const fs = require('fs');
const path = require('path');
const saveService = require('./saveService');

const worldbookPath = path.join(__dirname, '..', 'data', 'worldbook.json');

function readWorldbook() {
  return JSON.parse(fs.readFileSync(worldbookPath, 'utf8'));
}

function getUnlockedIds() {
  try {
    const save = saveService.readSave();
    return Array.isArray(save.unlockedWorldbookIds) ? save.unlockedWorldbookIds : [];
  } catch (error) {
    console.error('Failed to read unlockedWorldbookIds from save:', error);
    return [];
  }
}

function isEntryUnlocked(entry, unlockedIds) {
  if (entry.constant || entry.unlockedByDefault) {
    return true;
  }
  return unlockedIds.includes(entry.id);
}

function getTriggeredEntries(npcId, playerMessage) {
  const worldbook = readWorldbook();
  const unlockedIds = getUnlockedIds();
  const entries = Array.isArray(worldbook.entries) ? worldbook.entries : [];
  
  const messageLower = String(playerMessage || '').toLowerCase();
  
  // 篩選出匹配的 entries
  const matched = entries.filter(entry => {
    // 1. 檢查是否被啟用
    if (entry.enabled === false || entry.disable === true) {
      return false;
    }
    
    // 2. 檢查是否解鎖
    if (!isEntryUnlocked(entry, unlockedIds)) {
      return false;
    }
    
    // 3. 常駐條目直接載入
    if (entry.constant) {
      return true;
    }
    
    // 4. 關鍵字比對
    const keys = Array.isArray(entry.keys) ? entry.keys : [];
    if (keys.length === 0) {
      return false;
    }
    
    return keys.some(key => {
      const keyLower = String(key || '').toLowerCase().trim();
      if (!keyLower) return false;
      return messageLower.includes(keyLower);
    });
  });
  
  // 5. 保底機制：確認當前對話 NPC 所在的「主場景條目」是否已被載入。
  // 若匹配結果中沒有包含當前 NPC 關聯的 entry（如 npcId === npcId 且已解鎖），則強制將該場景條目拼入 matched。
  const npcSceneEntry = entries.find(entry => 
    entry.npcId === npcId && 
    entry.enabled !== false && 
    entry.disable !== true &&
    isEntryUnlocked(entry, unlockedIds)
  );
  
  if (npcSceneEntry && !matched.some(e => e.id === npcSceneEntry.id)) {
    matched.push(npcSceneEntry);
  }
  
  // 按優先級（priority）進行排序
  return matched.sort((a, b) => (b.priority || 0) - (a.priority || 0));
}

function unlockEntry(id) {
  try {
    const save = saveService.readSave();
    if (!save.unlockedWorldbookIds) {
      save.unlockedWorldbookIds = [];
    }
    const entryId = Number(id);
    if (!save.unlockedWorldbookIds.includes(entryId)) {
      save.unlockedWorldbookIds.push(entryId);
      saveService.writeSave(save);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`Failed to unlock worldbook entry ${id}:`, error);
    return false;
  }
}

module.exports = {
  readWorldbook,
  getUnlockedIds,
  getTriggeredEntries,
  unlockEntry
};
