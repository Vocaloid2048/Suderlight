/**
 * Inner World 路由 —— 心理世界查询
 */
import { Router } from 'express';
import memoryStore from '../services/store.js';
import INLINE_INNER_WORLDS from '../data/innerWorlds.js';
import { NotFoundError } from '../middleware/errors.js';

let innerWorldsLoaded = false;
function ensureLoaded() {
  if (!innerWorldsLoaded && INLINE_INNER_WORLDS && Object.keys(memoryStore.innerWorlds).length === 0) {
    memoryStore.innerWorlds = INLINE_INNER_WORLDS;
    innerWorldsLoaded = true;
  }
}

const router = Router();

// GET /inner-world/:npcId
router.get('/:npcId', (req, res, next) => {
  try {
    ensureLoaded();
    const world = memoryStore.innerWorlds[req.params.npcId];
    if (!world) throw new NotFoundError('Inner world', req.params.npcId);
    res.json(world);
  } catch (e) { next(e); }
});

export default router;
