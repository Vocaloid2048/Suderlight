/**
 * Worldbook 路由 —— 世界书查询
 */
import { Router } from 'express';
import worldbookService from '../services/worldbookService.js';

const router = Router();

// GET /worldbook
router.get('/', (req, res, next) => {
  try {
    res.json({ entries: worldbookService.getEntries() });
  } catch (e) { next(e); }
});

// POST /worldbook/triggered
router.post('/triggered', (req, res, next) => {
  try {
    const { keywords } = req.body;
    res.json({
      entries: worldbookService.getTriggeredEntries(
        req.body.npcId || 'bridge_artist',
        (keywords || []).join(' '),
        req.playerId,
      ),
    });
  } catch (e) { next(e); }
});

export default router;
