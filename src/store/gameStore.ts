import { create } from 'zustand';
import { bridgeArtistClues, type ClueId, type LocationId, type NpcId } from '../data/verticalSlice';
import { getClueKnowledge } from '../systems/investigationSystem';
import {
  applyDialogueEvaluation,
  evaluateBridgeArtistDialogue,
  markNpcFailed,
  markNpcSuccess,
  shouldUnlockInnerWorld,
  type DialogueEvaluationResult,
} from '../systems/npcStateEngine';
import { clearSave, createInitialSave, loadSave, persistSave, type GameSave, type GhostRecord } from '../systems/saveSystem';

export type CollectClueResult = {
  clueId: ClueId;
  label: string;
  knowledgeAdded: number;
  alreadyCollected: boolean;
  unlockedNow: boolean;
};

type GameStore = {
  save: GameSave;
  setCurrentLocation: (locationId: LocationId) => void;
  collectClue: (clueId: ClueId) => CollectClueResult;
  evaluateDialogue: (npcId: NpcId, playerInput: string) => DialogueEvaluationResult;
  completeNpcSuccess: (npcId: NpcId) => void;
  failNpc: (npcId: NpcId) => void;
  resetSave: () => void;
};

function cloneSave(save: GameSave): GameSave {
  return {
    ...save,
    player: { ...save.player },
    collectedClues: [...save.collectedClues],
    npcs: {
      bridge_artist: { ...save.npcs.bridge_artist, flags: [...save.npcs.bridge_artist.flags] },
      victor: { ...save.npcs.victor, flags: [...save.npcs.victor.flags] },
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

    return result;
  },

  evaluateDialogue: (npcId, playerInput) => {
    let result: DialogueEvaluationResult = {
      trustDelta: 0,
      stressDelta: 0,
      reason: '此NPC尚未接入狀態判定。',
      flags: [],
      innerWorldUnlocked: false,
      ending: 'none',
    };

    set(state => {
      const next = cloneSave(state.save);

      if (npcId !== 'bridge_artist') {
        return { save: state.save };
      }

      result = evaluateBridgeArtistDialogue(playerInput, next.npcs.bridge_artist, {
        knowledge: next.player.knowledge,
        collectedClues: next.collectedClues,
      });

      next.npcs.bridge_artist = applyDialogueEvaluation(next.npcs.bridge_artist, result);
      syncBridgeArtistUnlock(next);
      result = {
        ...result,
        innerWorldUnlocked: next.npcs.bridge_artist.innerWorldUnlocked,
        ending: next.npcs.bridge_artist.ending,
      };

      const finalSave = next.npcs.bridge_artist.ending === 'failed'
        ? addGhostIfNeeded(next, 'bridge_artist')
        : next;

      return { save: persistAndReturn(finalSave) };
    });

    return result;
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

  resetSave: () => {
    clearSave();
    const fresh = createInitialSave();
    persistSave(fresh);
    set({ save: fresh });
  },
}));

export function getCurrentSaveSnapshot() {
  return useGameStore.getState().save;
}

