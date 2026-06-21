const fs = require('fs');
const path = require('path');
const logger = require('../middleware/logger');

const dataDir = path.join(__dirname, '..', 'data');
const savesDir = path.join(dataDir, 'saves');
const npcPath = path.join(dataDir, 'npc.json');
const cluesPath = path.join(dataDir, 'clues.json');

// 确保存档目录存在
if (!fs.existsSync(savesDir)) {
  fs.mkdirSync(savesDir, { recursive: true });
}

function playerDir(playerId) {
  const dir = path.join(savesDir, sanitize(playerId));
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function playerSavePath(playerId) {
  return path.join(playerDir(playerId), 'save.json');
}

function sanitize(id) {
  return id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
}

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

// ---- NPC（共享静态数据，按实例覆盖） ----

function readNpcs() {
  return readJson(npcPath);
}

function writeNpcs(npcs) {
  writeJson(npcPath, npcs);
}

/**
 * 按球员获取 NPC 实例（独立存档）
 * 未找到则返回共享 NPC 模板
 */
function getNpc(npcId, playerId) {
  const save = playerId ? readSave(playerId) : null;
  if (save?.npcs?.[npcId]) {
    return save.npcs[npcId];
  }
  // 回退到全局 NPC 模板（新建球员时）
  const npcs = readNpcs();
  return npcs[npcId] || null;
}

function saveNpc(npc, playerId) {
  if (!playerId) {
    // 无球员上下文时写全局文件（开发测试用）
    const npcs = readNpcs();
    npcs[npc.id] = npc;
    writeNpcs(npcs);
    return npc;
  }
  // 正常情况写入球员独立存档
  const save = readSave(playerId);
  if (!save.npcs) save.npcs = {};
  save.npcs[npc.id] = npc;
  writeSave(playerId, save);
  return npc;
}

// ---- 线索（全局共享） ----

function readClues() {
  return readJson(cluesPath);
}

function getClue(clueId) {
  return readClues().find(clue => clue.id === clueId) || null;
}

// ---- 球员存档（每个 playerId 独立文件） ----

function defaultSave() {
  return {
    player: { knowledge: 0 },
    currentLocation: 'skybridge',
    collectedClues: [],
    npcs: {},
    ghosts: [],
    unlockedWorldbookIds: [1, 2, 3, 10, 11, 12],
  };
}

function readSave(playerId) {
  const filePath = playerSavePath(playerId);
  try {
    if (!fs.existsSync(filePath)) {
      const fresh = defaultSave();
      writeJson(filePath, fresh);
      return fresh;
    }
    const save = readJson(filePath);
    if (!Array.isArray(save.unlockedWorldbookIds)) {
      save.unlockedWorldbookIds = [1, 2, 3, 10, 11, 12];
    }
    return save;
  } catch (err) {
    logger.warn({ err, playerId }, 'Failed to read save — creating new one');
    const fresh = defaultSave();
    try { writeJson(filePath, fresh); } catch (e) {}
    return fresh;
  }
}

function writeSave(playerId, save) {
  const filePath = playerSavePath(playerId);
  writeJson(filePath, save);
  return save;
}

/**
 * 列出所有存在的球员 ID
 */
function listPlayerIds() {
  try {
    return fs.readdirSync(savesDir).filter(name => {
      const stat = fs.statSync(path.join(savesDir, name));
      return stat.isDirectory() && /^[a-zA-Z0-9_-]+$/.test(name);
    });
  } catch {
    return [];
  }
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
  defaultSave,
  listPlayerIds,
};
