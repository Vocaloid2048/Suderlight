const express = require('express');
const { z } = require('zod');
const deepseekService = require('../services/deepseekService');
const promptBuilder = require('../services/promptBuilder');
const saveService = require('../services/saveService');
const npcStateEngine = require('../services/npcStateEngine');
const memoryService = require('../services/memoryService');
const worldbookService = require('../services/worldbookService');
const summaryService = require('../services/summaryService');
const { withPlayerLock } = require('../services/playerLockService');
const logger = require('../middleware/logger');
const { ValidationError, NotFoundError } = require('../middleware/errors');

const router = express.Router();

const chatSchema = z.object({
  npcId: z.string().min(1).max(64),
  message: z.string().min(1).max(5000),
});

function unlockNpcWorldbookEntries(npcId, npcState, playerId) {
  const npcs = saveService.readNpcs();
  const npcTemplate = npcs[npcId] || {};
  const unlockIds = Array.isArray(npcTemplate.worldbookUnlockIds) ? npcTemplate.worldbookUnlockIds : [];
  if (unlockIds.length === 0) return;

  const shouldUnlock =
    npcState.innerWorldUnlocked ||
    npcState.knowledge >= (npcState.knowledgeRequired || 70);

  if (!shouldUnlock) return;
  unlockIds.forEach((entryId) => worldbookService.unlockEntry(entryId, playerId));
}

// GET /api/chat/history/:npcId — 獲取完整的對話紀錄
router.get('/history/:npcId', (req, res, next) => {
  try {
    const npcId = req.params.npcId;
    const playerId = req.playerId;
    const history = playerId ? memoryService.getFullDialogue(npcId, playerId) : [];
    res.json({ history });
  } catch (error) {
    next(error);
  }
});

// POST /api/chat/reset/:npcId — 重置對話紀錄
router.post('/reset/:npcId', (req, res, next) => {
  try {
    const npcId = req.params.npcId;
    const playerId = req.playerId;
    if (playerId) {
      memoryService.resetHistory(npcId, playerId);
    }
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// POST /api/chat/reset-all — 重置該球員的所有對話紀錄
router.post('/reset-all', (req, res, next) => {
  try {
    const playerId = req.playerId;
    if (playerId) {
      memoryService.resetAll(playerId);
    }
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const parsed = chatSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(
        'Invalid request body',
        parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
      );
    }

    const { npcId, message } = parsed.data;
    const playerId = req.playerId;
    if (!playerId) {
      throw new ValidationError('Missing X-Player-Id header');
    }

    await withPlayerLock(playerId, async () => {
      const userTimestamp = Date.now();
      const npc = saveService.getNpc(npcId, playerId);
      if (!npc) {
        throw new NotFoundError('NPC', npcId);
      }

      if (npc.ending !== 'none') {
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
      const recentInputTypes = memoryService.getRecentTypes(npcId, playerId);
      const messages = promptBuilder.buildPrompt(npcId, message, recentInputTypes, playerId);

      let reply = await deepseekService.chat(messages);
      if (!reply || reply.trim() === '') {
        reply = '他只是沈默地看著畫布，雨聲填滿了對話的空白。';
      }

      const stateUpdate = npcStateEngine.updateAfterDialogue(npc, message, dialogueType);
      const systemJudgement = {
        stateLabel: npcStateEngine.getStateLabel(stateUpdate.npc),
        trustDelta: stateUpdate.trustDelta,
        stressDelta: stateUpdate.stressDelta,
        knowledgeDelta: stateUpdate.npc.knowledge - npc.knowledge,
        trust: stateUpdate.npc.trust,
        stress: stateUpdate.npc.stress,
        knowledge: stateUpdate.npc.knowledge,
      };

      memoryService.addInputType(npcId, stateUpdate.dialogueType, playerId);
      memoryService.saveDialogue(npcId, message, reply, playerId, userTimestamp, systemJudgement);
      saveService.saveNpc(stateUpdate.npc, playerId);

      unlockNpcWorldbookEntries(npcId, stateUpdate.npc, playerId);

      res.json({
        text: reply,
        psychology: {
          trustDelta: stateUpdate.trustDelta,
          stressDelta: stateUpdate.stressDelta,
          stateLabel: systemJudgement.stateLabel,
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

      if (memoryService.getRoundCount(npcId, playerId) % 10 === 0) {
        const oldSummary = memoryService.getSummary(npcId, playerId);
        const segment = memoryService.getRecentDialogue(npcId, 20, playerId);
        memoryService.resetCurrentHistory(npcId, playerId);

        void summaryService.generateUpdatedSummary(oldSummary, segment)
          .then(newSummary => {
            if (newSummary && newSummary !== '無' && newSummary.trim() !== '') {
              memoryService.updateSummary(npcId, newSummary, playerId);
              logger.info({ npcId, playerId }, 'Long-term summary updated after 10 rounds');
            }
          })
          .catch(err => {
            logger.error({ err, npcId, playerId }, 'Summary update failed');
          });
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
