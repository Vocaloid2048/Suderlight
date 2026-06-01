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
          affinity: npc.trust,
          stress: npc.stress,
          stateLabel: npcStateEngine.getStateLabel(npc),
        },
      });
    }

    const aiReply = await deepseekService.generateNpcReply(npcId, message);
    const updatedNpc = npcStateEngine.updateAfterDialogue(npc, message);
    saveService.saveNpc(updatedNpc);

    res.json({
      text: aiReply.text,
      psychology: {
        affinity: updatedNpc.trust,
        stress: updatedNpc.stress,
        stateLabel: npcStateEngine.getStateLabel(updatedNpc),
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
