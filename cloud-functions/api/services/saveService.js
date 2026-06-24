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
    currentLocation: 'skybridge',
    collectedClues: [],
    npcs: {},
    ghosts: [],
    unlockedWorldbookIds: [1, 2, 3, 10, 11, 12],
    unlockedDictionaryEntries: [],
  };
}

const saveService = {
  init() { loadStaticDataOnce(); },

  readNpcs() { return memoryStore.npcs; },

  writeNpcs(npcs) { memoryStore.npcs = npcs; },

  getNpc(npcId, playerId) {
    if (playerId) {
      // 1. 優先從持久化層讀取玩家專屬 NPC 狀態
      const saved = readPersistedSave(playerId);
      if (saved?.npcs?.[npcId]) return saved.npcs[npcId];

      // 2. 從內存緩存讀取
      if (memoryStore.saves[playerId]?.npcs?.[npcId]) return memoryStore.saves[playerId].npcs[npcId];

      // 3. 玩家首次存取此 NPC：從模板深拷貝並初始化玩家專屬 NPC 狀態
      const tpl = memoryStore.npcs[npcId];
      if (tpl) {
        // 從模板深拷貝（避免模板被 mutation 污染，也避免跨玩家互相汙染）
        const npcCopy = JSON.parse(JSON.stringify(tpl));
        // 確保玩家存檔結構存在並寫入
        if (!memoryStore.saves[playerId]) memoryStore.saves[playerId] = defaultSave();
        if (!memoryStore.saves[playerId].npcs) memoryStore.saves[playerId].npcs = {};
        memoryStore.saves[playerId].npcs[npcId] = npcCopy;
        // 同步寫入持久化層，確保後續 readPersistedSave 能讀到
        writePersistedSave(playerId, memoryStore.saves[playerId]);
        logger.info(`[saveService] Initialized player-specific NPC "${npcId}" for player "${playerId}"`);
        return npcCopy;
      }
      return null;
    }
    // 無玩家 ID 時：從模板深拷貝（唯讀場景，仍避免污染）
    const tpl = memoryStore.npcs[npcId];
    return tpl ? JSON.parse(JSON.stringify(tpl)) : null;
  },

  saveNpc(npc, npcId, playerId) {
    if (!playerId) { memoryStore.npcs[npcId || npc.id] = npc; return npc; }
    if (!memoryStore.saves[playerId]) memoryStore.saves[playerId] = defaultSave();
    if (!memoryStore.saves[playerId].npcs) memoryStore.saves[playerId].npcs = {};
    const key = npcId || npc.id;
    if (key) memoryStore.saves[playerId].npcs[key] = npc;
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
