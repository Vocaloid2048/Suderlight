import { create } from 'zustand';
import { bridgeArtistClues, type ClueId, type LocationId, type NpcId } from '../data/verticalSlice';
import { getClueKnowledge } from '../systems/investigationSystem';
import {
  markNpcFailed,
  markNpcSuccess,
  shouldUnlockInnerWorld,
} from '../systems/npcStateEngine';
import { clearSave, createInitialSave, loadSave, loadSaveFromBackend, persistSave, syncSaveToBackend, type GameSave, type GhostRecord } from '../systems/saveSystem';
import { getPlayerAuthHeaders, getPlayerId } from '../lib/playerId';
import { isPlaytestEnabled } from '../hooks/narrativePlaytest';

export type CollectClueResult = {
  clueId: ClueId;
  label: string;
  knowledgeAdded: number;
  alreadyCollected: boolean;
  unlockedNow: boolean;
};

type BackendNpcStateSnapshot = {
  trust: number;
  stress: number;
  knowledge: number;
  innerWorldUnlocked: boolean;
  ending: 'none' | 'success' | 'failed' | null;
};

type GameStore = {
  save: GameSave;
  setCurrentLocation: (locationId: LocationId) => void;
  collectClue: (clueId: ClueId) => CollectClueResult;
  applyBackendNpcState: (npcId: NpcId, backendState: BackendNpcStateSnapshot) => void;
  completeNpcSuccess: (npcId: NpcId) => void;
  failNpc: (npcId: NpcId) => void;
  resetSave: () => void;

  /** 設定橋上畫家的心理世界探索深度 (0-3) */
  setInnerWorldDepth: (depth: number) => void;
  /** 記錄心理世界層級進展 (1-4) */
  advancePsychLayer: (layer: number) => void;
  /** 從後端加載存檔（異地登錄） */
  loadRemoteSave: () => Promise<void>;
  /** 從本地存檔初始化時同步到後端 */
  initAndSync: () => Promise<void>;
  /** Playtest: 強制滿足內心世界解鎖條件 */
  forceUnlockInnerWorld: () => void;
};

function cloneSave(save: GameSave): GameSave {
  return {
    ...save,
    player: { ...save.player },
    collectedClues: [...save.collectedClues],
    npcs: {
      bridge_artist: { ...save.npcs.bridge_artist, flags: [...save.npcs.bridge_artist.flags], innerWorldLayer: save.npcs.bridge_artist.innerWorldLayer ?? 0 },
      victor: { ...save.npcs.victor, flags: [...save.npcs.victor.flags], innerWorldLayer: save.npcs.victor.innerWorldLayer ?? 0 },
    },
    ghosts: [...save.ghosts],
  };
}

function persistAndReturn(save: GameSave) {
  persistSave(save);
  // 异步同步到后端（不阻塞 UI）
  syncSaveToBackend(save).catch(() => {});
  return save;
}

function addGhostIfNeeded(save: GameSave, npcId: NpcId): GameSave {
  if (save.ghosts.some(ghost => ghost.npc === npcId)) return save;

  const ghost: GhostRecord = {
    npc: npcId,
    failed: true,
    memoryText: '你確定嗎？上一次你也是這樣選的。',
    createdAt: new Date().toISOString(),
  };

  return {
    ...save,
    ghosts: [...save.ghosts, ghost],
  };
}

function syncBridgeArtistUnlock(save: GameSave) {
  const bridgeArtist = save.npcs.bridge_artist;
  if (!bridgeArtist.innerWorldUnlocked && shouldUnlockInnerWorld(bridgeArtist, save.player.knowledge)) {
    save.npcs.bridge_artist = {
      ...bridgeArtist,
      innerWorldUnlocked: true,
      flags: Array.from(new Set([...bridgeArtist.flags, 'inner_world_unlocked'])),
    };
  }
}

export const useGameStore = create<GameStore>((set) => ({

  save: loadSave() ?? createInitialSave(),

  setCurrentLocation: (locationId) => {
    set(state => {
      const next = cloneSave(state.save);
      next.currentLocation = locationId;
      return { save: persistAndReturn(next) };
    });
  },

  collectClue: (clueId) => {
    const clue = bridgeArtistClues[clueId];
    let result: CollectClueResult = {
      clueId,
      label: clue.label,
      knowledgeAdded: 0,
      alreadyCollected: true,
      unlockedNow: false,
    };

    set(state => {
      const next = cloneSave(state.save);
      const wasUnlocked = next.npcs.bridge_artist.innerWorldUnlocked;

      if (next.collectedClues.includes(clueId)) {
        return { save: state.save };
      }

      const knowledgeAdded = getClueKnowledge(clueId);
      next.collectedClues.push(clueId);
      next.player.knowledge = Math.min(100, next.player.knowledge + knowledgeAdded);
      syncBridgeArtistUnlock(next);

      result = {
        clueId,
        label: clue.label,
        knowledgeAdded,
        alreadyCollected: false,
        unlockedNow: !wasUnlocked && next.npcs.bridge_artist.innerWorldUnlocked,
      };

      return { save: persistAndReturn(next) };
    });

    // ---- playtest: log clue collection ----
    if (isPlaytestEnabled() && !result.alreadyCollected) {
      void import('../store/narrativePlaytestStore').then(mod => {
        mod.useNarrativePlaytestStore.getState().pushLog({
          type: 'clue',
          message: `收集線索: ${result.label}`,
          detail: `知識+${result.knowledgeAdded}${result.unlockedNow ? ', 解鎖內心世界' : ''}`,
        });
      }).catch(() => {});
    }

    return result;
  },



  applyBackendNpcState: (npcId, backendState) => {
    set(state => {
      const next = cloneSave(state.save);
      const target = next.npcs[npcId];
      if (!target) return { save: state.save };

      next.npcs[npcId] = {
        ...target,
        trust: backendState.trust,
        stress: backendState.stress,
        innerWorldUnlocked: Boolean(backendState.innerWorldUnlocked),
        ending: backendState.ending === null ? 'none' : backendState.ending,
      };

      if (next.npcs[npcId].ending === 'failed') {
        return { save: persistAndReturn(addGhostIfNeeded(next, npcId)) };
      }

      return { save: persistAndReturn(next) };
    });
  },

  completeNpcSuccess: (npcId) => {
    set(state => {
      const next = cloneSave(state.save);
      next.npcs[npcId] = markNpcSuccess(next.npcs[npcId]);
      return { save: persistAndReturn(next) };
    });
  },

  failNpc: (npcId) => {
    set(state => {
      const next = cloneSave(state.save);
      next.npcs[npcId] = markNpcFailed(next.npcs[npcId]);
      return { save: persistAndReturn(addGhostIfNeeded(next, npcId)) };
    });
  },

  resetSave: async () => {
    const playerId = getPlayerId();
    if (playerId) {
      try {
        // 並行但等待兩者完成
        await Promise.all([
          syncSaveToBackend(createInitialSave()),
          getPlayerAuthHeaders(playerId).then((headers) =>
            fetch('/api/chat/reset-all', {
              method: 'POST',
              headers,
            })
          )
        ]);
      } catch (err) {
        console.error('Remote reset failed:', err);
      }
    }
    
    clearSave();
    const fresh = createInitialSave();
    persistSave(fresh);
    set({ save: fresh });
  },

  setInnerWorldDepth: (depth) => {
    set(state => {
      const next = cloneSave(state.save);
      next.npcs.bridge_artist = {
        ...next.npcs.bridge_artist,
        innerWorldDepth: Math.max(next.npcs.bridge_artist.innerWorldDepth, depth),
      };
      return { save: persistAndReturn(next) };
    });
  },

  /** 記錄心理世界層級進展：將 innerWorldLayer 設為完成的最大層級 */
  advancePsychLayer: (layer) => {
    set(state => {
      const next = cloneSave(state.save);
      const currentLayer = next.npcs.bridge_artist.innerWorldLayer ?? 0;
      next.npcs.bridge_artist = {
        ...next.npcs.bridge_artist,
        innerWorldLayer: Math.max(currentLayer, layer),
      };
      return { save: persistAndReturn(next) };
    });
  },

  /** 從後端加載存檔 → 用於異地登錄場景 */
  loadRemoteSave: async () => {
    const playerId = getPlayerId();
    if (!playerId) return;

    const remoteSave = await loadSaveFromBackend(playerId);
    if (!remoteSave) return;

    // 將後端存檔合入本地（後端為權威來源）
    persistSave(remoteSave);
    set({ save: remoteSave });
  },

  /** 初始化後將本地存檔同步到後端 */
  initAndSync: async () => {
    const state = getCurrentSaveSnapshot();
    if (state) {
      await syncSaveToBackend(state);
    }
  },

  /** Playtest: 強制滿足內心世界解鎖條件 (F7) */
  forceUnlockInnerWorld: () => {
    set(state => {
      const next = cloneSave(state.save);
      next.player.knowledge = Math.max(next.player.knowledge, next.npcs.bridge_artist.knowledgeRequired);
      next.npcs.bridge_artist = {
        ...next.npcs.bridge_artist,
        trust: Math.max(next.npcs.bridge_artist.trust, next.npcs.bridge_artist.trustRequired),
        innerWorldUnlocked: true,
        flags: Array.from(new Set([...next.npcs.bridge_artist.flags, 'inner_world_unlocked'])),
      };
      return { save: persistAndReturn(next) };
    });
  },
}));

export function getCurrentSaveSnapshot() {
  return useGameStore.getState().save;
}

