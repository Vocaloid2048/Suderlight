const saveService = require('./saveService');

function addFailedNPC(npcId, playerId) {
  const save = saveService.readSave(playerId);

  const alreadyExists = save.ghosts.some(ghost => ghost.npc === npcId && ghost.failed === true);
  if (!alreadyExists) {
    save.ghosts.push({
      npc: npcId,
      failed: true,
      createdAt: new Date().toISOString(),
    });
  }

  saveService.writeSave(playerId, save);
  return save.ghosts;
}


module.exports = {
  addFailedNPC,
};
