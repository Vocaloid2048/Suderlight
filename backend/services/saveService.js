const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');
const npcPath = path.join(dataDir, 'npc.json');
const cluesPath = path.join(dataDir, 'clues.json');
const savePath = path.join(dataDir, 'save.json');

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function readNpcs() {
  return readJson(npcPath);
}

function writeNpcs(npcs) {
  writeJson(npcPath, npcs);
}

function getNpc(npcId) {
  const npcs = readNpcs();
  return npcs[npcId] || null;
}

function saveNpc(npc) {
  const npcs = readNpcs();
  npcs[npc.id] = npc;
  writeNpcs(npcs);
  return npc;
}

function readClues() {
  return readJson(cluesPath);
}

function getClue(clueId) {
  return readClues().find(clue => clue.id === clueId) || null;
}

function readSave() {
  return readJson(savePath);
}

function writeSave(save) {
  writeJson(savePath, save);
  return save;
}

module.exports = {
  readNpcs,
  writeNpcs,
  getNpc,
  saveNpc,
  readClues,
  getClue,
  readSave,
  writeSave,
};
