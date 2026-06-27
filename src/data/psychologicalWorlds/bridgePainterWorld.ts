// ============================================================
// 向後相容：bridgePainterWorld.ts → bridgePainter/index.ts
// 所有實際資料已遷移至 psychologicalWorlds/bridgePainter/index.ts
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
