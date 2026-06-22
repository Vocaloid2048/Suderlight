const express = require('express');
const clueEngine = require('../services/clueEngine');
const { unlockByClue } = require('./dictionary');
const { withPlayerLock } = require('../services/playerLockService');
const { ValidationError } = require('../middleware/errors');
const router = express.Router();

router.post('/collect', async (req, res, next) => {
  try {
    const { clueId } = req.body || {};
    const playerId = req.playerId;

    if (!clueId) {
      throw new ValidationError('clueId is required');
    }

    await withPlayerLock(playerId, async () => {
      const result = clueEngine.collectClue(clueId, playerId);

      if (!result.ok) {
        return res.status(result.status || 500).json({ error: result.error });
      }

      const newlyUnlocked = unlockByClue(clueId);

      res.json({
        ok: true,
        clue: result.clue,
        knowledgeAdded: result.knowledgeAdded,
        newlyUnlockedDictionary: newlyUnlocked,
        unlockedEntries: newlyUnlocked,
      });
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
