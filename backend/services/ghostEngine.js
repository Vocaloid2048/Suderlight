const saveService = require('./saveService');

function addFailedNPC(npcId) {
  const save = saveService.readSave();

  const alreadyExists = save.ghosts.some(ghost => ghost.npc === npcId && ghost.failed === true);
  if (!alreadyExists) {
    save.ghosts.push({
      npc: npcId,
      failed: true,
    });
  }

  saveService.writeSave(save);
  return save.ghosts;
}

module.exports = {
  addFailedNPC,
};
