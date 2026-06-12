// ============================================================
// 最小理解度系統
// 核心設計：「理解是一種選擇」——玩家必須主動選擇 insight 選項
// 數值純後台，UI 僅顯示理解片段文字
// ============================================================

import {
  getUnderstandingReward,
  getInteractable,
  type GalleryInteractable,
  type UnderstandingReward,
} from '../data/psychologicalWorlds/bridgePainterWorld';

// ---- 狀態型別 ----

export type UnderstandingState = {
  /** 已獲得 insight 的物件 ID 列表 */
  insightIds: string[];
};

// ---- 初始狀態 ----

export function createUnderstandingState(): UnderstandingState {
  return {
    insightIds: [],
  };
}

// ---- 核心操作 ----

/**
 * 玩家選擇反思後，嘗試加入理解度。
 * 返回 { state, reward }，若未選 insight 則 reward 為 null，state 不變。
 */
export function tryAddInsight(
  state: UnderstandingState,
  interactableId: string,
  choseInsight: boolean,
): {
  state: UnderstandingState;
  reward: UnderstandingReward | null;
} {
  const reward = getUnderstandingReward(interactableId, choseInsight);

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

// ---- 查詢 ----

/** 是否已獲得指定物件的 insight */
export function hasInsight(state: UnderstandingState, id: string): boolean {
  return state.insightIds.includes(id);
}

/** 取得所有已獲得的理解片段文字 */
export function getInsightFragments(state: UnderstandingState): string[] {
  return state.insightIds
    .map(id => getInteractable(id))
    .filter((obj): obj is GalleryInteractable => obj !== undefined)
    .map(obj => obj.insight);
}

// ============================================================
// >>> 未來架構方向 <<<
//
// 目前 UnderstandingState 為 Layer-1 級（單層心理世界）。
// 未來《微光城市》完整版需要角色級理解度：
//
//   CharacterUnderstandingState {
//     characterId: string
//     layers: { layer1, layer2, layer3, layer4 }
//     totalUnderstanding: number
//   }
//
// 這樣「榮耀美術館 35」→「車禍現場 60」→「褪色畫室 85」→「空白畫框 100」
// 才能形成完整的角色理解弧線。
// 現在不用做，但要知道方向。
// ============================================================
