const fs = require('fs');
const path = require('path');
const saveService = require('./saveService');

const worldbookPath = path.join(__dirname, '..', 'data', 'worldbook.json');

function readWorldbook() {
  return JSON.parse(fs.readFileSync(worldbookPath, 'utf8'));
}

function getUnlockedIds(playerId) {
  try {
    const save = saveService.readSave(playerId);
    return Array.isArray(save.unlockedWorldbookIds) ? save.unlockedWorldbookIds : [];
  } catch (error) {
    const logger = require('../middleware/logger');
    logger.warn({ err: error, playerId }, 'Failed to read unlockedWorldbookIds from save');
    return [];
  }
}

function isEntryUnlocked(entry, unlockedIds) {
  if (entry.constant || entry.unlockedByDefault) {
    return true;
  }
  return unlockedIds.includes(entry.id);
}

function getTriggeredEntries(npcId, playerMessage, playerId) {
  const worldbook = readWorldbook();
  const unlockedIds = getUnlockedIds(playerId);
  const entries = Array.isArray(worldbook.entries) ? worldbook.entries : [];
  
  const messageLower = String(playerMessage || '').toLowerCase();
  
  const matched = entries.filter(entry => {
    if (entry.enabled === false || entry.disable === true) {
      return false;
    }
    
    if (!isEntryUnlocked(entry, unlockedIds)) {
      return false;
    }
    
    if (entry.constant) {
      return true;
    }
    
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
  
  const npcSceneEntry = entries.find(entry => 
    entry.npcId === npcId && 
    entry.enabled !== false && 
    entry.disable !== true &&
    isEntryUnlocked(entry, unlockedIds)
  );
  
  if (npcSceneEntry && !matched.some(e => e.id === npcSceneEntry.id)) {
    matched.push(npcSceneEntry);
  }
  
  return matched.sort((a, b) => (b.priority || 0) - (a.priority || 0));
}

function unlockEntry(id, playerId) {
  try {
    const save = saveService.readSave(playerId);
    if (!save.unlockedWorldbookIds) {
      save.unlockedWorldbookIds = [];
    }
    const entryId = Number(id);
    if (!save.unlockedWorldbookIds.includes(entryId)) {
      save.unlockedWorldbookIds.push(entryId);
      saveService.writeSave(playerId, save);
      return true;
    }
    return false;
  } catch (error) {
    const logger = require('../middleware/logger');
    logger.error({ err: error, entryId: id, playerId }, 'Failed to unlock worldbook entry');
    return false;
  }
}

module.exports = {
  readWorldbook,
  getUnlockedIds,
  getTriggeredEntries,
  unlockEntry,
};
