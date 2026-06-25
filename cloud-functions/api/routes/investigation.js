/**
 * Investigation 路由 —— 线索收集 + 情绪词典解锁
 */
import { Router } from 'express';
import saveService from '../services/saveService.js';
import * as npcStateEngine from '../services/npcStateEngine.js';
import { unlockByClue } from './dictionary.js';
import { ValidationError, NotFoundError } from '../middleware/errors.js';
import logger from '../middleware/logger.js';

const router = Router();

// POST /investigation/collect
router.post('/collect', (req, res, next) => {
  try {
    const { clueId } = req.body;
    if (!req.playerId) throw new ValidationError('Missing X-Player-Id header');
    if (!clueId) throw new ValidationError('clueId is required');

    const clue = saveService.getClue(clueId);
    if (!clue) throw new NotFoundError('Clue', clueId);

    const save = saveService.readSave(req.playerId);
    const alreadyCollected = save.collectedClues.includes(clueId);

    let unlockedEntries = [];

    if (!alreadyCollected) {
      save.collectedClues.push(clueId);

      // 同步將線索的 knowledge 值加入 NPC 狀態
      // 使用 save.npcs 直接操作，確保與 saveService.getNpc() 返回的物件是同一份參照
      if (clue.npcId && clue.knowledge) {
        if (!save.npcs) save.npcs = {};
        // 若 NPC 尚未初始化，從模板深拷貝創建玩家專屬 NPC
        if (!save.npcs[clue.npcId]) {
          const tplNpcs = saveService.readNpcs();
          const tpl = tplNpcs[clue.npcId];
          if (tpl) {
            save.npcs[clue.npcId] = JSON.parse(JSON.stringify(tpl));
            logger.info(`[investigation] Initialized NPC "${clue.npcId}" for player "${req.playerId}" from template`);
          }
        }
        if (save.npcs[clue.npcId]) {
          const prev = save.npcs[clue.npcId].knowledge || 0;
          save.npcs[clue.npcId].knowledge = Math.min(100, prev + (clue.knowledge || 0));
          logger.info(`[investigation] Added clue knowledge +${clue.knowledge} to NPC "${clue.npcId}": ${prev} → ${save.npcs[clue.npcId].knowledge}`);
        }
      }

      saveService.writeSave(req.playerId, save);

      // 解鎖情緒詞典相關詞條
      unlockedEntries = unlockByClue(clueId, req.playerId);
    }

    // 返回 NPC 狀態（確保使用已更新的 save.npcs）
    const npc = (save.npcs && save.npcs[clue.npcId])
      ? { ...save.npcs[clue.npcId], stateLabel: npcStateEngine.getStateLabel(save.npcs[clue.npcId]) }
      : null;

    res.json({
      success: true, clue,
      npc,
      alreadyCollected, collectedClues: save.collectedClues,
      unlockedEntries,
    });
  } catch (e) { next(e); }
});

export default router;
