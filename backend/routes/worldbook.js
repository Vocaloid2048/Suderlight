const express = require('express');
const worldbookService = require('../services/worldbookService');
const { ValidationError } = require('../middleware/errors');

const router = express.Router();

router.get('/', (req, res, next) => {
  try {
    const playerId = req.playerId;
    const unlockedIds = worldbookService.getUnlockedIds(playerId);
    const entries = worldbookService
      .readWorldbook()
      .entries
      .filter((entry) => entry.constant || entry.unlockedByDefault || unlockedIds.includes(entry.id))
      .sort((a, b) => (b.priority || 0) - (a.priority || 0));

    res.json({ entries });
  } catch (error) {
    next(error);
  }
});

router.post('/triggered', (req, res, next) => {
  try {
    const playerId = req.playerId;
    const { npcId, message } = req.body || {};

    if (!npcId || typeof message !== 'string') {
      throw new ValidationError('npcId and message are required');
    }

    const entries = worldbookService.getTriggeredEntries(npcId, message, playerId);
    res.json({ entries });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
