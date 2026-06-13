const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const dictionaryData = require('../data/dictionary.json');
const logger = require('../middleware/logger');

// 持久化解锁状态到文件
const unlockedPath = path.join(__dirname, '..', 'data', 'unlockedDictionary.json');

function loadUnlockedSet() {
  try {
    if (fs.existsSync(unlockedPath)) {
      const data = JSON.parse(fs.readFileSync(unlockedPath, 'utf8'));
      return new Set(Array.isArray(data) ? data : []);
    }
  } catch (err) {
    logger.warn({ err }, 'Failed to load unlocked dictionary — starting fresh');
  }
  return new Set();
}

function saveUnlockedSet(set) {
  try {
    fs.writeFileSync(unlockedPath, JSON.stringify([...set]), 'utf8');
  } catch (err) {
    logger.error({ err }, 'Failed to persist unlocked dictionary');
  }
}

// 服务启动时从文件恢复
const unlockedSet = loadUnlockedSet();

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
  if (newlyUnlocked.length > 0) {
    saveUnlockedSet(unlockedSet);
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
