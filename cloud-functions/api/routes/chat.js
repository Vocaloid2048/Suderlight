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
    if (req.playerId) {
      memoryService.resetAll(req.playerId);

      // 完全重置玩家進度：NPC 狀態 + 線索 + 詞典解鎖
      const save = saveService.readSave(req.playerId);
      const npcTemplates = saveService.readNpcs();
      if (save.npcs && typeof save.npcs === 'object') {
        for (const npcId of Object.keys(save.npcs)) {
          const tpl = npcTemplates[npcId];
          const current = save.npcs[npcId];
          if (tpl && current) {
            // 將動態數值重置為模板初始值
            current.trust = typeof tpl.trust === 'number' ? tpl.trust : 20;
            current.stress = typeof tpl.stress === 'number' ? tpl.stress : 80;
            current.knowledge = typeof tpl.knowledge === 'number' ? tpl.knowledge : 0;
            current.innerWorldUnlocked = false;
            current.ending = 'none';
            logger.info(`[chat] Reset NPC "${npcId}" state for player "${req.playerId}"`);
          }
        }
      }
      // 重置已收集線索和已解鎖詞典條目（否則再次收集時會判定為 alreadyCollected / alreadyUnlocked）
      save.collectedClues = [];
      save.unlockedDictionaryEntries = [];
      saveService.writeSave(req.playerId, save);
      logger.info(`[chat] Full progress reset for player "${req.playerId}"`);
    }
    res.json({ success: true });
  } catch (e) { next(e); }
});

// POST /chat
router.post('/', async (req, res, next) => {
  const { npcId, message, roundCount: clientRoundCount } = req.body;
  const playerId = req.playerId;
  if (!npcId || !message) return next(new ValidationError('npcId and message are required'));
  if (!playerId) return next(new ValidationError('Missing X-Player-Id header'));

  try {
    await withPlayerLock(playerId, async () => {
      const ts = Date.now();
      const npc = saveService.getNpc(npcId, playerId);
      if (!npc) throw new NotFoundError('NPC', npcId);

      // 若前端傳來了客戶端 NPC 狀態（如 playtest dashboard 修改），覆蓋後端舊值
      const clientNpcState = req.body.clientNpcState;
      if (clientNpcState) {
        if (typeof clientNpcState.trust === 'number') npc.trust = Math.max(0, Math.min(100, Math.round(clientNpcState.trust)));
        if (typeof clientNpcState.stress === 'number') npc.stress = Math.max(0, Math.min(100, Math.round(clientNpcState.stress)));
        if (typeof clientNpcState.knowledge === 'number') npc.knowledge = Math.max(0, Math.min(100, Math.round(clientNpcState.knowledge)));
      }

      // 已结局 NPC
      if (npc.ending && npc.ending !== 'none') {
        return res.json({
          text: npc.ending === 'success'
            ? '雨聲還在。他沒有痊癒，但沒有再把自己藏進空白裡。'
            : '天橋上只剩潮濕的紙張。那個人影沒有再回頭。',
          psychology: { trustDelta: 0, stressDelta: 0, stateLabel: '普通對話' },
          npcState: {
            trust: npc.trust, stress: npc.stress, knowledge: npc.knowledge,
            innerWorldUnlocked: npc.innerWorldUnlocked, ending: npc.ending,
          },
          roundCount: memoryService.getRoundCount(npcId, playerId),
          summary: memoryService.getSummary(npcId, playerId),
        });
      }

      // ---- 並行請求：AI 意圖分類 + NPC 對話回覆（兩者互不依賴）----
      const npcCard = CHARACTER_CARDS[npcId] || {};
      const npcSettings = {
        name: npcCard.name || '',
        personality: npcCard.personality || '',
        description: npcCard.description || '',
        system_prompt: npcCard.system_prompt || '',
      };
      const recentMessages = memoryService.getRecentDialogue(npcId, 10, playerId);
      const recentInputTypes = memoryService.getRecentTypes(npcId, playerId);
      const messages = buildPrompt(npcId, message, recentInputTypes, playerId);

      // 获取玩家已收集的线索数量：优先使用前端传来的（反映真实客户端状态），后端存档作为 fallback
      const playerSave = saveService.readSave(playerId);
      const clientClueCount = typeof req.body.collectedClueCount === 'number' ? req.body.collectedClueCount : undefined;
      const collectedClueCount = clientClueCount !== undefined
        ? clientClueCount
        : (Array.isArray(playerSave.collectedClues) ? playerSave.collectedClues.length : 0);

      const [dialogueType, replyRaw] = await Promise.all([
        npcStateEngine.classifyDialogue(message, npcSettings, recentMessages),
        deepseekChat(messages),
      ]);

      let reply = replyRaw;
      if (!reply || reply.trim() === '') reply = '他只是沈默地看著畫布，雨聲填滿了對話的空白。';

      // 記錄更新前的 knowledge 值，用於計算 knowledgeDelta 的 fallback
      // 注意：updateAfterDialogue 會原地修改 npc，因此必須先保存舊值
      const oldKnowledge = npc.knowledge ?? 0;
      const stateUpdate = npcStateEngine.updateAfterDialogue(npc, message, dialogueType, recentInputTypes, collectedClueCount);
      const systemJudgement = {
        stateLabel: npcStateEngine.getDialogueTypeLabel(stateUpdate.dialogueType),
        trustDelta: stateUpdate.trustDelta,
        stressDelta: stateUpdate.stressDelta,
        knowledgeDelta: stateUpdate.knowledgeDelta ?? (stateUpdate.npc.knowledge - oldKnowledge),
        trust: stateUpdate.npc.trust,
        stress: stateUpdate.npc.stress,
        knowledge: stateUpdate.npc.knowledge,
      };

      memoryService.addInputType(npcId, stateUpdate.dialogueType, playerId);
      memoryService.saveDialogue(npcId, message, reply, playerId, ts, systemJudgement);
      saveService.saveNpc(stateUpdate.npc, npcId, playerId);

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
          knowledgeDelta: systemJudgement.knowledgeDelta,
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
  } catch (e) {
    // 优雅降级：AI 服务不可用时返回默认回复，不暴露系统错误给用户
    // 注意：此降级不会实际修改 NPC 状态（存档未变更），因此 knowledgeDelta 必须为 0
    logger.error(`[chat] Graceful fallback for npc=${npcId}: ${e.message}`);
    const npc = saveService.getNpc(npcId, playerId);
    // 安全回退：getNpc 可能因存档等异常也抛出错误，此时使用硬编码默认值
    const fallbackNpc = (npc && typeof npc === 'object') ? npc : { trust: 20, stress: 80, knowledge: 0, innerWorldUnlocked: false, ending: 'none' };
    res.json({
      text: '他沒有立刻回答。畫筆停在半空，像一個還沒決定要不要落下的句號。',
      psychology: {
        trustDelta: 0,
        stressDelta: 0,
        knowledgeDelta: 0,
        stateLabel: '普通對話',
        inputType: 'ordinary',
      },
      npcState: {
        trust: fallbackNpc.trust ?? 20,
        stress: fallbackNpc.stress ?? 80,
        knowledge: fallbackNpc.knowledge ?? 0,
        innerWorldUnlocked: fallbackNpc.innerWorldUnlocked || false,
        ending: fallbackNpc.ending || 'none',
      },
      roundCount: clientRoundCount || 0,
      summary: null,
    });
  }
});

export default router;
