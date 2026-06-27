import { create } from 'zustand';
import { bridgeArtistClues, type BridgeArtistClueId } from '../data/npcs/bridgePainter';
import type { NpcId } from '../data/verticalSlice';
import type { LocationId } from '../data/locations';
import { getClueKnowledge } from '../systems/investigationSystem';
import { ALL_PSYCH_LAYERS } from '../data/psychologicalWorlds/index';
import {
  markNpcFailed,
  markNpcSuccess,
  shouldUnlockInnerWorld,
  type InnerWorldSave,
  type InnerWorldLayerState,
  type UnderstoodItem,
} from '../systems/npcStateEngine';
import { clearSave, createInitialSave, loadSave, persistSave, type GameSave, type GhostRecord } from '../systems/saveSystem';
import { getPlayerAuthHeaders, getPlayerId } from '../lib/playerId';
import { clearDialogueHistory } from '../lib/dialogueStore';
import { isPlaytestEnabled } from '../hooks/narrativePlaytest';

// 向後相容：ClueId = BridgeArtistClueId
export type ClueId = BridgeArtistClueId;

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
  addFlagToNpc: (npcId: NpcId, flag: string) => void;
  resetSave: () => void;

  /** 設定橋上畫家的心理世界探索深度 (0-3) */
  setInnerWorldDepth: (depth: number) => void;
  /** 記錄心理世界層級進展 (1-4) */
  advancePsychLayer: (layer: number) => void;
  /** 同步內心世界詳細進度到存檔 */
  syncInnerWorldState: (innerWorld: InnerWorldSave) => void;
  /** Playtest: 直接設定 NPC 數值 (trust/stress/knowledge) */
  setNpcStat: (npcId: NpcId, stat: 'trust' | 'stress' | 'knowledge', value: number) => void;
  /** Playtest: 原子解鎖指定章節（設定 stats + 解鎖前一層物品 + 同步心理世界存檔） */
  unlockChapter: (depth: number, stressTarget: number) => void;
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

/**
 * 通用：同步指定 NPC 的 innerWorldUnlocked 狀態
 */
function syncNpcUnlock(save: GameSave, npcId: NpcId) {
  const npc = save.npcs[npcId];
  if (!npc) return;
  if (!npc.innerWorldUnlocked && shouldUnlockInnerWorld(npc, npc.knowledge)) {
    save.npcs[npcId] = {
      ...npc,
      innerWorldUnlocked: true,
      flags: Array.from(new Set([...npc.flags, 'inner_world_unlocked'])),
    };
  }
}

// 向後相容 alias
function syncBridgeArtistUnlock(save: GameSave) {
  syncNpcUnlock(save, 'bridge_artist');
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
      label: clue?.label ?? clueId,
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
        label: clue?.label ?? clueId,
        knowledgeAdded,
        alreadyCollected: false,
        unlockedNow: !wasUnlocked && next.npcs.bridge_artist.innerWorldUnlocked,
      };

      return { save: persistAndReturn(next) };
    });

    // ---- playtest: log clue collection ----
    if (isPlaytestEnabled() && !result.alreadyCollected) {
      void import('../store/devtoolsStore').then(mod => {
        mod.useDevtoolsStore.getState().pushLog({
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

  addFlagToNpc: (npcId, flag) => {
    set(state => {
      const next = cloneSave(state.save);
      const target = next.npcs[npcId];
      if (!target) return { save: state.save };
      if (target.flags.includes(flag)) return { save: state.save };
      next.npcs[npcId] = {
        ...target,
        flags: [...target.flags, flag],
      };
      return { save: persistAndReturn(next) };
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

  /** 將 NpcInnerWorld 運行時狀態同步到存檔 */
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

  /** Playtest: 原子解鎖指定章節（設定 stats + 解鎖前一層物品 + 同步心理世界存檔） */
  unlockChapter: (depth, stressTarget) => {
    set(state => {
      const next = cloneSave(state.save);
      const npc = next.npcs.bridge_artist;

      // 各章節所需信任/知識門檻
      const chapterRequirements: Record<number, { trust: number; knowledge: number }> = {
        1: { trust: 0, knowledge: 0 },
        2: { trust: 30, knowledge: 40 },
        3: { trust: 50, knowledge: 70 },
        4: { trust: 70, knowledge: 90 },
      };
      const req = chapterRequirements[depth];
      if (!req) return { save: state.save };

      // 1. 設定 trust/knowledge/stress
      const newTrust = Math.max(npc.trust, req.trust);
      const newKnowledge = Math.max(npc.knowledge, req.knowledge);
      const newStress = Math.min(npc.stress, stressTarget);
      const stressOk = newStress <= stressTarget;

      // 2. 解鎖前一層前 4 個物品 + 標示 completed
      const layers: Record<number, InnerWorldLayerState> = {};
      const existingLayers = npc.innerWorld?.layers ?? {};
      let layerModified = false;

      for (let l = 1; l < depth; l++) {
        const psychLayer = ALL_PSYCH_LAYERS.find(ld => ld.layerNumber === l);
        if (!psychLayer) continue;

        const first4 = psychLayer.interactables.slice(0, 4);
        const existingLayer = existingLayers[l];
        const existingDisc = existingLayer?.discoveredItems ?? [];
        const existingUnd = existingLayer?.understoodItems ?? [];

        const discoveredItems = [...new Set([...existingDisc, ...first4.map(o => o.id)])];
        const understoodMap = new Map(existingUnd.map(u => [u.id, u]));
        for (const obj of first4) {
          if (!understoodMap.has(obj.id)) {
            understoodMap.set(obj.id, { id: obj.id, name: obj.name, understandingReward: obj.understandingReward });
          }
        }
        const understoodItems: UnderstoodItem[] = Array.from(understoodMap.values());

        layers[l] = {
          completed: stressOk,
          understandingScore: first4.reduce((sum, o) => sum + o.understandingReward, 0),
          understoodItems,
          discoveredItems,
        };
        layerModified = true;
      }

      if (layerModified) {
        // 保留 depth+ 的原有資料
        for (let l = depth; l <= 4; l++) {
          if (existingLayers[l]) layers[l] = { ...existingLayers[l] };
        }
        const iw: InnerWorldSave = {
          unlockedLayers: [1, 2, 3, 4].filter(l => l <= depth || (npc.innerWorld?.unlockedLayers?.includes(l) ?? false)),
          layers,
        };
        next.npcs.bridge_artist = {
          ...npc,
          trust: newTrust,
          knowledge: newKnowledge,
          stress: newStress,
          innerWorld: iw,
        };
      } else {
        next.npcs.bridge_artist = {
          ...npc,
          trust: newTrust,
          knowledge: newKnowledge,
          stress: newStress,
        };
      }

      // 3. localStorage visited layers
      if (depth > 1) {
        try {
          const visitedKey = 'sud_bridge_artist_inner_visited';
          const raw = localStorage.getItem(visitedKey);
          const visited: number[] = raw ? JSON.parse(raw) : [];
          for (let l = 1; l < depth; l++) {
            if (!visited.includes(l)) visited.push(l);
          }
          localStorage.setItem(visitedKey, JSON.stringify(visited));
        } catch { /* ignore */ }
      }

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
