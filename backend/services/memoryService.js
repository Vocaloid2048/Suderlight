const fs = require('fs');
const path = require('path');

const memoryPath = path.join(__dirname, '..', 'data', 'dialogueMemory.json');
const MAX_TYPES = 10;

function ensureMemoryFile() {
  if (!fs.existsSync(memoryPath)) {
    fs.writeFileSync(memoryPath, '{}\n', 'utf8');
  }
}

function readMemory() {
  ensureMemoryFile();
  return JSON.parse(fs.readFileSync(memoryPath, 'utf8'));
}

function writeMemory(memory) {
  fs.writeFileSync(memoryPath, `${JSON.stringify(memory, null, 2)}\n`, 'utf8');
}

function getRecentTypes(npcId) {
  const memory = readMemory();
  const npcMemory = memory[npcId] || {};
  return Array.isArray(npcMemory.lastInputTypes) ? npcMemory.lastInputTypes : [];
}

function addInputType(npcId, inputType) {
  const memory = readMemory();
  const npcMemory = memory[npcId] || { lastInputTypes: [] };
  const nextTypes = [...(npcMemory.lastInputTypes || []), inputType].slice(-MAX_TYPES);

  memory[npcId] = {
    ...npcMemory,
    lastInputTypes: nextTypes,
  };

  writeMemory(memory);
  return nextTypes;
}

module.exports = {
  getRecentTypes,
  addInputType,
};
