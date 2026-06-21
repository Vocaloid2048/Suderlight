// ============================================================
// Narrative Debug Store (DEV ONLY — tree-shaken in production)
// ============================================================

import { create } from 'zustand';
import type { DialogueEvaluationResult } from '../systems/npcStateEngine';

export type InnerWorldEventItem = {
  id: string;
  name: string;
  discovered: boolean;
  completed: boolean; // player chose insight:true
};

export type NarrativeDebugState = {
  /** Whether debug mode is currently active */
  active: boolean;
  toggle: () => void;

  /** Latest dialogue evaluation result from npcStateEngine */
  lastEvaluation: DialogueEvaluationResult | null;
  setLastEvaluation: (e: DialogueEvaluationResult) => void;

  /** Inner world interactable tracking */
  innerWorldEvents: InnerWorldEventItem[];
  recordDiscover: (id: string) => void;
  recordComplete: (id: string) => void;

  reset: () => void;
};

const INITIAL_INNER_WORLD: InnerWorldEventItem[] = [
  { id: 'champion_painting', name: '冠軍畫作', discovered: false, completed: false },
  { id: 'award_trophy', name: '獲獎獎盃', discovered: false, completed: false },
  { id: 'media_interview', name: '媒體專訪牆', discovered: false, completed: false },
  { id: 'audience_wall', name: '觀眾留言牆', discovered: false, completed: false },
  { id: 'signature_display', name: '簽名展示區', discovered: false, completed: false },
];

export const useNarrativeDebugStore = create<NarrativeDebugState>((set) => ({
  active: false,
  toggle: () => set((s) => ({ active: !s.active })),

  lastEvaluation: null,
  setLastEvaluation: (e) => set({ lastEvaluation: e }),

  innerWorldEvents: INITIAL_INNER_WORLD.map((e) => ({ ...e })),
  recordDiscover: (id) =>
    set((s) => ({
      innerWorldEvents: s.innerWorldEvents.map((e) =>
        e.id === id ? { ...e, discovered: true } : e,
      ),
    })),
  recordComplete: (id) =>
    set((s) => ({
      innerWorldEvents: s.innerWorldEvents.map((e) =>
        e.id === id ? { ...e, completed: true } : e,
      ),
    })),

  reset: () =>
    set({
      lastEvaluation: null,
      innerWorldEvents: INITIAL_INNER_WORLD.map((e) => ({ ...e })),
    }),
}));
