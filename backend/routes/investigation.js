const express = require('express');
const saveService = require('../services/saveService');
const npcStateEngine = require('../services/npcStateEngine');

const router = express.Router();

router.post('/collect', (req, res, next) => {
  try {
    const { clueId } = req.body || {};

    if (!clueId) {
      return res.status(400).json({ error: 'clueId is required' });
    }

    const clue = saveService.getClue(clueId);
    if (!clue) {
      return res.status(404).json({ error: 'Clue not found' });
    }

    const save = saveService.readSave();
    const npc = saveService.getNpc('bridge_artist');

    if (!save.collectedClues.includes(clueId)) {
      save.collectedClues.push(clueId);
      save.player.knowledge = Math.min(100, save.player.knowledge + clue.knowledge);
      npc.knowledge = Math.min(100, npc.knowledge + clue.knowledge);
      npcStateEngine.checkUnlock(npc);
      saveService.writeSave(save);
      saveService.saveNpc(npc);
    }

    res.json({
      knowledge: npc.knowledge,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
