const saveService = require('./saveService');
const npcStateEngine = require('./npcStateEngine');

function collectClue(clueId) {
  const clue = saveService.getClue(clueId);

  if (!clue) {
    return {
      ok: false,
      status: 404,
      error: 'Clue not found',
    };
  }

  const save = saveService.readSave();
  const npc = saveService.getNpc(clue.npcId);

  if (!npc) {
    return {
      ok: false,
      status: 404,
      error: 'NPC not found for clue',
    };
  }

  const alreadyCollected = save.collectedClues.includes(clueId);

  if (!alreadyCollected) {
    save.collectedClues.push(clueId);
    save.player.knowledge = Math.min(100, save.player.knowledge + clue.knowledge);
    npc.knowledge = Math.min(100, npc.knowledge + clue.knowledge);
    npcStateEngine.checkUnlock(npc);

    saveService.writeSave(save);
    saveService.saveNpc(npc);
  } else {
    npcStateEngine.checkUnlock(npc);
    saveService.saveNpc(npc);
  }

  return {
    ok: true,
    clue,
    npc,
    alreadyCollected,
    collectedClues: save.collectedClues,
  };
}

module.exports = {
  collectClue,
};
