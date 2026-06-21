const express = require('express');
const fs = require('fs');
const path = require('path');
const saveService = require('../services/saveService');
const { NotFoundError } = require('../middleware/errors');

const router = express.Router();
const innerWorldsPath = path.join(__dirname, '..', 'data', 'innerWorlds.json');

function readInnerWorlds() {
  const raw = fs.readFileSync(innerWorldsPath, 'utf8');
  return JSON.parse(raw);
}

router.get('/:npcId', (req, res, next) => {
  try {
    const { npcId } = req.params;
    const playerId = req.playerId;
    const npc = saveService.getNpc(npcId, playerId);

    if (!npc) {
      throw new NotFoundError('NPC', npcId);
    }

    const innerWorlds = readInnerWorlds();
    const world = innerWorlds[npcId] || null;

    if (!world) {
      throw new NotFoundError('InnerWorld', npcId);
    }

    res.json({
      npcId,
      unlocked: Boolean(npc.innerWorldUnlocked),
      world: npc.innerWorldUnlocked ? world : null,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
