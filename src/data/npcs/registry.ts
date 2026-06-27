// ============================================================
// NPC 註冊中心
// 新增 NPC 只需在此加一行 + 建立對應資料夾
// ============================================================

import type { NpcId } from '../verticalSlice';
import type { NpcDefinition } from './types';
import { bridgePainterDefinition } from './bridgePainter';
import { victorDefinition } from './victor/index';

// ---- 登記表 ----

const npcRegistry: Record<NpcId, NpcDefinition> = {
  bridge_artist: bridgePainterDefinition,
  victor: victorDefinition,
};

// ---- 通用入口 ----

/**
 * 根據 npcId 取得 NpcDefinition
 * @throws 若 npcId 未登記則 throw（開發時早發現錯誤）
 */
export function getNpcDefinition(id: NpcId): NpcDefinition {
  const def = npcRegistry[id];
  if (!def) throw new Error(`[NPC Registry] Unknown npcId: "${id}"`);
  return def;
}

/**
 * 列出所有已登記的 NPC ID
 */
export function listNpcs(): NpcId[] {
  return Object.keys(npcRegistry) as NpcId[];
}

export { npcRegistry };
