// ============================================================
// NpcDefinition 核心類型定義
// 每個 NPC 提供一組資料，前端透過通用元件自動產生畫面
// ============================================================

import type { NpcId } from '../verticalSlice';

// ---- 角色卡 ----

export type NpcSpeakingStyle = {
  tone: string;
  rhythm: string;
  avoidWords: string[];
  preferredImages: string[];
  punctuation: string[];
};

export type NpcCharacterCard = {
  id: NpcId;
  name: string;
  displayName: string;
  districtId: string;
  innerWorldTemplate: string;
  coreEmotion: string;
  role: string;
  personality: string[];
  speakingStyle: NpcSpeakingStyle | string[];
  scenario: string;
  firstMessage: string;
  exampleDialogues: Array<{ player: string; npc: string }>;
  hiddenTruth: string;
  safetyRule: string;
};

// ---- 線索定義 ----

export type ClueDefinition = {
  id: string;
  label: string;
  shortLabel: string;
  knowledge: number;
  /** 世界/地點 ID，用於等角地圖對應 */
  worldId: string;
  locationId: string;
  pos: { x: number; y: number };
  color: string;
  icon: string;
  content: string;
  dictionaryHint: string;
};

// ---- Lorebook ----

export type LorebookEntry = {
  id: string;
  keywords: string[];
  requiredFlags: string[];
  relatedNpcIds: string[];
  priority: number;
  content: string;
};

// ---- 修復指引規則 ----

export type RepairTipRule = {
  /** 優先級（數字越大越優先評估） */
  priority: number;
  /** 判斷條件 */
  condition: (npcState: {
    trust: number;
    stress: number;
    knowledge: number;
    innerWorldUnlocked: boolean;
    innerWorldDepth: number;
  }) => boolean;
  /** 對應的修復指引文字 */
  tip: string;
};

// ---- 對話模擬（離線 fallback） ----

export type SimulatedReply = {
  dialogue: string;
  dictionaryHint?: string;
  safetyLevel?: 'safe' | 'safety_redirect';
};

export type DialogueSimulatorFn = (params: {
  playerInput: string;
  inventory: string[];
  history: Array<{ role: 'player' | 'npc' | 'system'; content: string }>;
  depth: number;
}) => SimulatedReply;

// ---- 開場白 (按深度) ----

export type OpeningEntry = {
  /** 達到該深度返回地圖時顯示此開場 */
  depth: number | 'arc_complete';
  systemMessage: string;
  npcMessage: string;
};

// ---- 結尾文案 ----

export type EndingContent = {
  success: string;
  failed: string;
  none: string;
};

// ---- 心理世界視覺參考 ----

export type VisualRegistry = {
  /** 對應到 UI 元件的 key，由各 NPC 自訂 */
  floatingTextsByLayer: Record<number, string[]>;
  /** 覆蓋地圖上各可互動物件的 pin 座標 */
  pinCoordinates: Record<string, { top: string; left: string }>;
};

// ---- NpcDefinition 主體 ----

export type NpcDefinition = {
  /** NPC 唯一識別 ID */
  id: NpcId;
  /** 角色卡（角色扮演用） */
  characterCard: NpcCharacterCard;
  /** Lorebook（線索觸發內容） */
  lorebook: LorebookEntry[];
  /** 修復指引規則（優先級排序，由 evaluateRepairTip 評估） */
  repairTipRules: RepairTipRule[];
  /** 對話離線模擬函式 */
  simulateReply: DialogueSimulatorFn;
  /** 按深度顯示的開場白列表 */
  openingsByDepth: OpeningEntry[];
  /** 結尾文案 */
  ending: EndingContent;
  /** 心理世界視覺登記（pin 座標、漂浮文字） */
  visualRegistry: VisualRegistry;
  /** 解鎖心理世界需要的門檻 */
  thresholds: {
    knowledgeRequired: number;
    trustRequired: number;
  };
  /** 預設初始狀態 */
  initialState: {
    trust: number;
    stress: number;
  };
};

// ---- 通用修復指引評估 ----

/**
 * 根據 npcDef.repairTipRules 評估並返回對應的修復指引文字
 */
export function evaluateRepairTip(
  npcDef: NpcDefinition,
  npcState: { trust: number; stress: number; knowledge: number; innerWorldUnlocked: boolean; innerWorldDepth: number },
): string {
  const sorted = [...npcDef.repairTipRules].sort((a, b) => b.priority - a.priority);
  for (const rule of sorted) {
    if (rule.condition(npcState)) return rule.tip;
  }
  return '';
}
