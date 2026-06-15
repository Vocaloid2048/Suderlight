// ============================================================
// 多層級理解度系統
// 核心設計：「理解是一種選擇」——玩家必須主動選擇 insight 選項
// 支援四層心理世界獨立追蹤理解度
// ============================================================

import {
  getUnderstandingReward,
  getInteractable,
  type PsychInteractable,
  type UnderstandingReward,
} from '../data/psychologicalWorlds/bridgePainterWorld';

// ---- 狀態型別 ----

export type UnderstandingState = {
  /** 已獲得 insight 的物件 ID 列表（當前層級） */
  insightIds: string[];
};

/** 跨層級理解度狀態 */
export type MultiLayerUnderstandingState = {
  /** 各層理解狀態 */
  layers: Record<number, UnderstandingState>;
  /** 當前所在層級 */
  currentLayer: number;
};

// ---- 初始狀態 ----

export function createUnderstandingState(): UnderstandingState {
  return { insightIds: [] };
}

export function createMultiLayerUnderstandingState(currentLayer: number = 1): MultiLayerUnderstandingState {
  return {
    layers: { [currentLayer]: { insightIds: [] } },
    currentLayer,
  };
}

// ---- 核心操作 ----

/**
 * 玩家選擇反思後，嘗試加入理解度（指定層級）。
 * 返回 { state, reward }，若未選 insight 則 reward 為 null。
 */
export function tryAddInsight(
  state: UnderstandingState,
  interactableId: string,
  choseInsight: boolean,
  layerNumber?: number,
): {
  state: UnderstandingState;
  reward: UnderstandingReward | null;
} {
  const reward = getUnderstandingReward(interactableId, choseInsight, layerNumber);

  if (!reward) {
    return { state, reward: null };
  }

  // 已獲得過的不重複累積
  if (state.insightIds.includes(interactableId)) {
    return { state, reward };
  }

  return {
    state: {
      insightIds: [...state.insightIds, interactableId],
    },
    reward,
  };
}

/** 取得當前層級已累積的理解度總分 */
export function getCurrentLayerUnderstanding(state: UnderstandingState, layerNumber: number): number {
  let total = 0;
  for (const id of state.insightIds) {
    const reward = getUnderstandingReward(id, true, layerNumber);
    if (reward) total += reward.amount;
  }
  return total;
}

// ---- 查詢 ----

/** 是否已獲得指定物件的 insight */
export function hasInsight(state: UnderstandingState, id: string): boolean {
  return state.insightIds.includes(id);
}

/** 取得所有已獲得的理解片段文字 */
export function getInsightFragments(state: UnderstandingState): string[] {
  return state.insightIds
    .map(id => getInteractable(id))
    .filter((obj): obj is PsychInteractable => obj !== undefined)
    .map(obj => obj.insight);
}
