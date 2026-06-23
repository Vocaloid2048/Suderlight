/**
 * Save Service —— 存档管理 (支持 memory / fs 双模式)
 *
 * STORAGE_MODE=memory (默认): EdgeOne 内存存储，完全兼容原行为
 * STORAGE_MODE=fs: 文件系统存储，用于本地开发 / Docker 部署
 */
import memoryStore from './store.js';
import {
  readPlayerSave as readPersistedSave,
  writePlayerSave as writePersistedSave,
  listPlayerIds as listPersistedIds,
  readNpcs as readPersistedNpcs,
  readClues as readPersistedClues,
} from './persistence.js';
import logger from '../middleware/logger.js';
import INLINE_NPC from '../data/npcs.js';
import INLINE_CLUES from '../data/clues.js';

function loadStaticDataOnce() {
  // 优先从持久化层加载 (fs 模式下为 JSON 文件)，回退到 inline 模块
  const persistedNpcs = readPersistedNpcs();
  if (Object.keys(persistedNpcs).length > 0) {
    memoryStore.npcs = persistedNpcs;
    logger.info('Static NPC data loaded (persisted)');
  } else if (Object.keys(memoryStore.npcs).length === 0 && INLINE_NPC) {
    memoryStore.npcs = INLINE_NPC;
    logger.info('Static NPC data loaded (inline)');
  }

  const persistedClues = readPersistedClues();
  if (persistedClues.length > 0) {
    memoryStore.clues = persistedClues;
    logger.info('Static Clues data loaded (persisted)');
  } else if (memoryStore.clues.length === 0 && INLINE_CLUES) {
    memoryStore.clues = INLINE_CLUES;
    logger.info('Static Clues data loaded (inline)');
  }
}

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

const saveService = {
  init() { loadStaticDataOnce(); },

  readNpcs() { return memoryStore.npcs; },

  writeNpcs(npcs) { memoryStore.npcs = npcs; },

  getNpc(npcId, playerId) {
    if (playerId) {
      // player-specific NPC 覆盖
      const saved = readPersistedSave(playerId);
      if (saved?.npcs?.[npcId]) return saved.npcs[npcId];
      if (memoryStore.saves[playerId]?.npcs?.[npcId]) return memoryStore.saves[playerId].npcs[npcId];
    }
    return memoryStore.npcs[npcId] || null;
  },

  saveNpc(npc, playerId) {
    if (!playerId) { memoryStore.npcs[npc.id] = npc; return npc; }
    if (!memoryStore.saves[playerId]) memoryStore.saves[playerId] = defaultSave();
    if (!memoryStore.saves[playerId].npcs) memoryStore.saves[playerId].npcs = {};
    memoryStore.saves[playerId].npcs[npc.id] = npc;
    // 同步到持久化层
    writePersistedSave(playerId, memoryStore.saves[playerId]);
    return npc;
  },

  getClue(clueId) {
    return (memoryStore.clues || []).find(c => c.id === clueId) || null;
  },

  readSave(playerId) {
    if (!playerId) return defaultSave();
    // 优先从持久化层读取 (fs 模式下为文件内容)
    const persisted = readPersistedSave(playerId);
    if (persisted) {
      // 同步到内存缓存
      memoryStore.saves[playerId] = persisted;
      return persisted;
    }
    // 回退到内存缓存 / 创建新存档
    if (!memoryStore.saves[playerId]) memoryStore.saves[playerId] = defaultSave();
    return memoryStore.saves[playerId];
  },

  writeSave(playerId, save) {
    memoryStore.saves[playerId] = save;
    writePersistedSave(playerId, save);
    return save;
  },

  listPlayerIds() {
    // 合并内存和持久化层的玩家列表
    const memIds = Object.keys(memoryStore.saves);
    const persistedIds = listPersistedIds();
    return [...new Set([...memIds, ...persistedIds])];
  },
};

export default saveService;
