/**
 * Dictionary 路由 —— 情绪词典查询与解锁
 * 参考 main branch 实现：根据玩家收集的线索，标记哪些词条已解锁
 */
import { Router } from 'express';
import memoryStore from '../services/store.js';
import saveService from '../services/saveService.js';
import INLINE_DICTIONARY from '../data/dictionary.js';

let dictionaryLoaded = false;
function ensureLoaded() {
  if (!dictionaryLoaded && INLINE_DICTIONARY && memoryStore.dictionary.length === 0) {
    memoryStore.dictionary = INLINE_DICTIONARY;
    dictionaryLoaded = true;
  }
}

/**
 * 根据玩家已收集的线索，解锁关联的词条
 * @param {string} clueId 刚收集的线索 ID
 * @param {string} playerId 玩家 ID
 * @returns {string[]} 本次新解锁的词条 ID 列表
 */
function unlockByClue(clueId, playerId) {
  ensureLoaded();
  const dict = memoryStore.dictionary || [];
  const entries = Array.isArray(dict.entries) ? dict.entries : [];
  const save = saveService.readSave(playerId);
  const unlocked = Array.isArray(save.unlockedDictionaryEntries)
    ? [...save.unlockedDictionaryEntries]
    : [];

  const newlyUnlocked = [];
  for (const entry of entries) {
    // 通过 relatedClues 判断是否与该线索关联
    const related = Array.isArray(entry.relatedClues) ? entry.relatedClues : [];
    if ((related.includes(clueId) || entry.unlockCondition === clueId) && !unlocked.includes(entry.id)) {
      unlocked.push(entry.id);
      newlyUnlocked.push(entry.id);
    }
  }

  if (newlyUnlocked.length > 0) {
    save.unlockedDictionaryEntries = unlocked;
    saveService.writeSave(playerId, save);
  }

  return newlyUnlocked;
}

const router = Router();

// GET /dictionary — 返回静态词典数据，解锁状态由前端根据本地存档判断
router.get('/', (req, res, next) => {
  try {
    ensureLoaded();
    const dict = memoryStore.dictionary || [];
    const entries = Array.isArray(dict.entries) ? dict.entries : [];

    const result = entries.map(entry => ({
      id: entry.id,
      name: entry.name,
      description: entry.description,
      relatedClues: entry.relatedClues || [],
      unlockCondition: entry.unlockCondition,
    }));

    res.json({ entries: result });
  } catch (e) { next(e); }
});

export default router;
export { unlockByClue };
