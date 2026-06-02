const express = require('express');
const deepseekService = require('../services/deepseekService');
const saveService = require('../services/saveService');
const npcStateEngine = require('../services/npcStateEngine');

const router = express.Router();

router.post('/', async (req, res, next) => {
  try {
    const { npcId, message } = req.body || {};

    if (!npcId || !message) {
      return res.status(400).json({ error: 'npcId and message are required' });
    }

    const npc = saveService.getNpc(npcId);
    if (!npc) {
      return res.status(404).json({ error: 'NPC not found' });
    }

    if (npc.ending) {
      return res.json({
        text: npc.ending === 'success'
          ? '雨聲還在。他沒有痊癒，但沒有再把自己藏進空白裡。'
          : '天橋上只剩潮濕的紙張。那個人影沒有再回頭。',
        psychology: {
          trustDelta: 0,
          stressDelta: 0,
          stateLabel: npcStateEngine.getStateLabel(npc),
        },
      });
    }

    const aiReply = await deepseekService.generateNpcReply(npcId, message);
    const stateUpdate = npcStateEngine.updateAfterDialogue(npc, message);
    saveService.saveNpc(stateUpdate.npc);

    res.json({
      text: aiReply.text,
      psychology: {
        trustDelta: stateUpdate.trustDelta,
        stressDelta: stateUpdate.stressDelta,
        stateLabel: npcStateEngine.getStateLabel(stateUpdate.npc),
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
