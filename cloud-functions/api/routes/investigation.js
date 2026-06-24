/**
 * Investigation 路由 —— 线索收集
 */
import { Router } from 'express';
import saveService from '../services/saveService.js';
import * as npcStateEngine from '../services/npcStateEngine.js';
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

    if (!alreadyCollected) {
      save.collectedClues.push(clueId);
      if (npc) {
        npc.knowledge = Math.min(100, (npc.knowledge || 0) + (clue.knowledge || 15));
        npcStateEngine.checkUnlock(npc);
        saveService.saveNpc(npc, req.playerId);
      }
      saveService.writeSave(req.playerId, save);
    }

    res.json({
      success: true, clue,
      npc: npc ? { ...npc, stateLabel: npcStateEngine.getStateLabel(npc) } : null,
      alreadyCollected, collectedClues: save.collectedClues,
    });
  } catch (e) { next(e); }
});

export default router;
