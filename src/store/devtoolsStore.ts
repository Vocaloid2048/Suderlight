// ============================================================
// Devtools Store（合併）
// 整合 narrativeDebugStore + narrativePlaytestStore
// 保留所有原有 state / actions，新增 tab 切換
// ============================================================

import { create } from 'zustand';
import type { DialogueEvaluationResult } from '../systems/npcStateEngine';

// ---- Inner World Event ----
export type InnerWorldEventItem = {
  id: string;
  name: string;
  discovered: boolean;
  completed: boolean;
};

// ---- Narrative Event Log ----
export type NarrativeLogEntry = {
  timestamp: number;
  type: 'dialogue' | 'clue' | 'inner_world' | 'state_change' | 'force_unlock' | 'demo';
  message: string;
  detail?: string;
};

// ---- Chapter Selector ----
export type ChapterInfo = {
  depth: number;
  title: string;
  description: string;
  requiredTrust: number;
  requiredKnowledge: number;
};

export const CHAPTERS: ChapterInfo[] = [
  { depth: 1, title: '第一章 · 表層碎片', description: '冠軍畫作、獎盃等榮耀符號 — 他在用過去的成就築牆', requiredTrust: 0, requiredKnowledge: 0 },
  { depth: 2, title: '第二章 · 裂痕與懷疑', description: '媒體訪談牆、觀眾留言 — 外界期待如何壓垮他', requiredTrust: 30, requiredKnowledge: 40 },
  { depth: 3, title: '第三章 · 深淵真相', description: '簽名展示區 — 面對失去色彩後仍選擇簽下名字', requiredTrust: 50, requiredKnowledge: 70 },
];

// ---- Tab type ----
export type DevtoolsTab = 'overview' | 'stat_control' | 'chapters' | 'event_log';

// ---- Store State ----
export type DevtoolsState = {
  /** QA panel is visible */
  active: boolean;
  toggle: () => void;

  /** Active tab */
  activeTab: DevtoolsTab;
  setActiveTab: (tab: DevtoolsTab) => void;

  /** Demo mode for competition recording */
  demoMode: boolean;
  toggleDemo: () => void;

  /** Chapter selector modal */
  chapterSelectorOpen: boolean;
  openChapterSelector: () => void;
  closeChapterSelector: () => void;

  /** Latest dialogue evaluation */
  lastEvaluation: DialogueEvaluationResult | null;
  setLastEvaluation: (e: DialogueEvaluationResult) => void;

  /** Inner world progress */
  innerWorldEvents: InnerWorldEventItem[];
  recordDiscover: (id: string) => void;
  recordComplete: (id: string) => void;

  /** Narrative event log */
  eventLog: NarrativeLogEntry[];
  pushLog: (entry: Omit<NarrativeLogEntry, 'timestamp'>) => void;

  reset: () => void;
};

// ---- Initial Data ----
const INITIAL_INNER_WORLD: InnerWorldEventItem[] = [
  { id: 'champion_painting', name: '冠軍畫作', discovered: false, completed: false },
  { id: 'award_trophy', name: '獲獎獎盃', discovered: false, completed: false },
  { id: 'media_interview', name: '媒體專訪牆', discovered: false, completed: false },
  { id: 'audience_wall', name: '觀眾留言牆', discovered: false, completed: false },
  { id: 'signature_display', name: '簽名展示區', discovered: false, completed: false },
];

// ---- Store ----
export const useDevtoolsStore = create<DevtoolsState>((set) => ({
  active: false,
  toggle: () => set((s) => ({ active: !s.active })),

  activeTab: 'overview',
  setActiveTab: (tab) => set({ activeTab: tab }),

  demoMode: false,
  toggleDemo: () =>
    set((s) => {
      const next = !s.demoMode;
      return {
        demoMode: next,
        // Demo mode auto-closes QA panel for clean recording
        active: next ? false : s.active,
      };
    }),

  chapterSelectorOpen: false,
  openChapterSelector: () => set({ chapterSelectorOpen: true }),
  closeChapterSelector: () => set({ chapterSelectorOpen: false }),

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

  eventLog: [],
  pushLog: (entry) =>
    set((s) => ({
      eventLog: [{ ...entry, timestamp: Date.now() }, ...s.eventLog.slice(0, 99)],
    })),

  reset: () =>
    set({
      lastEvaluation: null,
      innerWorldEvents: INITIAL_INNER_WORLD.map((e) => ({ ...e })),
      eventLog: [],
    }),
}));

// ---- 向後相容 re-export ----
// 舊代碼 import { useNarrativePlaytestStore } 仍可正常工作
export const useNarrativePlaytestStore = useDevtoolsStore;
export const useNarrativeDebugStore = useDevtoolsStore;
