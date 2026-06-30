// ============================================================
// verticalSlice.ts — 保留類型定義 + 向後相容 re-export
// 線索資料已遷移至 src/data/clues/bridgeArtistClues.ts
// 地點資料已遷移至 src/data/locations.ts
// ============================================================

export type NpcId = 'bridge_artist' | 'victor';

// ---- 向後相容 re-export（避免 import 路徑破壞舊引用） ----

export type { LocationId, LocationData } from './locations';
export { locations, locationOrder } from './locations';

import type { ClueDefinition } from './npcs/types';
import { bridgeArtistClueOrder } from './npcs/bridgePainter';

export type { BridgeArtistClueId as ClueId } from './npcs/bridgePainter';
export { bridgeArtistClues, bridgeArtistClueOrder as clueOrder } from './npcs/bridgePainter';

// ClueData 向後相容（使用 ClueDefinition 的 alias）
export type { ClueDefinition as ClueData } from './npcs/types';
