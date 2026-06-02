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
    const world = innerWorlds[npcId] || null;

    if (!world) {
      return res.status(404).json({ error: 'Inner world not found' });
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
