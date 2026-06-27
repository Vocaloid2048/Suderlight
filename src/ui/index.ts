export { default as AftermathReport } from './AftermathReport';
// NpcInnerWorld 是新的通用版本（接受 npcId prop）
export { default as NpcInnerWorld } from './NpcInnerWorld';
// BridgePainterInnerWorld 作為向後相容 alias
export { default as BridgePainterInnerWorld } from './BridgePainterInnerWorld';
export { default as EmotionDictionaryPage } from './EmotionDictionaryPage';
export { default as InnerWorldAbyss } from './InnerWorldAbyss';
export { default as OuterWorldConversation } from './OuterWorldConversation';
export { default as OuterWorldExplorer } from './OuterWorldExplorer';
export { default as SelfReconciliationPortal } from './SelfReconciliationPortal';
export { default as SubconsciousTavern } from './SubconsciousTavern';
export { default as TitlePortal } from './TitlePortal';

// Devtools 已整合到 devtools/DevtoolsPanel，以下保留向後相容
// （ChapterSelectorModal 由 DevtoolsPanel 內部 tab 管理，不再作為獨立 export）
export { default as ChapterSelectorModal } from './ChapterSelectorModal';
export { default as NarrativePlaytestDashboard } from './NarrativePlaytestDashboard';
export { default as NarrativeDebugOverlay } from './NarrativeDebugOverlay';
