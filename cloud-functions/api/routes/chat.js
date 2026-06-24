/**
 * Chat 路由 —— NPC 对话管理
 */
import { Router } from 'express';
import deepseekChat from '../services/deepseekService.js';
import { buildPrompt } from '../services/promptBuilder.js';
import saveService from '../services/saveService.js';
import * as npcStateEngine from '../services/npcStateEngine.js';
import memoryService from '../services/memoryService.js';
import worldbookService from '../services/worldbookService.js';
import { generateUpdatedSummary } from '../services/summaryService.js';
import { withPlayerLock } from '../services/playerLockService.js';
import CHARACTER_CARDS from '../data/character-cards.js';
import logger from '../middleware/logger.js';
import { ValidationError, NotFoundError } from '../middleware/errors.js';

const router = Router();

// ---- 辅助: 解锁 NPC 关联的世界书条目 ----
function unlockNpcWorldbookEntries(npcId, npcState, playerId) {
  const npcs = saveService.readNpcs();
  const tpl = npcs[npcId] || {};
  const ids = Array.isArray(tpl.worldbookUnlockIds) ? tpl.worldbookUnlockIds : [];
  if (ids.length === 0) return;
  if (npcState.innerWorldUnlocked || npcState.knowledge >= (npcState.knowledgeRequired || 70)) {
    ids.forEach(id => worldbookService.unlockEntry(id, playerId));
  }
}

// GET /chat/history/:npcId
router.get('/history/:npcId', (req, res, next) => {
  try {
    const history = req.playerId ? memoryService.getFullDialogue(req.params.npcId, req.playerId) : [];
    res.json({ history });
  } catch (e) { next(e); }
});

// POST /chat/reset/:npcId
router.post('/reset/:npcId', (req, res, next) => {
  try {
    if (req.playerId) memoryService.resetHistory(req.params.npcId, req.playerId);
    res.json({ success: true });
  } catch (e) { next(e); }
});

// POST /chat/reset-all
router.post('/reset-all', (req, res, next) => {
  try {
    if (req.playerId) memoryService.resetAll(req.playerId);
    res.json({ success: true });
  } catch (e) { next(e); }
});

// POST /chat
router.post('/', async (req, res, next) => {
  try {
    const { npcId, message, roundCount: clientRoundCount } = req.body;
    const playerId = req.playerId;
    if (!npcId || !message) throw new ValidationError('npcId and message are required');
    if (!playerId) throw new ValidationError('Missing X-Player-Id header');

    await withPlayerLock(playerId, async () => {
      const ts = Date.now();
      const npc = saveService.getNpc(npcId, playerId);
      if (!npc) throw new NotFoundError('NPC', npcId);

      // 已结局 NPC
      if (npc.ending && npc.ending !== 'none') {
        return res.json({
          text: npc.ending === 'success'
            ? '雨聲還在。他沒有痊癒，但沒有再把自己藏進空白裡。'
            : '天橋上只剩潮濕的紙張。那個人影沒有再回頭。',
          psychology: { trustDelta: 0, stressDelta: 0, stateLabel: npcStateEngine.getStateLabel(npc) },
          npcState: {
            trust: npc.trust, stress: npc.stress, knowledge: npc.knowledge,
            innerWorldUnlocked: npc.innerWorldUnlocked, ending: npc.ending,
          },
          roundCount: memoryService.getRoundCount(npcId, playerId),
          summary: memoryService.getSummary(npcId, playerId),
        });
      }

      // ---- AI 意圖分類：獲取 NPC 角色設定 + 對話上下文 ----
      const npcCard = CHARACTER_CARDS[npcId] || {};
      const npcSettings = {
        name: npcCard.name || '',
        personality: npcCard.personality || '',
        description: npcCard.description || '',
        system_prompt: npcCard.system_prompt || '',
      };
      const recentMessages = memoryService.getRecentDialogue(npcId, 10, playerId);
      const recentInputTypes = memoryService.getRecentTypes(npcId, playerId);
      const dialogueType = await npcStateEngine.classifyDialogue(message, npcSettings, recentMessages);

      const messages = buildPrompt(npcId, message, recentInputTypes, playerId);

      let reply = await deepseekChat(messages);
      if (!reply || reply.trim() === '') reply = '他只是沈默地看著畫布，雨聲填滿了對話的空白。';

      const stateUpdate = npcStateEngine.updateAfterDialogue(npc, message, dialogueType, recentInputTypes);
      const systemJudgement = {
        stateLabel: npcStateEngine.getStateLabel(stateUpdate.npc),
        trustDelta: stateUpdate.trustDelta,
        stressDelta: stateUpdate.stressDelta,
        knowledgeDelta: stateUpdate.npc.knowledge - (npc.knowledge || 0),
        trust: stateUpdate.npc.trust,
        stress: stateUpdate.npc.stress,
        knowledge: stateUpdate.npc.knowledge,
      };

      memoryService.addInputType(npcId, stateUpdate.dialogueType, playerId);
      memoryService.saveDialogue(npcId, message, reply, playerId, ts, systemJudgement);
      saveService.saveNpc(stateUpdate.npc, playerId);

      unlockNpcWorldbookEntries(npcId, stateUpdate.npc, playerId);

      const historyRoundCount = memoryService.getRoundCount(npcId, playerId);
      const currentRoundCount = Math.max(
        (typeof clientRoundCount === 'number' ? clientRoundCount : 0) + 1,
        historyRoundCount,
      );

      let summaryResult = memoryService.getSummary(npcId, playerId);
      let summaryError = null;

      // 每10轮生成摘要（await，确保在 history 清零前完成）
      if (currentRoundCount % 10 === 0) {
        const oldSummary = summaryResult;
        const segment = memoryService.getRecentDialogue(npcId, 20, playerId);
        try {
          const newSummary = await generateUpdatedSummary(oldSummary, segment);
          if (newSummary && String(newSummary).trim() && String(newSummary).trim() !== '無') {
            summaryResult = String(newSummary).trim();
            memoryService.updateSummary(npcId, summaryResult, playerId);
          }
        } catch (err) {
          summaryError = err instanceof Error ? err.message : String(err);
          logger.error(`[summary] Failed for npc=${npcId}: ${summaryError}`);
        }
        memoryService.resetCurrentHistory(npcId, playerId);
      }

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
        roundCount: currentRoundCount,
        summary: summaryResult,
        ...(summaryError ? { summaryError } : {}),
      });
    });
  } catch (e) { next(e); }
});

export default router;
