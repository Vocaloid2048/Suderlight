/**
 * Ghost Engine —— 失败 NPC 记录
 */
import saveService from './saveService.js';

const ghostEngine = {
  addFailedNPC(npcId, playerId) {
    const save = saveService.readSave(playerId);
    const exists = save.ghosts.some(g => g.npc === npcId && g.failed === true);
    if (!exists) {
      save.ghosts.push({ npc: npcId, failed: true, createdAt: new Date().toISOString() });
      saveService.writeSave(playerId, save);
    }
    return save.ghosts;
  },
};

export default ghostEngine;
