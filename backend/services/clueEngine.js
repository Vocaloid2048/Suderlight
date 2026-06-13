const saveService = require('./saveService');
const npcStateEngine = require('./npcStateEngine');

function collectClue(clueId, playerId) {
  const clue = saveService.getClue(clueId);

  if (!clue) {
    return {
      ok: false,
      status: 404,
      error: 'Clue not found',
    };
  }

  const save = saveService.readSave(playerId);
  const npc = saveService.getNpc(clue.npcId, playerId);

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

    saveService.writeSave(playerId, save);
    saveService.saveNpc(npc, playerId);
  } else {
    npcStateEngine.checkUnlock(npc);
    saveService.saveNpc(npc, playerId);
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
