const express = require('express');
const saveService = require('../services/saveService');
const npcStateEngine = require('../services/npcStateEngine');
const ghostEngine = require('../services/ghostEngine');

const router = express.Router();

router.get('/:id', (req, res, next) => {
  try {
    const npc = saveService.getNpc(req.params.id);
    if (!npc) {
      return res.status(404).json({ error: 'NPC not found' });
    }

    npcStateEngine.checkUnlock(npc);
    saveService.saveNpc(npc);

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
    const { ending } = req.body || {};
    const npc = saveService.getNpc(req.params.id);

    if (!npc) {
      return res.status(404).json({ error: 'NPC not found' });
    }

    if (ending === 'success' && !npc.innerWorldUnlocked) {
      return res.status(409).json({ error: 'Inner world is not unlocked yet' });
    }

    npcStateEngine.setEnding(npc, ending);
    saveService.saveNpc(npc);

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
