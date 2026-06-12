import type { ClueId, NpcId } from '../data/verticalSlice';

export type NpcEnding = 'none' | 'success' | 'failed';

export type NpcRuntimeState = {
  id: NpcId;
  name: string;
  trust: number;
  stress: number;
  knowledgeRequired: number;
  trustRequired: number;
  innerWorldUnlocked: boolean;
  ending: NpcEnding;
  flags: string[];
  /** 心理世界探索深度：0=未進入, 1=理解不足, 2=理解中等, 3=理解很深 */
  innerWorldDepth: number;
};

export type DialogueEvaluationContext = {
  knowledge: number;
  collectedClues: ClueId[];
};

export type DialogueEvaluationResult = {
  trustDelta: number;
  stressDelta: number;
  reason: string;
  flags: string[];
  innerWorldUnlocked: boolean;
  ending: NpcEnding;
  safetyRedirect?: boolean;
};

const forcedComfortWords = ['加油', '振作', '會好的', '一定會好', '重新開始', '不要想太多', '你可以再畫', '你一定能畫', '復出'];
const empathyWords = ['我陪你', '陪你', '不用立刻', '不用馬上', '慢慢來', '可以沉默', '不說話', '我願意聽', '聽你說', '你現在這樣也可以', '不畫畫也沒關係'];
const acceptanceWords = ['空白也可以', '不用填滿', '不是你的錯', '不需要變好', '不需要證明', '不用證明', '你不只是畫家', '你不是作品'];
const geniusConsumptionWords = ['天才', '大師', '作品價值', '一定很美', '有名', '賣畫', '人設'];
const crisisWords = ['我想死', '想死', '不想活', '自殺', '傷害自己'];

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function hasAny(input: string, words: string[]) {
  return words.some(word => input.includes(word));
}

function mergeFlags(oldFlags: string[], newFlags: string[]) {
  return Array.from(new Set([...oldFlags, ...newFlags]));
}

export function createBridgeArtistState(): NpcRuntimeState {
  return {
    id: 'bridge_artist',
    name: '天橋畫家',
    trust: 20,
    stress: 80,
    knowledgeRequired: 70,
    trustRequired: 50,
    innerWorldUnlocked: false,
    ending: 'none',
    flags: [],
    innerWorldDepth: 0,
  };
}

export function createVictorState(): NpcRuntimeState {
  return {
    id: 'victor',
    name: '調香師 維克多',
    trust: 10,
    stress: 90,
    knowledgeRequired: 70,
    trustRequired: 50,
    innerWorldUnlocked: false,
    ending: 'none',
    flags: [],
    innerWorldDepth: 0,
  };
}

export function shouldUnlockInnerWorld(state: NpcRuntimeState, knowledge: number) {
  return state.ending === 'none' && knowledge >= state.knowledgeRequired && state.trust >= state.trustRequired;
}

export function evaluateBridgeArtistDialogue(
  playerInput: string,
  state: NpcRuntimeState,
  context: DialogueEvaluationContext,
): DialogueEvaluationResult {
  const input = playerInput.trim().toLowerCase();
  const flags: string[] = [];
  let trustDelta = 1;
  let stressDelta = -1;
  let reason = '你沒有急著替他下結論，對話維持在安全距離。';
  let safetyRedirect = false;

  if (hasAny(input, crisisWords)) {
    trustDelta = 0;
    stressDelta = -2;
    reason = '系統偵測到現實危機語句：停止角色誘導，轉向安全提醒。';
    flags.push('safety_redirect_triggered');
    safetyRedirect = true;
  } else if (hasAny(input, forcedComfortWords)) {
    trustDelta = -5;
    stressDelta = 10;
    reason = '你使用了勵志式安慰。系統判定這會否定他當下的空白狀態。';
    flags.push('player_used_forced_comfort');
  } else if (hasAny(input, geniusConsumptionWords)) {
    trustDelta = -6;
    stressDelta = 8;
    reason = '你觸碰到「天才畫家」身分壓力。系統判定他感到被作品價值消費。';
    flags.push('player_consumed_genius_identity');
  } else if (hasAny(input, empathyWords) || hasAny(input, acceptanceWords)) {
    trustDelta = 10;
    stressDelta = -8;
    reason = '你選擇陪伴與接納，而不是修理他。Trust 上升，Stress 下降。';
    flags.push('player_offered_presence');
  } else if (input.includes('雨聲') || input.includes('聽見雨') || input.includes('風')) {
    trustDelta = 7;
    stressDelta = -5;
    reason = '你把注意力放回當下的感官，而不是要求他恢復過去。';
    flags.push('player_grounded_in_present_sense');
  } else if ((input.includes('車禍') || input.includes('事故') || input.includes('辨色')) && !context.collectedClues.includes('newspaper') && !context.collectedClues.includes('accident_report')) {
    trustDelta = -4;
    stressDelta = 7;
    reason = '你提到尚未取得的真相。系統判定這是未經鋪墊的窺探。';
    flags.push('player_pressed_unearned_truth');
  } else if (context.collectedClues.includes('brush') && (input.includes('畫筆') || input.includes('筆'))) {
    trustDelta = 5;
    stressDelta = 2;
    reason = '你出示了畫筆。這增加真相接近度，也讓他的壓力短暫升高。';
    flags.push('painter_reacted_to_brush');
  } else if ((context.collectedClues.includes('newspaper') || context.collectedClues.includes('accident_report')) && (input.includes('報紙') || input.includes('車禍') || input.includes('事故') || input.includes('辨色'))) {
    trustDelta = 6;
    stressDelta = 3;
    reason = '你基於已收集線索提問。真相更靠近，但情緒也被牽動。';
    flags.push('painter_acknowledged_accident');
  } else if (context.collectedClues.includes('sketchbook') && (input.includes('素描') || input.includes('春天') || input.includes('形狀'))) {
    trustDelta = 7;
    stressDelta = -1;
    reason = '你讀懂了素描本裡的自我懷疑，而不是只看見作品。';
    flags.push('painter_sketchbook_understood');
  }

  const nextTrust = clamp(state.trust + trustDelta);
  const nextStress = clamp(state.stress + stressDelta);
  const innerWorldUnlocked = context.knowledge >= state.knowledgeRequired && nextTrust >= state.trustRequired;
  let ending: NpcEnding = 'none';

  if (nextStress >= 100) {
    ending = 'failed';
    flags.push('bridge_artist_failed');
    reason = '他的 Stress 已達臨界值。對話中斷，Ghost 記錄生成。';
  }

  if (innerWorldUnlocked) {
    flags.push('inner_world_unlocked');
  }

  return {
    trustDelta,
    stressDelta,
    reason,
    flags,
    innerWorldUnlocked,
    ending,
    safetyRedirect,
  };
}

export function applyDialogueEvaluation(
  state: NpcRuntimeState,
  evaluation: DialogueEvaluationResult,
): NpcRuntimeState {
  if (state.ending !== 'none') return state;

  return {
    ...state,
    trust: clamp(state.trust + evaluation.trustDelta),
    stress: clamp(state.stress + evaluation.stressDelta),
    innerWorldUnlocked: state.innerWorldUnlocked || evaluation.innerWorldUnlocked,
    ending: evaluation.ending === 'failed' ? 'failed' : state.ending,
    flags: mergeFlags(state.flags, evaluation.flags),
  };
}

export function markNpcSuccess(state: NpcRuntimeState): NpcRuntimeState {
  return {
    ...state,
    trust: Math.max(state.trust, state.trustRequired),
    stress: Math.min(state.stress, 35),
    innerWorldUnlocked: true,
    ending: 'success',
    flags: mergeFlags(state.flags, ['bridge_artist_repaired']),
  };
}

export function markNpcFailed(state: NpcRuntimeState): NpcRuntimeState {
  return {
    ...state,
    stress: 100,
    ending: 'failed',
    flags: mergeFlags(state.flags, ['bridge_artist_failed']),
  };
}
