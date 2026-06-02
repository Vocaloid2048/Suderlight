const express = require('express');
const fs = require('fs');
const path = require('path');
const saveService = require('../services/saveService');

const router = express.Router();
const innerWorldsPath = path.join(__dirname, '..', 'data', 'innerWorlds.json');

function readInnerWorlds() {
  const raw = fs.readFileSync(innerWorldsPath, 'utf8');
  return JSON.parse(raw);
}

router.get('/:npcId', (req, res, next) => {
  try {
    const { npcId } = req.params;
    const npc = saveService.getNpc(npcId);

    if (!npc) {
      return res.status(404).json({ error: 'NPC not found' });
    }

    const innerWorlds = readInnerWorlds();
    const innerWorld = innerWorlds[npcId];

    if (!innerWorld) {
      return res.status(404).json({ error: 'Inner world not found' });
    }

    res.json({
      npcId,
      unlocked: Boolean(npc.innerWorldUnlocked),
      world: {
        name: innerWorld.name,
        stage: innerWorld.stages?.[0]?.id || 1,
        emotion: innerWorld.emotion,
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
