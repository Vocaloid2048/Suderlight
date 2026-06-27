// ============================================================
// 天橋畫家心理世界資料
// 從 bridgePainterWorld.ts 重命名；保留所有 export 名稱不變
// ============================================================

export type {
  PsychLayerId,
  PsychLayerNumber,
  LayerColorScheme,
  ReflectionChoice,
  PsychInteractable,
  GalleryInteractable,
  PsychLayerData,
  UnderstandingReward,
} from './bridgePainterWorld';

export {
  gloryGalleryLayer,
  accidentSceneLayer,
  fadedStudioLayer,
  blankFrameLayer,
  ALL_PSYCH_LAYERS,
  getPsychLayer,
  getUnderstandingReward,
  getInteractable,
  getLayerInteractables,
} from './bridgePainterWorld';
