const express = require('express');
const clueEngine = require('../services/clueEngine');
const { unlockByClue } = require('./dictionary');
const { ValidationError } = require('../middleware/errors');
const saveService = require('../services/saveService');

const router = express.Router();

router.post('/collect', (req, res, next) => {
  try {
    const { clueId } = req.body || {};
    const playerId = req.playerId;

    if (!clueId) {
      throw new ValidationError('clueId is required');
    }

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
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
