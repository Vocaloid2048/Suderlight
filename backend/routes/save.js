const express = require('express');
const saveService = require('../services/saveService');

const router = express.Router();

router.get('/', (req, res, next) => {
  try {
    res.json({
      save: saveService.readSave(),
      npcs: saveService.readNpcs(),
    });
  } catch (error) {
    next(error);
  }
});

router.post('/', (req, res, next) => {
  try {
    const payload = req.body || {};

    if (payload.player || payload.ghosts || payload.collectedClues) {
      const currentSave = saveService.readSave();
      saveService.writeSave({
        player: payload.player || currentSave.player || {},
        ghosts: Array.isArray(payload.ghosts) ? payload.ghosts : currentSave.ghosts || [],
        collectedClues: Array.isArray(payload.collectedClues)
          ? payload.collectedClues
          : currentSave.collectedClues || [],
      });
    }

    if (payload.npcs) {
      saveService.writeNpcs(payload.npcs);
    }

    res.json({
      ok: true,
      save: saveService.readSave(),
      npcs: saveService.readNpcs(),
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
