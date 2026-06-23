/**
 * 对话历史本地存储 — 将 summary、roundCount、fullHistory 储存在用户设备
 * 
 * 用于离线查看、跨页面恢复，弥补 EdgeOne 云函数无状态的数据丢失问题。
 */

export type DialogueMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;
  systemJudgement?: {
    stateLabel: string;
    trustDelta: number;
    stressDelta: number;
    trust?: number;
    stress?: number;
    knowledge?: number;
  };
};

export type LocalDialogueHistory = {
  npcId: string;
  playerId: string;
  summary: string;
  roundCount: number;
  fullHistory: DialogueMessage[];
  lastSavedAt: number;
};

const STORAGE_PREFIX = 'glimmer_dialogue_v1_';

function storageKey(npcId: string, playerId: string): string {
  return `${STORAGE_PREFIX}${playerId}_${npcId}`;
}

export function loadDialogueHistory(npcId: string, playerId: string): LocalDialogueHistory | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(storageKey(npcId, playerId));
    if (!raw) return null;
    return JSON.parse(raw) as LocalDialogueHistory;
  } catch {
    return null;
  }
}

export function saveDialogueHistory(history: LocalDialogueHistory) {
  if (typeof window === 'undefined') return;
  history.lastSavedAt = Date.now();
  try {
    window.localStorage.setItem(
      storageKey(history.npcId, history.playerId),
      JSON.stringify(history),
    );
  } catch (e) {
    console.warn('Failed to save dialogue history to localStorage:', e);
  }
}

export function appendDialogueExchange(
  npcId: string,
  playerId: string,
  userMessage: string,
  npcReply: string,
  systemJudgement?: DialogueMessage['systemJudgement'],
  summary?: string,
  roundCount?: number,
) {
  const existing = loadDialogueHistory(npcId, playerId) || {
    npcId,
    playerId,
    summary: '',
    roundCount: 0,
    fullHistory: [],
    lastSavedAt: 0,
  };

  existing.fullHistory.push({
    role: 'user',
    content: userMessage,
    timestamp: Date.now(),
  });
  existing.fullHistory.push({
    role: 'assistant',
    content: npcReply,
    timestamp: Date.now(),
    systemJudgement,
  });

  // Keep last 2000 entries
  if (existing.fullHistory.length > 2000) {
    existing.fullHistory = existing.fullHistory.slice(-2000);
  }

  if (summary !== undefined) existing.summary = summary;
  if (roundCount !== undefined) existing.roundCount = roundCount;

  saveDialogueHistory(existing);
  return existing;
}

export function getRecentDialogue(npcId: string, playerId: string, limit = 20): DialogueMessage[] {
  const history = loadDialogueHistory(npcId, playerId);
  if (!history) return [];
  return history.fullHistory.slice(-limit);
}

export function getFullDialogue(npcId: string, playerId: string): DialogueMessage[] {
  const history = loadDialogueHistory(npcId, playerId);
  if (!history) return [];
  return history.fullHistory;
}

export function clearDialogueHistory(npcId: string, playerId: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(storageKey(npcId, playerId));
}

export function clearAllDialogueHistory(playerId: string) {
  if (typeof window === 'undefined') return;
  const prefix = `${STORAGE_PREFIX}${playerId}_`;
  const keys = Object.keys(window.localStorage).filter(k => k.startsWith(prefix));
  keys.forEach(k => window.localStorage.removeItem(k));
}
