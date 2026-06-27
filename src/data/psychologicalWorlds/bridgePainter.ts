// ============================================================
// 天橋畫家心理世界資料（re-export）
// 實際資料位於 bridgePainter/index.ts
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
} from './bridgePainter/index';

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
} from './bridgePainter/index';
