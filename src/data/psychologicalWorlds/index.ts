// ============================================================
// 心理世界通用 API
// getAllPsychLayers(npcId) — 接收 npcId，返回對應世界層列表
// ============================================================

import type { NpcId } from '../verticalSlice';
import { ALL_PSYCH_LAYERS } from './bridgePainter/index';
import { victorPsychLayers } from './victor/index';
import type { PsychLayerData } from './bridgePainter/index';

// 向後相容：保留 ALL_PSYCH_LAYERS re-export
export { ALL_PSYCH_LAYERS } from './bridgePainter/index';
export type {
  PsychLayerId,
  PsychLayerNumber,
  LayerColorScheme,
  ReflectionChoice,
  PsychInteractable,
  GalleryInteractable,
  PsychLayerData,
  UnderstandingReward,
} from './bridgePainter/index';
export {
  getPsychLayer,
  getUnderstandingReward,
  getInteractable,
  getLayerInteractables,
} from './bridgePainter/index';

const psychWorldRegistry: Record<NpcId, PsychLayerData[]> = {
  bridge_artist: ALL_PSYCH_LAYERS,
  victor: victorPsychLayers,
};

/**
 * 根據 npcId 取得對應的心理世界層列表
 * 向後相容：保留同名 ALL_PSYCH_LAYERS export（bridge_artist 專用）
 */
export function getAllPsychLayers(npcId: NpcId): PsychLayerData[] {
  return psychWorldRegistry[npcId] ?? [];
}

/**
 * 根據 npcId + 層級編號取得單層資料
 */
export function getPsychLayerForNpc(npcId: NpcId, layerNumber: number): PsychLayerData | undefined {
  return getAllPsychLayers(npcId).find(l => l.layerNumber === layerNumber);
}
