/**
 * 存储抽象层 —— 根据 STORAGE_MODE 环境变量自动选择存储后端
 *
 *   "memory" (默认):  内存存储，用于 EdgeOne Cloud Functions
 *   "fs":             文件系统存储，用于本地开发 / Docker 部署
 *
 * 对上层 service 暴露统一 API，完全兼容原有 memoryStore 行为。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import memoryStore from './store.js';

const MODE = process.env.STORAGE_MODE || 'memory';

// 文件系统数据目录 (相对于 cloud-functions/api/)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API_DIR = path.resolve(__dirname, '..');
const DATA_DIR = process.env.STORAGE_DATA_DIR || path.join(API_DIR, 'data');

// ---- 文件系统工具 ----
function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}
function readJSON(filepath) {
  if (!fs.existsSync(filepath)) return null;
  return JSON.parse(fs.readFileSync(filepath, 'utf8'));
}
function writeJSON(filepath, data) {
  const dir = path.dirname(filepath);
  ensureDir(dir);
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf8');
}

// ---- Player Save (memoryStore.saves 的对应) ----
function readPlayerSave(playerId) {
  if (MODE === 'fs') {
    const fp = path.join(DATA_DIR, 'saves', `${playerId}.json`);
    return readJSON(fp);
  }
  return memoryStore.saves[playerId] || null;
}

function writePlayerSave(playerId, data) {
  if (MODE === 'fs') {
    const fp = path.join(DATA_DIR, 'saves', `${playerId}.json`);
    writeJSON(fp, data);
    return;
  }
  memoryStore.saves[playerId] = data;
}

function listPlayerIds() {
  if (MODE === 'fs') {
    const savesDir = path.join(DATA_DIR, 'saves');
    if (!fs.existsSync(savesDir)) return [];
    return fs.readdirSync(savesDir)
      .filter(f => f.endsWith('.json'))
      .map(f => f.replace('.json', ''));
  }
  return Object.keys(memoryStore.saves);
}

// ---- Player Memories (memoryStore.memories 的对应) ----
function readPlayerMemories(playerId) {
  if (MODE === 'fs') {
    const fp = path.join(DATA_DIR, 'memories', `${playerId}.json`);
    return readJSON(fp) || {};
  }
  return memoryStore.memories[playerId] || {};
}

function writePlayerMemories(playerId, data) {
  if (MODE === 'fs') {
    const fp = path.join(DATA_DIR, 'memories', `${playerId}.json`);
    writeJSON(fp, data);
    return;
  }
  memoryStore.memories[playerId] = data;
}

// ---- 全局静态数据 (只读，fs 模式下从 JSON 文件加载) ----
function readNpcs() {
  if (MODE === 'fs') {
    return readJSON(path.join(DATA_DIR, 'npcs.json')) || {};
  }
  return memoryStore.npcs;
}

function readClues() {
  if (MODE === 'fs') {
    return readJSON(path.join(DATA_DIR, 'clues.json')) || [];
  }
  return memoryStore.clues || [];
}

function readWorldbook() {
  if (MODE === 'fs') {
    return readJSON(path.join(DATA_DIR, 'worldbook.json')) || { entries: [] };
  }
  return memoryStore.worldbook || { entries: [] };
}

function readInnerWorlds() {
  if (MODE === 'fs') {
    return readJSON(path.join(DATA_DIR, 'innerWorlds.json')) || {};
  }
  return memoryStore.innerWorlds || {};
}

function readDictionary() {
  if (MODE === 'fs') {
    return readJSON(path.join(DATA_DIR, 'dictionary.json')) || [];
  }
  return memoryStore.dictionary || [];
}

export {
  MODE as storageMode,
  readPlayerSave, writePlayerSave, listPlayerIds,
  readPlayerMemories, writePlayerMemories,
  readNpcs, readClues, readWorldbook, readInnerWorlds, readDictionary,
};
