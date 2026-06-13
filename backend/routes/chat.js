const express = require('express');
const { z } = require('zod');
const deepseekService = require('../services/deepseekService');
const promptBuilder = require('../services/promptBuilder');
const saveService = require('../services/saveService');
const npcStateEngine = require('../services/npcStateEngine');
const memoryService = require('../services/memoryService');
const worldbookService = require('../services/worldbookService');
const summaryService = require('../services/summaryService');
const logger = require('../middleware/logger');
const { ValidationError, NotFoundError } = require('../middleware/errors');

const router = express.Router();

// ---- 请求体验证 schema ----
const chatSchema = z.object({
  npcId: z.string().min(1).max(64),
  message: z.string().min(1).max(5000),
});

router.post('/', async (req, res, next) => {
  try {
    // Input validation — fail fast
    const parsed = chatSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(
        'Invalid request body',
        parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
      );
    }
    const { npcId, message } = parsed.data;
    const playerId = req.playerId;

    const npc = saveService.getNpc(npcId, playerId);
    if (!npc) {
      throw new NotFoundError('NPC', npcId);
    }

    // 1. 若已經走到結局，直接返回結局文本
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

    // 2. 進行對話分類
    const dialogueType = npcStateEngine.classifyDialogue(message);
    const recentInputTypes = playerId
      ? memoryService.getRecentTypes(npcId, playerId)
      : [];

    // 3. 獲取最近歷史對話（按球员隔离）
    const recentHistory = playerId
      ? memoryService.getRecentDialogue(npcId, 20, playerId)
      : [];

    // 4. 建立與 LLM 互動的 messages 陣列（按球员隔离）
    const messages = promptBuilder.buildPrompt(npcId, message, recentInputTypes, playerId);

    // 5. 調用 AI 生成 NPC 回覆
    const reply = await deepseekService.chat(messages);

    // 6. 更新 NPC 情感狀態
    const stateUpdate = npcStateEngine.updateAfterDialogue(npc, message, dialogueType);

    // 7. 保存對話語氣、NPC 狀態與實體對話歷史（按球员隔离）
    if (playerId) {
      memoryService.addInputType(npcId, stateUpdate.dialogueType, playerId);
      memoryService.saveDialogue(npcId, message, reply, playerId);
    }
    saveService.saveNpc(stateUpdate.npc, playerId);

    // 8. 世界書區域解鎖判定
    if (npcId === 'bridge_artist') {
      if (stateUpdate.npc.innerWorldUnlocked || stateUpdate.npc.knowledge >= 70) {
        worldbookService.unlockEntry(5, playerId);
        worldbookService.unlockEntry(7, playerId);
      }
    }

    // 9. 響應客戶端
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

    // 10. 異步非阻塞地更新「長期摘要記憶」
    if (playerId && recentHistory.length >= 8) {
      const oldSummary = memoryService.getSummary(npcId, playerId);
      const segment = memoryService.getRecentDialogue(npcId, 8, playerId);

      summaryService.generateUpdatedSummary(oldSummary, segment)
        .then(newSummary => {
          if (newSummary && newSummary !== '無' && newSummary.trim() !== '') {
            memoryService.updateSummary(npcId, newSummary, playerId);
            logger.info({ npcId, playerId }, 'Long-term summary updated');
          }
        })
        .catch(err => {
          logger.error({ err, npcId, playerId }, 'Summary update failed');
        });
    }

  } catch (error) {
    next(error);
  }
});

module.exports = router;
