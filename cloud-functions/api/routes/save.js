/**
 * Save 路由 —— 存档读取 / 写入 / 查询
 */
import { Router } from 'express';
import saveService from '../services/saveService.js';
import { ValidationError } from '../middleware/errors.js';

const router = Router();

// GET /save
router.get('/', (req, res, next) => {
  try { res.json(saveService.readSave(req.playerId)); } catch (e) { next(e); }
});

// POST /save
router.post('/', (req, res, next) => {
  try { res.json(saveService.writeSave(req.playerId, req.body)); } catch (e) { next(e); }
});

// POST /save/lookup
router.post('/lookup', (req, res, next) => {
  try {
    const { playerId } = req.body;
    if (!playerId) throw new ValidationError('playerId is required');
    res.json({ save: saveService.readSave(playerId) });
  } catch (e) { next(e); }
});

export default router;
