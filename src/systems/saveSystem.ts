import type { ClueId, LocationId, NpcId } from '../data/verticalSlice';
import { createBridgeArtistState, createVictorState, type NpcRuntimeState } from './npcStateEngine';
import { getPlayerId, getPlayerIdHeader } from '../lib/playerId';

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

/**
 * 將存檔同步到後端伺服器（用於跨設備存取）
 * 返回 true 表示同步成功
 */
export async function syncSaveToBackend(save: GameSave): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const playerId = getPlayerId();
  if (!playerId) return false;

  try {
    const headers = getPlayerIdHeader();
    const res = await fetch('/api/save', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(save),
    });
    return res.ok;
  } catch (error) {
    console.warn('後端存檔同步失敗，仍保留本地存檔。', error);
    return false;
  }
}

/**
 * 從後端伺服器加載存檔（用於跨設備登錄）
 * 返回 null 表示無存檔或載入失敗
 */
export async function loadSaveFromBackend(playerId?: string): Promise<GameSave | null> {
  if (typeof window === 'undefined') return null;
  const id = playerId || getPlayerId();
  if (!id) return null;

  try {
    const res = await fetch('/api/save', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Player-Id': id,
      },
    });
    if (!res.ok) {
      console.warn('後端存檔載入失敗:', res.status);
      return null;
    }

    const data = await res.json();
    const backendSave = data.save;

    // 验证存档结构
    if (!backendSave?.player || !backendSave?.npcs?.bridge_artist) {
      return null;
    }

    return backendSave as GameSave;
  } catch (error) {
    console.warn('後端存檔載入異常:', error);
    return null;
  }
}

/**
 * 检查后端是否存在该球员存档（用于异地登录验证）
 */
export async function checkPlayerExists(playerId: string): Promise<boolean> {
  try {
    const res = await fetch('/api/save/lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    return data.exists === true;
  } catch {
    return false;
  }
}

export function clearSave() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(SAVE_KEY);
}

export function exportSaveJson(save: GameSave) {
  return JSON.stringify(save, null, 2);
}
