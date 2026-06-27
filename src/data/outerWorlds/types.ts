// ============================================================
// OuterWorld 類型定義
// 每個 NPC 的表世界地圖資料由此結構驅動
// ============================================================

import type { Point } from './bridgePainter/types';

export type { Point };

export type WindowDef = {
  side: 'left' | 'right';
  x: number;
  y: number;
  w: number;
  h: number;
};

export type Building = {
  id: string;
  name: string;
  locationId: string;
  pos: Point;
  size: { x: number; y: number };
  tall: number;
  baseColor: string;
  windows?: WindowDef[];
  decorations?: (isRepaired: boolean) => React.ReactNode;
};

export type RoadDef = Point[][];

export type Cliff = {
  boundingBox: { minX: number; maxX: number; minY: number; maxY: number };
  elevation: number;
  isStairs?: boolean;
  stairsRange?: { startY: number; endY: number; minX: number; maxX: number };
};

export type CollisionZone = {
  id: string;
  /** 可通行多邊形：玩家只能在這些區域內移動 */
  walkableRegions: Array<{ minX: number; maxX: number; minY: number; maxY: number }>;
  maxX: number;
  maxY: number;
};

export type EntityTemplate = {
  id: string;
  label: string;
  type: 'npc' | 'clue' | 'portal';
  pos: Point;
  color: string;
  icon: string;
  /** 顯示條件：根據 save / npcState 判斷 */
  visible?: (ctx: { npcEnding: string; npcInnerWorldUnlocked: boolean }) => boolean;
};

export type LocationDisplay = {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  ambient: string;
};

export type ElevationFn = (pos: Point) => number;

export type OuterWorldDefinition = {
  mapWidth: number;
  mapHeight: number;
  tileW: number;
  tileH: number;
  originX: number;
  originY: number;
  buildings: Building[];
  roadDefs: (locationId: string) => RoadDef;
  collisionZones: Record<string, CollisionZone>;
  getEntities: (ctx: {
    npcEnding: string;
    npcInnerWorldUnlocked: boolean;
    collectedClues: string[];
    locationId: string;
  }) => EntityTemplate[];
  locationDisplay: LocationDisplay;
  locationOffsets: Record<string, { x: number; y: number }>;
  getElevation: (pos: Point) => number;
  getMaxX: (locationId: string) => number;
  getMaxY: (locationId: string) => number;
  playerSpeed: number;
  /**
   * 回傳互動內容（取代硬編碼 modal）
   * 若回傳 null 則由泛用 modal 處理
   */
  getInteraction?: (
    entityId: string,
    ctx: {
      npcEnding: string;
      npcInnerWorldUnlocked: boolean;
      npcFlags: string[];
      collectedClues: string[];
      onOpenConversation: () => void;
      onEnterInnerWorld: () => void;
      onOpenArcFailure: () => void;
      onOpenReport: () => void;
    },
  ) => string | { title: string; content: string; actions?: Array<{ label: string; tone?: string; onClick: () => void }> } | null;
};
