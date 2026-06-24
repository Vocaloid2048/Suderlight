import type { ClueId, LocationId, NpcId } from '../data/verticalSlice';
import { createBridgeArtistState, createVictorState, type NpcRuntimeState } from './npcStateEngine';

export type GhostRecord = {
  npc: NpcId;
  failed: true;
  memoryText: string;
  createdAt: string;
};

export type GameSave = {
  currentLocation: LocationId;
  collectedClues: ClueId[];
  npcs: Record<NpcId, NpcRuntimeState>;
  ghosts: GhostRecord[];
};

const SAVE_KEY = 'glimmer_city_vertical_slice_save_v1';

export function createInitialSave(): GameSave {
  return {
    currentLocation: 'skybridge',
    collectedClues: [],
    npcs: {
      bridge_artist: createBridgeArtistState(),
      victor: createVictorState(),
    },
    ghosts: [],
  };
}

export function loadSave(): GameSave | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as any;

    // 验证关键字段
    if (!parsed.npcs?.bridge_artist || !Array.isArray(parsed.collectedClues)) {
      return null;
    }

    // Backward compat: 旧存档以 player.knowledge 形式存储 → 迁移到 npcs.npcId.knowledge
    if (typeof parsed.player?.knowledge === 'number') {
      if (parsed.npcs.bridge_artist && parsed.npcs.bridge_artist.knowledge === undefined) {
        parsed.npcs.bridge_artist.knowledge = parsed.player.knowledge;
      }
      if (parsed.npcs.victor && parsed.npcs.victor.knowledge === undefined) {
        parsed.npcs.victor.knowledge = 0;
      }
      delete parsed.player;
    }

    // 向下兼容旧字段
    const bridgeArtist = parsed.npcs.bridge_artist;
    if (bridgeArtist) {
      if (bridgeArtist.knowledge === undefined) bridgeArtist.knowledge = 0;
      if (bridgeArtist.innerWorldDepth === undefined) bridgeArtist.innerWorldDepth = 0;
      if (bridgeArtist.innerWorldLayer === undefined) bridgeArtist.innerWorldLayer = 0;
    }
    const victor = parsed.npcs.victor;
    if (victor) {
      if (victor.knowledge === undefined) victor.knowledge = 0;
      if (victor.innerWorldDepth === undefined) victor.innerWorldDepth = 0;
      if (victor.innerWorldLayer === undefined) victor.innerWorldLayer = 0;
    }

    // 移除旧的 player 字段（兼容旧存档格式）
    const result = parsed as GameSave;
    return result;
  } catch (error) {
    console.warn('讀取存檔失敗，將使用新存檔。', error);
    return null;
  }
}

export function persistSave(save: GameSave) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(SAVE_KEY, JSON.stringify(save, null, 2));
}

export function clearSave() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(SAVE_KEY);
}

export function exportSaveJson(save: GameSave) {
  return JSON.stringify(save, null, 2);
}
