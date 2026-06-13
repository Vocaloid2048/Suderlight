const express = require('express');
const saveService = require('../services/saveService');
const npcStateEngine = require('../services/npcStateEngine');
const ghostEngine = require('../services/ghostEngine');
const { NotFoundError, ConflictError } = require('../middleware/errors');

const router = express.Router();

router.get('/:id', (req, res, next) => {
  try {
    const playerId = req.playerId;
    const npc = saveService.getNpc(req.params.id, playerId);
    if (!npc) {
      throw new NotFoundError('NPC', req.params.id);
    }

    npcStateEngine.checkUnlock(npc);
    saveService.saveNpc(npc, playerId);

    res.json({
      trust: npc.trust,
      stress: npc.stress,
      knowledge: npc.knowledge,
      innerWorldUnlocked: npc.innerWorldUnlocked,
      ending: npc.ending,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/ending', (req, res, next) => {
  try {
    const playerId = req.playerId;
    const { ending } = req.body || {};
    const npc = saveService.getNpc(req.params.id, playerId);

    if (!npc) {
      throw new NotFoundError('NPC', req.params.id);
    }

    if (ending === 'success' && !npc.innerWorldUnlocked) {
      throw new ConflictError('Inner world is not unlocked yet');
    }

    npcStateEngine.setEnding(npc, ending);
    saveService.saveNpc(npc, playerId);

    if (ending === 'failed') {
      ghostEngine.addFailedNPC(npc.id);
    }

    res.json({
      id: npc.id,
      ending: npc.ending,
      innerWorldUnlocked: npc.innerWorldUnlocked,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
