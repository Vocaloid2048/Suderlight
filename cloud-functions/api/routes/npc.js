/**
 * NPC 路由 —— 查看 NPC 状态 / 设置结局
 */
import { Router } from 'express';
import saveService from '../services/saveService.js';
import * as npcStateEngine from '../services/npcStateEngine.js';
import ghostEngine from '../services/ghostEngine.js';
import { withPlayerLock } from '../services/playerLockService.js';
import { NotFoundError, ValidationError } from '../middleware/errors.js';

const router = Router();

// GET /npc/:id
router.get('/:id', (req, res, next) => {
  try {
    const npc = saveService.getNpc(req.params.id, req.playerId);
    if (!npc) throw new NotFoundError('NPC', req.params.id);
    res.json({ npc: { ...npc, stateLabel: npcStateEngine.getStateLabel(npc) } });
  } catch (e) { next(e); }
});

// POST /npc/:id/ending
router.post('/:id/ending', async (req, res, next) => {
  try {
    const { ending } = req.body;
    if (!['success', 'failure', 'none'].includes(ending))
      throw new ValidationError('ending must be success, failure, or none');

    await withPlayerLock(req.playerId, async () => {
      const npc = saveService.getNpc(req.params.id, req.playerId);
      if (!npc) throw new NotFoundError('NPC', req.params.id);

      npcStateEngine.setEnding(npc, ending);
      if (ending === 'failure') ghostEngine.addFailedNPC(req.params.id, req.playerId);
      saveService.saveNpc(npc, req.playerId);

      res.json({ success: true, npc: { ...npc, stateLabel: npcStateEngine.getStateLabel(npc) } });
    });
  } catch (e) { next(e); }
});

export default router;
