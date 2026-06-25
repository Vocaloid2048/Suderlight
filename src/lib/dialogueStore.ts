/**
 * 对话历史本地存储 — player-based，每个 NPC 独立子对象
 * 
 * 结构：glimmer_dialogue_v2_<playerId> = { <npcId>: { lastInputTypes, history, fullHistory, summary, roundCount } }
 * 
 * - fullHistory: 所有对话（不重置）
 * - history: 当前分段对话（每 10 轮重置，对应后端的 currentHistory）
 * - summary: 后端 AI 生成的长期摘要（200 字，每 10 轮更新）
 * - roundCount: 当前总轮数
 * - lastInputTypes: 最近 10 次输入类型
 */

export type DialogueMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;
  systemJudgement?: {
    stateLabel: string;
    trustDelta: number;
    stressDelta: number;
    knowledgeDelta?: number;
    trust?: number;
    stress?: number;
    knowledge?: number;
  };
};

export type NpcDialogueData = {
  lastInputTypes: string[];
  history: DialogueMessage[];
  fullHistory: DialogueMessage[];
  summary: string;
  roundCount: number;
  /** 上次对话时的 innerWorldDepth，用于检测进度变化以追加新的开场白 */
  lastInnerWorldDepth: number;
};

export type PlayerDialogueStore = Record<string, NpcDialogueData>;

const STORAGE_KEY_PREFIX = 'glimmer_dialogue_v2_';

function storageKey(playerId: string): string {
  return `${STORAGE_KEY_PREFIX}${playerId}`;
}

export function loadPlayerStore(playerId: string): PlayerDialogueStore {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(storageKey(playerId));
    if (!raw) return {};
    return JSON.parse(raw) as PlayerDialogueStore;
  } catch {
    return {};
  }
}

function savePlayerStore(playerId: string, store: PlayerDialogueStore) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey(playerId), JSON.stringify(store));
  } catch (e) {
    console.warn('Failed to save dialogue store to localStorage:', e);
  }
}

function getDefaultNpcData(): NpcDialogueData {
  return {
    lastInputTypes: [],
    history: [],
    fullHistory: [],
    summary: '',
    roundCount: 0,
    lastInnerWorldDepth: 0,
  };
}

export function getNpcData(npcId: string, playerId: string): NpcDialogueData {
  const store = loadPlayerStore(playerId);
  return store[npcId] || getDefaultNpcData();
}

// ===== 兼容：旧的 v1 接口 =====
export function loadDialogueHistory(npcId: string, playerId: string): NpcDialogueData | null {
  const data = getNpcData(npcId, playerId);
  if (data.fullHistory.length === 0 && data.roundCount === 0) return null;
  return data;
}

// ===== 核心操作 =====

export function appendDialogueExchange(
  npcId: string,
  playerId: string,
  userMessage: string,
  npcReply: string,
  systemJudgement?: DialogueMessage['systemJudgement'],
  summary?: string,
  roundCount?: number,
  dialogueType?: string,
) {
  const store = loadPlayerStore(playerId);
  const data = store[npcId] || getDefaultNpcData();

  // fullHistory: 追加（永不重置）
  data.fullHistory.push({
    role: 'user',
    content: userMessage,
    timestamp: Date.now(),
  });
  data.fullHistory.push({
    role: 'assistant',
    content: npcReply,
    timestamp: Date.now(),
    systemJudgement,
  });
  if (data.fullHistory.length > 2000) {
    data.fullHistory = data.fullHistory.slice(-2000);
  }

  // history: 当前分段（每 10 轮由后端重置，前端同步）
  data.history.push({
    role: 'user',
    content: userMessage,
    timestamp: Date.now(),
  });
  data.history.push({
    role: 'assistant',
    content: npcReply,
    timestamp: Date.now(),
    systemJudgement,
  });

  // roundCount: 从后端同步
  if (roundCount !== undefined) {
    const newRound = roundCount;
    const oldRound = data.roundCount;
    if (newRound > oldRound && newRound % 10 === 0) {
      data.history = []; // 重置当前分段
    }
    data.roundCount = newRound;
  }

  // lastInputTypes: 跟踪最近类型
  if (dialogueType) {
    data.lastInputTypes.push(dialogueType);
    if (data.lastInputTypes.length > 10) {
      data.lastInputTypes = data.lastInputTypes.slice(-10);
    }
  }

  // summary: 后端生成后同步
  if (summary !== undefined && summary.trim() !== '') {
    data.summary = summary;
  }

  store[npcId] = data;
  savePlayerStore(playerId, store);
  return data;
}

export function getRecentDialogue(npcId: string, playerId: string, limit = 20): DialogueMessage[] {
  const data = getNpcData(npcId, playerId);
  return data.fullHistory.slice(-limit);
}

export function getFullDialogue(npcId: string, playerId: string): DialogueMessage[] {
  return getNpcData(npcId, playerId).fullHistory;
}

export function getSegmentHistory(npcId: string, playerId: string): DialogueMessage[] {
  return getNpcData(npcId, playerId).history;
}

export function getSummary(npcId: string, playerId: string): string {
  return getNpcData(npcId, playerId).summary;
}

export function getRoundCount(npcId: string, playerId: string): number {
  return getNpcData(npcId, playerId).roundCount;
}

export function clearDialogueHistory(npcId: string, playerId: string) {
  const store = loadPlayerStore(playerId);
  delete store[npcId];
  savePlayerStore(playerId, store);
}

/** 保存對話初始訊息（系統場景描述 + NPC 開場白）到 fullHistory，作為第 0 輪 */
export function saveInitialExchange(
  npcId: string,
  playerId: string,
  systemMessage: string,
  npcOpening: string,
  innerWorldDepth?: number,
) {
  const store = loadPlayerStore(playerId);
  const data = store[npcId] || getDefaultNpcData();
  // 只在尚未有任何紀錄時才寫入
  if (data.fullHistory.length === 0) {
    data.fullHistory.push({ role: 'system', content: systemMessage, timestamp: Date.now() });
    data.fullHistory.push({ role: 'assistant', content: npcOpening, timestamp: Date.now() });
    if (typeof innerWorldDepth === 'number') data.lastInnerWorldDepth = innerWorldDepth;
    store[npcId] = data;
    savePlayerStore(playerId, store);
  }
}

/** 當前進度超過上次對話深度時，追加新的場景訊息 + 開場白 */
export function appendProgressOpening(
  npcId: string,
  playerId: string,
  systemMessage: string,
  npcOpening: string,
  currentDepth: number,
): boolean {
  const store = loadPlayerStore(playerId);
  const data = store[npcId] || getDefaultNpcData();
  if (currentDepth > data.lastInnerWorldDepth && data.fullHistory.length > 0) {
    data.fullHistory.push({ role: 'system', content: systemMessage, timestamp: Date.now() });
    data.fullHistory.push({ role: 'assistant', content: npcOpening, timestamp: Date.now() });
    data.lastInnerWorldDepth = currentDepth;
    store[npcId] = data;
    savePlayerStore(playerId, store);
    return true;
  }
  return false;
}

export function clearAllDialogueHistory(playerId: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(storageKey(playerId));
}
