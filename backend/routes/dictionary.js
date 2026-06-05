const express = require('express');
const router = express.Router();
const dictionaryData = require('../data/dictionary.json');

// 内存解锁状态（暂不持久化）
const unlockedSet = new Set();

/**
 * 根据线索 ID 解锁关联的心理词条
 * @param {string} clueId
 * @returns {string[]} 本次新解锁的词条 id 列表
 */
function unlockByClue(clueId) {
  const newlyUnlocked = [];
  for (const entry of dictionaryData.entries) {
    if (entry.relatedClues.includes(clueId) && !unlockedSet.has(entry.id)) {
      unlockedSet.add(entry.id);
      newlyUnlocked.push(entry.id);
    }
  }
  return newlyUnlocked;
}

router.get('/', (req, res, next) => {
  try {
    const entries = dictionaryData.entries.map(entry => ({
      id: entry.id,
      name: entry.name,
      description: entry.description,
      relatedClues: entry.relatedClues,
      unlocked: unlockedSet.has(entry.id),
    }));

    res.json({ entries });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
module.exports.unlockByClue = unlockByClue;
