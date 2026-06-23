/**
 * Save Service —— 存档管理 (内存存储版本)
 */
import memoryStore from './store.js';
import logger from '../middleware/logger.js';
import INLINE_NPC from '../data/npcs.js';
import INLINE_CLUES from '../data/clues.js';

function loadStaticDataOnce() {
  if (Object.keys(memoryStore.npcs).length === 0 && INLINE_NPC) {
    memoryStore.npcs = INLINE_NPC;
    logger.info('Static NPC data loaded');
  }
  if (memoryStore.clues.length === 0 && INLINE_CLUES) {
    memoryStore.clues = INLINE_CLUES;
    logger.info('Static Clues data loaded');
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
    if (playerId && memoryStore.saves[playerId]?.npcs?.[npcId]) {
      return memoryStore.saves[playerId].npcs[npcId];
    }
    return memoryStore.npcs[npcId] || null;
  },

  saveNpc(npc, playerId) {
    if (!playerId) { memoryStore.npcs[npc.id] = npc; return npc; }
    if (!memoryStore.saves[playerId]) memoryStore.saves[playerId] = defaultSave();
    if (!memoryStore.saves[playerId].npcs) memoryStore.saves[playerId].npcs = {};
    memoryStore.saves[playerId].npcs[npc.id] = npc;
    return npc;
  },

  getClue(clueId) {
    return (memoryStore.clues || []).find(c => c.id === clueId) || null;
  },

  readSave(playerId) {
    if (!playerId) return defaultSave();
    if (!memoryStore.saves[playerId]) memoryStore.saves[playerId] = defaultSave();
    return memoryStore.saves[playerId];
  },

  writeSave(playerId, save) { memoryStore.saves[playerId] = save; return save; },

  listPlayerIds() { return Object.keys(memoryStore.saves); },
};

export default saveService;
