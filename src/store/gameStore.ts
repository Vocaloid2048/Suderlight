import { create } from 'zustand';
import { bridgeArtistClues, type ClueId, type LocationId, type NpcId } from '../data/verticalSlice';
import { getClueKnowledge } from '../systems/investigationSystem';
import {
  markNpcFailed,
  markNpcSuccess,
  shouldUnlockInnerWorld,
  type InnerWorldSave,
} from '../systems/npcStateEngine';
import { clearSave, createInitialSave, loadSave, persistSave, type GameSave, type GhostRecord } from '../systems/saveSystem';
import { getPlayerAuthHeaders, getPlayerId } from '../lib/playerId';
import { clearDialogueHistory } from '../lib/dialogueStore';
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
  /** 同步內心世界詳細進度到存檔 */
  syncInnerWorldState: (innerWorld: InnerWorldSave) => void;
  /** Playtest: 直接設定 NPC 數值 (trust/stress/knowledge) */
  setNpcStat: (npcId: NpcId, stat: 'trust' | 'stress' | 'knowledge', value: number) => void;
  /** Playtest: 強制滿足內心世界解鎖條件 */
  forceUnlockInnerWorld: () => void;
};

function cloneSave(save: GameSave): GameSave {
  return {
    ...save,
    collectedClues: [...save.collectedClues],
    npcs: {
      bridge_artist: { ...save.npcs.bridge_artist, flags: [...save.npcs.bridge_artist.flags], innerWorldLayer: save.npcs.bridge_artist.innerWorldLayer ?? 0, innerWorld: save.npcs.bridge_artist.innerWorld ? { ...save.npcs.bridge_artist.innerWorld, layers: { ...save.npcs.bridge_artist.innerWorld.layers } } : undefined },
      victor: { ...save.npcs.victor, flags: [...save.npcs.victor.flags], innerWorldLayer: save.npcs.victor.innerWorldLayer ?? 0, innerWorld: save.npcs.victor.innerWorld ? { ...save.npcs.victor.innerWorld, layers: { ...save.npcs.victor.innerWorld.layers } } : undefined },
    },
    ghosts: [...save.ghosts],
  };
}

function persistAndReturn(save: GameSave) {
  persistSave(save);
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
  if (!bridgeArtist.innerWorldUnlocked && shouldUnlockInnerWorld(bridgeArtist, bridgeArtist.knowledge)) {
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
      next.npcs.bridge_artist = {
        ...next.npcs.bridge_artist,
        knowledge: Math.min(100, next.npcs.bridge_artist.knowledge + knowledgeAdded),
      };
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
        knowledge: backendState.knowledge != null ? backendState.knowledge : target.knowledge,
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
        const headers = await getPlayerAuthHeaders(playerId);
        await fetch('/api/chat/reset-all', {
          method: 'POST',
          headers,
        });
      } catch (err) {
        console.error('Remote reset failed:', err);
      }
    }
    
    clearSave();
    // 同时清除本地对话纪录
    if (playerId) {
      clearDialogueHistory('bridge_artist', playerId);
    }
    // 清除内心世界首次访问纪录
    try { window.localStorage.removeItem('sud_bridge_inner_visited'); } catch { /* ignore */ }
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

  /** 記錄心理世界層級進展：將 innerWorldLayer 設為完成的最大層級，同時標記對應 innerWorld 層級完成 */
  advancePsychLayer: (layer) => {
    set(state => {
      const next = cloneSave(state.save);
      const currentLayer = next.npcs.bridge_artist.innerWorldLayer ?? 0;
      // 同步更新 innerWorld
      const iw = next.npcs.bridge_artist.innerWorld;
      if (iw) {
        const layerState = iw.layers[layer];
        if (layerState) {
          iw.layers[layer] = { ...layerState, completed: true };
          // 下一層如未在 unlockedLayers 中則加入
          const nextLayer = layer + 1;
          if (nextLayer <= 4 && !iw.unlockedLayers.includes(nextLayer)) {
            iw.unlockedLayers = [...iw.unlockedLayers, nextLayer];
          }
        }
      }
      next.npcs.bridge_artist = {
        ...next.npcs.bridge_artist,
        innerWorldLayer: Math.max(currentLayer, layer),
        innerWorld: iw,
      };
      return { save: persistAndReturn(next) };
    });
  },

  /** 將 BridgePainterInnerWorld 運行時狀態同步到存檔 */
  syncInnerWorldState: (innerWorld) => {
    set(state => {
      const next = cloneSave(state.save);
      next.npcs.bridge_artist = {
        ...next.npcs.bridge_artist,
        innerWorld,
      };
      return { save: persistAndReturn(next) };
    });
  },

  /** Playtest: 直接設定 NPC 數值 (會自動重檢 innerWorldUnlocked) */
  setNpcStat: (npcId, stat, value) => {
    set(state => {
      const next = cloneSave(state.save);
      const target = next.npcs[npcId];
      if (!target) return { save: state.save };

      const clamped = Math.max(0, Math.min(100, Math.round(value)));
      const updated = { ...target, [stat]: clamped };

      // 重新檢查 innerWorldUnlocked 條件
      if (stat === 'trust' || stat === 'knowledge') {
        updated.innerWorldUnlocked = shouldUnlockInnerWorld(updated, updated.knowledge);
      }

      next.npcs[npcId] = updated;
      return { save: persistAndReturn(next) };
    });
  },

  /** Playtest: 強制滿足內心世界解鎖條件 (F7) */
  forceUnlockInnerWorld: () => {
    set(state => {
      const next = cloneSave(state.save);
      next.npcs.bridge_artist = {
        ...next.npcs.bridge_artist,
        knowledge: Math.max(next.npcs.bridge_artist.knowledge, next.npcs.bridge_artist.knowledgeRequired),
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

