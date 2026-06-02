const express = require('express');
const deepseekService = require('../services/deepseekService');
const promptBuilder = require('../services/promptBuilder');
const saveService = require('../services/saveService');
const npcStateEngine = require('../services/npcStateEngine');
const memoryService = require('../services/memoryService');


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
        npcState: {
          trust: npc.trust,
          stress: npc.stress,
          knowledge: npc.knowledge,
          innerWorldUnlocked: npc.innerWorldUnlocked,
          ending: npc.ending,
        },
      });
    }


    const dialogueType = npcStateEngine.classifyDialogue(message);
    const recentInputTypes = memoryService.getRecentTypes(npcId);
    const messages = promptBuilder.buildPrompt(npcId, message, recentInputTypes);
    const reply = await deepseekService.chat(messages);

    const stateUpdate = npcStateEngine.updateAfterDialogue(npc, message, dialogueType);
    memoryService.addInputType(npcId, stateUpdate.dialogueType);
    saveService.saveNpc(stateUpdate.npc);


    res.json({
      text: reply,
      psychology: {
        trustDelta: stateUpdate.trustDelta,
        stressDelta: stateUpdate.stressDelta,
        stateLabel: npcStateEngine.getStateLabel(stateUpdate.npc),
        inputType: stateUpdate.dialogueType,
      },
      npcState: {
        trust: stateUpdate.npc.trust,
        stress: stateUpdate.npc.stress,
        knowledge: stateUpdate.npc.knowledge,
        innerWorldUnlocked: stateUpdate.npc.innerWorldUnlocked,
        ending: stateUpdate.npc.ending,
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
