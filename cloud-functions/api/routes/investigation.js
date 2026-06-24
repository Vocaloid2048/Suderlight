/**
 * Investigation 路由 —— 线索收集 + 情绪词典解锁
 */
import { Router } from 'express';
import saveService from '../services/saveService.js';
import * as npcStateEngine from '../services/npcStateEngine.js';
import { unlockByClue } from './dictionary.js';
import { ValidationError, NotFoundError } from '../middleware/errors.js';

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
    const npc = saveService.getNpc(clue.npcId, req.playerId);
    const alreadyCollected = save.collectedClues.includes(clueId);

    let unlockedEntries = [];

    if (!alreadyCollected) {
      save.collectedClues.push(clueId);
      saveService.writeSave(req.playerId, save);

      // 解鎖情緒詞典相關詞條
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
