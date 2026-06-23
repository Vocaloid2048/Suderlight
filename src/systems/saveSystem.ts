import type { ClueId, LocationId, NpcId } from '../data/verticalSlice';
import { createBridgeArtistState, createVictorState, type NpcRuntimeState } from './npcStateEngine';

export type GhostRecord = {
  npc: NpcId;
  failed: true;
  memoryText: string;
  createdAt: string;
};

export type GameSave = {
  player: {
    knowledge: number;
  };
  currentLocation: LocationId;
  collectedClues: ClueId[];
  npcs: Record<NpcId, NpcRuntimeState>;
  ghosts: GhostRecord[];
};

const SAVE_KEY = 'glimmer_city_vertical_slice_save_v1';

export function createInitialSave(): GameSave {
  return {
    player: {
      knowledge: 0,
    },
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
    const parsed = JSON.parse(raw) as GameSave;

    if (!parsed.player || !parsed.npcs?.bridge_artist || !Array.isArray(parsed.collectedClues)) {
      return null;
    }

    // Backward compat: ensure new fields exist on older saves
    if (parsed.npcs.bridge_artist) {
      if (parsed.npcs.bridge_artist.innerWorldDepth === undefined) parsed.npcs.bridge_artist.innerWorldDepth = 0;
      if (parsed.npcs.bridge_artist.innerWorldLayer === undefined) parsed.npcs.bridge_artist.innerWorldLayer = 0;
    }
    if (parsed.npcs.victor) {
      if (parsed.npcs.victor.innerWorldDepth === undefined) parsed.npcs.victor.innerWorldDepth = 0;
      if (parsed.npcs.victor.innerWorldLayer === undefined) parsed.npcs.victor.innerWorldLayer = 0;
    }

    return parsed;
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
