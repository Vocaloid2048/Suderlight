// ============================================================
// 通用對話模擬器
// registerDialogueSimulator / simulateNpcReply
// ============================================================

import type { NpcId } from '../data/verticalSlice';
import type { SimulatedReply, DialogueSimulatorFn } from '../data/npcs/types';
import { getNpcDefinition } from '../data/npcs/registry';

const simulatorRegistry: Partial<Record<NpcId, DialogueSimulatorFn>> = {};

/**
 * 登記 NPC 對話模擬函式（通常由 NPC 資料夾自行呼叫）
 * 登記後 simulateNpcReply 會優先使用已登記的函式；
 * 若未登記則從 npcRegistry 讀取
 */
export function registerDialogueSimulator(npcId: NpcId, fn: DialogueSimulatorFn) {
  simulatorRegistry[npcId] = fn;
}

/**
 * 通用離線對話模擬入口
 */
export function simulateNpcReply(
  npcId: NpcId,
  playerInput: string,
  inventory: string[],
  history: Array<{ role: 'player' | 'npc' | 'system'; content: string }>,
  depth: number,
): SimulatedReply {
  // 優先使用已登記的模擬函式
  const fn = simulatorRegistry[npcId] ?? getNpcDefinition(npcId).simulateReply;
  return fn({ playerInput, inventory, history, depth });
}
