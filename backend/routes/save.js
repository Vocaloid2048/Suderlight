const express = require('express');
const saveService = require('../services/saveService');
const { BadRequestError } = require('../middleware/errors');

const router = express.Router();

// GET /api/save — 按球员 ID 加载存档
router.get('/', (req, res, next) => {
  try {
    const playerId = req.playerId;
    if (!playerId) {
      // 无球员 ID 时返回提示
      return res.status(400).json({
        code: 'NO_PLAYER_ID',
        error: '需要 X-Player-Id 头来加载存档。请在游戏中生成或输入你的存档码。',
      });
    }

    const save = saveService.readSave(playerId);
    const npcs = saveService.readNpcs();

    res.json({
      playerId,
      save,
      npcs,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/save — 按球员 ID 保存存档
router.post('/', (req, res, next) => {
  try {
    const playerId = req.playerId;
    if (!playerId) {
      throw new BadRequestError('需要 X-Player-Id 头来保存存档。');
    }

    const payload = req.body || {};

    // 读取当前球员存档
    const currentSave = saveService.readSave(playerId);

    const updatedSave = {
      player: payload.player || currentSave.player || {},
      currentLocation: payload.currentLocation || currentSave.currentLocation || 'skybridge',
      collectedClues: Array.isArray(payload.collectedClues)
        ? payload.collectedClues
        : currentSave.collectedClues || [],
      npcs: payload.npcs || currentSave.npcs || {},
      ghosts: Array.isArray(payload.ghosts) ? payload.ghosts : currentSave.ghosts || [],
      unlockedWorldbookIds: Array.isArray(payload.unlockedWorldbookIds)
        ? payload.unlockedWorldbookIds
        : currentSave.unlockedWorldbookIds || [1, 2, 3, 10, 11, 12],
    };

    saveService.writeSave(playerId, updatedSave);

    res.json({
      ok: true,
      playerId,
      save: updatedSave,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/save/lookup — 检查球员 ID 是否存在（用于异地登录）
router.post('/lookup', (req, res, next) => {
  try {
    const { playerId } = req.body || {};
    if (!playerId) {
      return res.json({ exists: false, reason: 'no playerId provided' });
    }

    const allIds = saveService.listPlayerIds();
    const exists = allIds.includes(playerId);

    res.json({ exists, playerCount: allIds.length });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
