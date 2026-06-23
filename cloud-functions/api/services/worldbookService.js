/**
 * Worldbook Service —— 世界书检索与解锁 (内存存储版本)
 */
import memoryStore from './store.js';
import saveService from './saveService.js';
import INLINE_WORLDBOOK from '../data/worldbook.js';

let worldbookLoaded = false;
function ensureWorldbookLoaded() {
  if (!worldbookLoaded && INLINE_WORLDBOOK) {
    memoryStore.worldbook = INLINE_WORLDBOOK;
    worldbookLoaded = true;
  }
}

const worldbookService = {
  getEntries() {
    ensureWorldbookLoaded();
    return memoryStore.worldbook?.entries || [];
  },

  getTriggeredEntries(npcId, playerMessage, playerId) {
    ensureWorldbookLoaded();
    const entries = this.getEntries();
    const unlockedIds = playerId
      ? (saveService.readSave(playerId).unlockedWorldbookIds || [])
      : [1, 2, 3, 10, 11, 12];
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

export default worldbookService;
