const express = require('express');
const clueEngine = require('../services/clueEngine');
const { unlockByClue } = require('./dictionary');

const router = express.Router();

router.post('/collect', (req, res, next) => {
  try {
    const { clueId } = req.body || {};

    if (!clueId) {
      return res.status(400).json({ error: 'clueId is required' });
    }

    const result = clueEngine.collectClue(clueId);

    if (!result.ok) {
      return res.status(result.status || 500).json({ error: result.error });
    }

    // 根据收集的线索解锁心理词条
    const unlockedEntries = unlockByClue(clueId);

    res.json({
      clueId: result.clue.id,
      npcId: result.clue.npcId,
      knowledge: result.npc.knowledge,
      addedKnowledge: result.alreadyCollected ? 0 : result.clue.knowledge,
      alreadyCollected: result.alreadyCollected,
      innerWorldUnlocked: result.npc.innerWorldUnlocked,
      collectedClues: result.collectedClues,
      unlockedEntries,
      npcState: {
        trust: result.npc.trust,
        stress: result.npc.stress,
        knowledge: result.npc.knowledge,
        innerWorldUnlocked: result.npc.innerWorldUnlocked,
        ending: result.npc.ending,
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
