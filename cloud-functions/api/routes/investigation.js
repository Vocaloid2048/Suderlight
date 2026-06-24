/**
 * Investigation 路由 —— 线索收集 + 情绪词典解锁
 */
import { Router } from 'express';
import saveService from '../services/saveService.js';
import * as npcStateEngine from '../services/npcStateEngine.js';
import { unlockByClue } from './dictionary.js';
import { ValidationError, NotFoundError } from '../middleware/errors.js';

const router = Router();

/** 线索收集获得的 knowledge 合计上限 */
const MAX_CLUE_KNOWLEDGE = 50;

// POST /investigation/collect
router.post('/collect', (req, res, next) => {
  try {
    const { clueId } = req.body;
    if (!req.playerId) throw new ValidationError('Missing X-Player-Id header');
    if (!clueId) throw new ValidationError('clueId is required');

    const clue = saveService.getClue(clueId);
    if (!clue) throw new NotFoundError('Clue', clueId);

    const save = saveService.readSave(req.playerId);
    const npc = saveService.getNpc(clue.npcId, req.playerId);
    const alreadyCollected = save.collectedClues.includes(clueId);

    let unlockedEntries = [];

    if (!alreadyCollected) {
      save.collectedClues.push(clueId);

      // 计算线索收集累计 knowledge（上限 50）
      const accumulatedClueKnowledge = save.collectedClues.reduce((sum, cid) => {
        const c = saveService.getClue(cid);
        return sum + (c?.knowledge || 0);
      }, 0);
      const cappedKnowledge = Math.min(accumulatedClueKnowledge, MAX_CLUE_KNOWLEDGE);

      if (npc) {
        npc.knowledge = Math.max(npc.knowledge || 0, cappedKnowledge);
        npcStateEngine.checkUnlock(npc);
        saveService.saveNpc(npc, req.playerId);
      }

      saveService.writeSave(req.playerId, save);

      // 解锁情绪词典相关词条
      unlockedEntries = unlockByClue(clueId, req.playerId);
    }

    res.json({
      success: true, clue,
      npc: npc ? { ...npc, stateLabel: npcStateEngine.getStateLabel(npc) } : null,
      alreadyCollected, collectedClues: save.collectedClues,
      unlockedEntries,
    });
  } catch (e) { next(e); }
});

export default router;
