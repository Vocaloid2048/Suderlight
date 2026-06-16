import { MouseEvent, useEffect, useMemo, useRef, useState } from 'react';
import { GlimmerButton, GlassPanel } from '../components';
import { bridgeArtistClues, clueOrder, locationOrder, locations, type ClueId, type LocationId } from '../data/verticalSlice';
import type { CollectClueResult } from '../store/gameStore';
import type { GameSave } from '../systems/saveSystem';

type Point = { x: number; y: number };
type EntityId = 'painter' | 'gallery_door' | ClueId;
type ModalAction = { label: string; tone?: 'primary' | 'danger' | 'ghost'; onClick: () => void };
type ModalState = { title: string; content: string; actions?: ModalAction[] } | null;

type Entity = {
  id: EntityId;
  label: string;
  type: 'npc' | 'clue';
  pos: Point;
  color: string;
  icon: string;
};

type OuterWorldExplorerProps = {
  save: GameSave;
  collectClue: (clueId: ClueId) => CollectClueResult;
  setCurrentLocation: (locationId: LocationId) => void;
  resetSave: () => void;
  onOpenConversation: () => void;
  onOpenDictionary: () => void;
  onOpenTavern: () => void;
  onOpenReport: () => void;
};

const MAP_WIDTH = 2400;
const MAP_HEIGHT = 1600;
const TILE_W = 96;
const TILE_H = 48;
const ORIGIN_X = MAP_WIDTH / 2;
const ORIGIN_Y = 160;
const PLAYER_SPEED = 0.055;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function isoToScreen(pos: Point) {
  return {
    left: ORIGIN_X + (pos.x - pos.y) * (TILE_W / 2),
    top: ORIGIN_Y + (pos.x + pos.y) * (TILE_H / 2),
  };
}

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clueName(clueId: ClueId) {
  return bridgeArtistClues[clueId].label;
}

// ==================== 地圖建築與道路建設 ====================

type WindowDef = {
  side: 'left' | 'right';
  x: number; // 比例，0 到 1
  y: number; // 比例，0 到 1
  w: number; // 寬度比例
  h: number; // 高度比例
};

type Building = {
  id: string;
  name: string;
  locationId: LocationId;
  pos: Point;
  size: { x: number; y: number }; // 網格占地大小（用於阻擋）
  tall: number; // 像素高度
  baseColor: string; // 修復後的主色調
  windows?: WindowDef[]; // 窗戶排布
  decorations?: (isRepaired: boolean) => React.ReactNode; // 額外裝飾
};

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function adjustColorBrightness(hex: string, percent: number) {
  const num = parseInt(hex.replace("#", ""), 16);
  const amt = Math.round(2.55 * percent);
  const R = (num >> 16) + amt;
  const G = (num >> 8 & 0x00ff) + amt;
  const B = (num & 0x0000ff) + amt;
  
  const clampColor = (val: number) => Math.max(0, Math.min(255, val));
  const rHex = clampColor(R).toString(16).padStart(2, '0');
  const gHex = clampColor(G).toString(16).padStart(2, '0');
  const bHex = clampColor(B).toString(16).padStart(2, '0');
  
  return `#${rHex}${gHex}${bHex}`;
}

function getWindowPoints(
  win: WindowDef,
  s1: { left: number; top: number },
  s2: { left: number; top: number },
  s3: { left: number; top: number },
  t1: { left: number; top: number },
  t2: { left: number; top: number },
  t3: { left: number; top: number }
) {
  const getPt = (rX: number, rY: number) => {
    if (win.side === 'left') {
      // 左立面：s3 -> s2, t3 -> t2
      const bPt = { left: lerp(s3.left, s2.left, rX), top: lerp(s3.top, s2.top, rX) };
      const tPt = { left: lerp(t3.left, t2.left, rX), top: lerp(t3.top, t2.top, rX) };
      return { left: lerp(bPt.left, tPt.left, rY), top: lerp(bPt.top, tPt.top, rY) };
    } else {
      // 右立面：s2 -> s1, t2 -> t1
      const bPt = { left: lerp(s2.left, s1.left, rX), top: lerp(s2.top, s1.top, rX) };
      const tPt = { left: lerp(t2.left, t1.left, rX), top: lerp(t2.top, t1.top, rX) };
      return { left: lerp(bPt.left, tPt.left, rY), top: lerp(bPt.top, tPt.top, rY) };
    }
  };

  const p00 = getPt(win.x, win.y);
  const p10 = getPt(win.x + win.w, win.y);
  const p11 = getPt(win.x + win.w, win.y + win.h);
  const p01 = getPt(win.x, win.y + win.h);

  return `${p00.left},${p00.top} ${p10.left},${p10.top} ${p11.left},${p11.top} ${p01.left},${p01.top}`;
}

const buildings: Building[] = [
  // 1. 天橋場景：失色畫廊
  {
    id: 'gallery',
    name: '失色畫廊',
    locationId: 'skybridge',
    pos: { x: 17, y: 1 },
    size: { x: 4, y: 3 },
    tall: 260,
    baseColor: '#ec407a', // 洋紅色
    windows: [
      { side: 'left', x: 0.2, y: 0.3, w: 0.2, h: 0.2 },
      { side: 'left', x: 0.6, y: 0.3, w: 0.2, h: 0.2 },
      { side: 'left', x: 0.2, y: 0.6, w: 0.2, h: 0.2 },
      { side: 'left', x: 0.6, y: 0.6, w: 0.2, h: 0.2 },
      { side: 'right', x: 0.3, y: 0.3, w: 0.4, h: 0.4 },
    ],
  },
  // 2. 報攤場景：木質報攤
  {
    id: 'news_cabin',
    name: '拾光報攤',
    locationId: 'newsstand',
    pos: { x: 4, y: 11 },
    size: { x: 3, y: 3 },
    tall: 130,
    baseColor: '#d84315', // 溫暖木黃橙
    windows: [
      { side: 'right', x: 0.2, y: 0.3, w: 0.6, h: 0.4 },
    ],
    decorations: (isRepaired: boolean) => (
      <div style={{
        position: 'absolute',
        left: isoToScreen({ x: 5.5, y: 12.5 }).left,
        top: isoToScreen({ x: 5.5, y: 12.5 }).top - 12,
        width: 48,
        height: 18,
        background: isRepaired ? 'linear-gradient(90deg, #ffb300, #ff8f00)' : '#444',
        border: '1px solid #ffe082',
        borderRadius: 4,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontSize: 9,
        fontWeight: 'bold',
        boxShadow: isRepaired ? '0 0 12px #ff8f00' : 'none',
        transform: 'skewY(-15deg)',
        transition: 'all 1.5s',
        pointerEvents: 'none'
      }}>
        OPEN
      </div>
    )
  },
  // 3. 公園場景：林蔭涼亭
  {
    id: 'pavilion',
    name: '林蔭涼亭',
    locationId: 'park',
    pos: { x: 11, y: 6 },
    size: { x: 3, y: 3 },
    tall: 150,
    baseColor: '#2e7d32', // 春天嫩綠
    windows: [
      { side: 'left', x: 0.25, y: 0.2, w: 0.15, h: 0.6 },
      { side: 'left', x: 0.6, y: 0.2, w: 0.15, h: 0.6 },
      { side: 'right', x: 0.25, y: 0.2, w: 0.15, h: 0.6 },
      { side: 'right', x: 0.6, y: 0.2, w: 0.15, h: 0.6 },
    ],
  },
  // 4. 廢棄畫室：舊公寓畫室大樓
  {
    id: 'studio_building',
    name: '深空舊畫室',
    locationId: 'abandoned_studio',
    pos: { x: 15, y: 3 },
    size: { x: 4, y: 4 },
    tall: 280,
    baseColor: '#00838f', // 藍綠色
    windows: [
      { side: 'left', x: 0.15, y: 0.2, w: 0.15, h: 0.15 },
      { side: 'left', x: 0.4, y: 0.2, w: 0.15, h: 0.15 },
      { side: 'left', x: 0.65, y: 0.2, w: 0.15, h: 0.15 },
      { side: 'left', x: 0.15, y: 0.5, w: 0.15, h: 0.15 },
      { side: 'left', x: 0.4, y: 0.5, w: 0.15, h: 0.15 },
      { side: 'left', x: 0.65, y: 0.5, w: 0.15, h: 0.15 },
      { side: 'right', x: 0.2, y: 0.3, w: 0.2, h: 0.3 },
      { side: 'right', x: 0.6, y: 0.3, w: 0.2, h: 0.3 },
    ],
  }
];

function IsometricBuilding({ building, isRepaired }: { building: Building; isRepaired: boolean }) {
  const p0 = { x: building.pos.x, y: building.pos.y };
  const p1 = { x: building.pos.x + building.size.x, y: building.pos.y };
  const p2 = { x: building.pos.x + building.size.x, y: building.pos.y + building.size.y };
  const p3 = { x: building.pos.x, y: building.pos.y + building.size.y };

  const s0 = isoToScreen(p0);
  const s1 = isoToScreen(p1);
  const s2 = isoToScreen(p2);
  const s3 = isoToScreen(p3);

  const t0 = { left: s0.left, top: s0.top - building.tall };
  const t1 = { left: s1.left, top: s1.top - building.tall };
  const t2 = { left: s2.left, top: s2.top - building.tall };
  const t3 = { left: s3.left, top: s3.top - building.tall };

  const topFace = `${t0.left},${t0.top} ${t1.left},${t1.top} ${t2.left},${t2.top} ${t3.left},${t3.top}`;
  const leftFace = `${s3.left},${s3.top} ${s2.left},${s2.top} ${t2.left},${t2.top} ${t3.left},${t3.top}`;
  const rightFace = `${s2.left},${s2.top} ${s1.left},${s1.top} ${t1.left},${t1.top} ${t2.left},${t2.top}`;

  const color = building.baseColor;
  const mainColor = isRepaired ? color : '#3a3a3a';
  const lightColor = isRepaired ? adjustColorBrightness(color, 25) : '#5a5a5a';
  const darkColor = isRepaired ? adjustColorBrightness(color, -25) : '#222222';

  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: MAP_WIDTH, height: MAP_HEIGHT, pointerEvents: 'none', zIndex: Math.round(s2.top) }}>
      <svg width={MAP_WIDTH} height={MAP_HEIGHT} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
        <polygon
          points={`${s0.left},${s0.top} ${s1.left},${s1.top} ${s2.left},${s2.top} ${s3.left},${s3.top}`}
          fill="rgba(0, 0, 0, 0.45)"
          filter="blur(8px)"
        />

        <polygon
          points={leftFace}
          fill={mainColor}
          stroke={isRepaired ? adjustColorBrightness(color, -10) : '#1a1a1a'}
          strokeWidth="1.5"
          style={{ transition: 'fill 1.5s ease, stroke 1.5s ease' }}
        />

        <polygon
          points={rightFace}
          fill={darkColor}
          stroke={isRepaired ? adjustColorBrightness(color, -30) : '#121212'}
          strokeWidth="1.5"
          style={{ transition: 'fill 1.5s ease, stroke 1.5s ease' }}
        />

        <polygon
          points={topFace}
          fill={lightColor}
          stroke={isRepaired ? adjustColorBrightness(color, 10) : '#2a2a2a'}
          strokeWidth="1.5"
          style={{ transition: 'fill 1.5s ease, stroke 1.5s ease' }}
        />

        {building.windows?.map((win, idx) => {
          const points = getWindowPoints(win, s1, s2, s3, t1, t2, t3);
          const winColor = isRepaired ? '#ffd54f' : 'rgba(255, 255, 255, 0.05)';
          return (
            <polygon
              key={idx}
              points={points}
              fill={winColor}
              style={{
                transition: 'fill 1.5s ease',
                filter: isRepaired ? 'drop-shadow(0px 0px 4px rgba(255,213,79,0.85))' : 'none'
              }}
            />
          );
        })}
      </svg>
      <div style={{
        position: 'absolute',
        left: s2.left,
        top: s0.top - building.tall - 20,
        transform: 'translateX(-50%)',
        color: isRepaired ? '#fff' : '#888',
        fontSize: 11,
        padding: '2px 6px',
        background: isRepaired ? 'rgba(30,40,50,0.85)' : 'rgba(0,0,0,0.65)',
        border: `1px solid ${isRepaired ? '#ffe082' : '#444'}`,
        borderRadius: 4,
        boxShadow: isRepaired ? '0 0 10px rgba(255,224,130,0.3)' : 'none',
        pointerEvents: 'auto',
        userSelect: 'none',
        transition: 'color 1.5s, border-color 1.5s, background 1.5s, box-shadow 1.5s'
      }}>
        {building.name}
      </div>
      {building.decorations?.(isRepaired)}
    </div>
  );
}

function IsometricRoads({ locationId, isRepaired }: { locationId: LocationId; isRepaired: boolean }) {
  const roadDefs = useMemo<Point[][]>(() => {
    if (locationId === 'skybridge') {
      return [
        // 區域 A：天橋橫向大路 (左端從 x = 3 開始，不超地圖邊界，右端延伸至 19 完美相交)
        [{ x: 3, y: 8 }, { x: 19, y: 8 }, { x: 19, y: 10 }, { x: 3, y: 10 }],
        // 區域 B：通往畫廊的縱向通道 (L 型的縱向，與畫廊大樓底部完全貼齊對齊，x: 17.0~19.0, y: 4.0~8.0)
        [{ x: 17, y: 4 }, { x: 19, y: 4 }, { x: 19, y: 8 }, { x: 17, y: 8 }]
      ];
    } else if (locationId === 'newsstand') {
      return [
        [{ x: 1, y: 10 }, { x: 22, y: 10 }, { x: 22, y: 12 }, { x: 1, y: 12 }],
        [{ x: 4, y: 9 }, { x: 10, y: 9 }, { x: 10, y: 13 }, { x: 4, y: 13 }]
      ];
    } else if (locationId === 'park') {
      return [
        [{ x: 8, y: 10 }, { x: 16, y: 10 }, { x: 16, y: 13 }, { x: 8, y: 13 }],
        [{ x: 11, y: 6 }, { x: 14, y: 6 }, { x: 14, y: 11 }, { x: 11, y: 11 }]
      ];
    } else if (locationId === 'abandoned_studio') {
      return [
        [{ x: 14, y: 3 }, { x: 17, y: 3 }, { x: 17, y: 8 }, { x: 14, y: 8 }],
        [{ x: 4, y: 7 }, { x: 22, y: 7 }, { x: 22, y: 10 }, { x: 4, y: 10 }]
      ];
    }
    return [];
  }, [locationId]);

  const roadFill = isRepaired 
    ? 'rgba(45, 64, 89, 0.45)' 
    : 'rgba(30, 30, 30, 0.65)';

  const roadStroke = isRepaired
    ? 'rgba(255, 224, 130, 0.35)' 
    : 'rgba(255, 255, 255, 0.06)';

  // 天橋立體欄杆與橋墩渲染 (僅限天橋場景)
  const bridgeDetails = useMemo(() => {
    if (locationId !== 'skybridge') return null;

    // 橋墩坐標 (横段 y = 10 上的 4 個，以及縱向通道的左側 17.0, 6.0 和右側 19.0, 6.0，共 6 個橋墩)
    const piers = [
      isoToScreen({ x: 3.5, y: 10 }),
      isoToScreen({ x: 7.5, y: 10 }),
      isoToScreen({ x: 11.5, y: 10 }),
      isoToScreen({ x: 15.5, y: 10 }),
      isoToScreen({ x: 17.0, y: 6.0 }), // 縱段左側懸空支撐
      isoToScreen({ x: 19.0, y: 6.0 })  // 縱段右側懸空支撐
    ];

    // 四組欄杆立柱和扶手 (包覆天橋全線外圍懸空邊緣)
    const railings: Array<Array<{ p1: { left: number; top: number }; p2: { left: number; top: number } }>> = [];

    // 1. 横段下边缘 y = 10 (x 从 3.0 到 17.0)
    const railingA: Array<{ p1: { left: number; top: number }; p2: { left: number; top: number } }> = [];
    for (let x = 3.0; x <= 17.0; x += 0.8) {
      const p = isoToScreen({ x, y: 10 });
      railingA.push({ p1: p, p2: { left: p.left, top: p.top - 12 } });
    }
    railings.push(railingA);

    // 2. 横段上边缘 y = 8 (x 从 3.0 到 17.0)
    const railingB: Array<{ p1: { left: number; top: number }; p2: { left: number; top: number } }> = [];
    for (let x = 3.0; x <= 17.0; x += 0.8) {
      const p = isoToScreen({ x, y: 8 });
      railingB.push({ p1: p, p2: { left: p.left, top: p.top - 12 } });
    }
    railings.push(railingB);

    // 3. 纵段左侧 x = 17 (y 从 4.0 到 8.0)
    const railingC: Array<{ p1: { left: number; top: number }; p2: { left: number; top: number } }> = [];
    for (let y = 4.0; y <= 8.0; y += 0.8) {
      const p = isoToScreen({ x: 17, y });
      railingC.push({ p1: p, p2: { left: p.left, top: p.top - 12 } });
    }
    railings.push(railingC);

    // 4. 纵段右侧 x = 19 (y 从 4.0 到 8.0)
    const railingD: Array<{ p1: { left: number; top: number }; p2: { left: number; top: number } }> = [];
    for (let y = 4.0; y <= 8.0; y += 0.8) {
      const p = isoToScreen({ x: 19, y });
      railingD.push({ p1: p, p2: { left: p.left, top: p.top - 12 } });
    }
    railings.push(railingD);

    return { piers, railings };
  }, [locationId]);

  return (
    <svg width={MAP_WIDTH} height={MAP_HEIGHT} style={{ position: 'absolute', left: 0, top: 0, zIndex: 1, pointerEvents: 'none', overflow: 'visible' }}>
      
      {/* 1. 渲染支撐橋墩（Bridge Piers） */}
      {locationId === 'skybridge' && bridgeDetails && (
        <g>
          {bridgeDetails.piers.map((pier, idx) => (
            <g key={idx}>
              {/* 橋墩柱體 */}
              <rect
                x={pier.left - 4}
                y={pier.top}
                width={8}
                height={26}
                rx={2}
                fill={isRepaired ? '#2c3540' : '#1c1c1c'}
                stroke={isRepaired ? 'rgba(255,224,130,0.1)' : '#111'}
                strokeWidth="1"
                style={{ transition: 'fill 1.5s ease' }}
              />
              {/* 橋墩底座 */}
              <rect
                x={pier.left - 8}
                y={pier.top + 24}
                width={16}
                height={5}
                rx={1}
                fill={isRepaired ? '#1e2430' : '#121212'}
                style={{ transition: 'fill 1.5s ease' }}
              />
            </g>
          ))}
        </g>
      )}

      {/* 2. 渲染平面路面多邊形 */}
      {roadDefs.map((points, idx) => {
        const screenPts = points.map(pt => isoToScreen(pt));
        const ptsStr = screenPts.map(p => `${p.left},${p.top}`).join(' ');

        return (
          <g key={idx}>
            {isRepaired && (
              <polygon
                points={ptsStr}
                fill="none"
                stroke="rgba(255, 224, 130, 0.12)"
                strokeWidth="12"
                style={{ filter: 'blur(4px)', transition: 'stroke 1.5s ease' }}
              />
            )}
            <polygon
              points={ptsStr}
              fill={roadFill}
              stroke={roadStroke}
              strokeWidth="2.5"
              style={{ transition: 'fill 1.5s ease, stroke 1.5s ease' }}
            />
          </g>
        );
      })}

      {/* 3. 渲染全覆蓋小欄杆（Railings） */}
      {locationId === 'skybridge' && bridgeDetails && (
        <g>
          {bridgeDetails.railings.map((railingGroup, gIdx) => (
            <g key={gIdx}>
              {/* 渲染立柱 */}
              {railingGroup.map((line, idx) => (
                <line
                  key={idx}
                  x1={line.p1.left}
                  y1={line.p1.top}
                  x2={line.p2.left}
                  y2={line.p2.top}
                  stroke={isRepaired ? 'rgba(255, 224, 130, 0.45)' : 'rgba(255, 255, 255, 0.15)'}
                  strokeWidth="1"
                  style={{ transition: 'stroke 1.5s ease' }}
                />
              ))}
              {/* 渲染手扶橫梁 */}
              {railingGroup.length > 0 && (
                <path
                  d={`M ${railingGroup[0].p2.left} ${railingGroup[0].p2.top} ` +
                     railingGroup.slice(1).map(l => `L ${l.p2.left} ${l.p2.top}`).join(' ')}
                  fill="none"
                  stroke={isRepaired ? 'rgba(255, 224, 130, 0.65)' : 'rgba(255, 255, 255, 0.25)'}
                  strokeWidth="1.5"
                  style={{ transition: 'stroke 1.5s ease' }}
                />
              )}
            </g>
          ))}
        </g>
      )}
    </svg>
  );
}

export default function OuterWorldExplorer({
  save,
  collectClue,
  setCurrentLocation,
  resetSave,
  onOpenConversation,
  onOpenDictionary,
  onOpenTavern,
  onOpenReport,
}: OuterWorldExplorerProps) {
  const [playerPos, setPlayerPos] = useState<Point>(locations[save.currentLocation].spawn);
  const [isDragging, setIsDragging] = useState(false);
  const [mapPos, setMapPos] = useState({ x: -320, y: -160 });
  const [modal, setModal] = useState<ModalState>(null);
  const [ghostFlash, setGhostFlash] = useState<string | null>(null);
  const [discoveryNote, setDiscoveryNote] = useState<string | null>(null);
  const dragStart = useRef({ x: 0, y: 0 });
  const hasMoved = useRef(false);
  const keys = useRef(new Set<string>());

  const currentLocation = locations[save.currentLocation];
  const bridgeArtist = save.npcs.bridge_artist;

  const entities = useMemo<Entity[]>(() => {
    const list: Entity[] = [];

    if (save.currentLocation === 'skybridge') {
      list.push({
        id: 'painter',
        label: '天橋畫家',
        type: 'npc',
        pos: { x: 13, y: 9 },
        color: bridgeArtist.ending === 'failed' ? '#a55' : '#ffaa33',
        icon: bridgeArtist.ending === 'success' ? '光' : '畫',
      });

      list.push({
        id: 'gallery_door',
        label: '畫廊大門',
        type: 'clue',
        pos: { x: 18.0, y: 4.5 },
        color: '#ec407a',
        icon: '門',
      });
    }

    clueOrder.forEach(clueId => {
      const clue = bridgeArtistClues[clueId];
      if (clue.locationId === save.currentLocation && !save.collectedClues.includes(clueId)) {
        list.push({
          id: clue.id,
          label: clue.label,
          type: 'clue',
          pos: clue.pos,
          color: clue.color,
          icon: clue.icon,
        });
      }
    });

    return list;
  }, [bridgeArtist.ending, save.collectedClues, save.currentLocation]);

  const nearbyEntity = entities.find(entity => distance(entity.pos, playerPos) <= 1.35);

  const focusCameraOnPlayer = (pos: Point) => {
    const screen = isoToScreen(pos);
    const targetX = window.innerWidth / 2 - screen.left;
    const targetY = window.innerHeight / 2 - screen.top + 80;

    setMapPos({
      x: clamp(targetX, window.innerWidth - MAP_WIDTH, 0),
      y: clamp(targetY, window.innerHeight - MAP_HEIGHT, 0),
    });
  };

  const maybeTriggerGhost = () => {
    if (save.ghosts.length === 0 || Math.random() >= 0.1) return;
    const ghost = save.ghosts[0];
    setGhostFlash(ghost.memoryText);
    window.setTimeout(() => setGhostFlash(null), 1800);
  };

  const openFailureModal = () => {
    setModal({
      title: '失敗結局：空白被關上',
      content: '畫家最後看了你一眼。\n\n「連這最後的空白，你都不肯留給我嗎？」\n\n他收起畫布，走進天橋最暗的雨裡。Ghost System 已記錄：bridge_artist failed。',
      actions: [{ label: '查看餘波匯報', tone: 'primary', onClick: onOpenReport }],
    });
  };

  const openSuccessModal = () => {
    setModal({
      title: '成功結局：雨聲仍在',
      content: '他沒有重新看見色彩，也沒有立刻變好。\n\n但他終於放下畫筆，坐在失色畫廊的地上，聽見雨聲從遠處回來。\n\n「原來……不畫畫的時候，我也還在。」',
      actions: [{ label: '查看餘波匯報', tone: 'primary', onClick: onOpenReport }],
    });
  };

  const interact = (targetId: EntityId) => {
    if (targetId === 'gallery_door') {
      setModal({
        title: '進入建築物',
        content: `你站在失色畫廊沉重的雕花橡木門前。\n\n${bridgeArtist.ending === 'success' ? '在被開導後，這裡已經泛起了溫暖的色彩，門縫下透出令人安心的金黃色光芒。' : '這扇門被冰冷沉悶的死灰包圍，彷彿封鎖了一段不願示人的過往。'}\n\n是否推開大門進入探索？`,
        actions: [
          {
            label: '推門進入',
            tone: 'primary',
            onClick: () => {
              setModal({
                title: '失色畫廊 - 內部幻境',
                content: `【失色畫廊 · 內部】\n\n你推開了大門。此時畫廊內部呈現出一個宏大的心智空間，牆壁上掛滿了未填滿的畫布。${bridgeArtist.ending === 'success' ? '\n\n【治癒共鳴】高大的採光窗下，一道明亮柔和的暖光斜射在地板上。雨聲此時在畫廊內迴響，空洞的灰色畫布上慢慢浮現出春天的線條與輪廓，那是重生的起點。' : '\n\n【失色迴廊】四下寂靜無聲，只有陰暗的灰階霧氣漂浮。所有的作品都沒有顏色，像一座封存了辨色力與希望的宏大墓碑，這就是他封閉的內心深處。'}`,
                actions: [{ label: '回到外表世界', onClick: () => setModal(null) }]
              });
            }
          },
          { label: '留在外面', onClick: () => setModal(null) }
        ]
      });
      return;
    }

    if (targetId === 'painter') {
      if (bridgeArtist.ending === 'failed') {
        openFailureModal();
        return;
      }

      if (bridgeArtist.ending === 'success') {
        openSuccessModal();
        return;
      }

      onOpenConversation();
      return;
    }

    const result = collectClue(targetId);
    const clue = bridgeArtistClues[targetId];
    maybeTriggerGhost();

    setModal({
      title: `獲得線索：${result.label}`,
      content: `${clue.content}\n\n情緒詞典浮現：${clue.dictionaryHint}${result.unlockedNow ? '\n\n天橋盡頭傳來一聲很輕的門軸聲。某個通往內心深處的入口，似乎鬆動了。' : ''}`,
    });

    if (!result.alreadyCollected) {
      fetch('/api/investigation/collect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clueId: targetId }),
      })
        .then(res => res.json())
        .then(data => {
          if (data.unlockedEntries && data.unlockedEntries.length > 0) {
            fetch('/api/dictionary')
              .then(r => r.json())
              .then(dict => {
                const entry = dict.entries.find((item: { id: string }) => data.unlockedEntries.includes(item.id));
                if (entry) {
                  setDiscoveryNote(entry.name);
                  window.setTimeout(() => setDiscoveryNote(null), 2800);
                }
              });
          }
        })
        .catch(() => {});
    }
  };

  useEffect(() => {
    focusCameraOnPlayer(playerPos);
    const onResize = () => focusCameraOnPlayer(playerPos);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();

      if (key === 'escape' && modal) {
        setModal(null);
        return;
      }

      if (modal) return;

      if (['w', 'a', 's', 'd', 'arrowup', 'arrowleft', 'arrowdown', 'arrowright'].includes(key)) {
        event.preventDefault();
        keys.current.add(key);
      }

      if ((key === 'e' || key === ' ') && nearbyEntity) {
        event.preventDefault();
        interact(nearbyEntity.id);
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      keys.current.delete(event.key.toLowerCase());
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [modal, nearbyEntity]);

  useEffect(() => {
    let frame = 0;

    const tick = () => {
      if (!modal) {
        const pressed = keys.current;
        let dx = 0;
        let dy = 0;

        if (pressed.has('w') || pressed.has('arrowup')) dy -= 1;
        if (pressed.has('s') || pressed.has('arrowdown')) dy += 1;
        if (pressed.has('a') || pressed.has('arrowleft')) dx -= 1;
        if (pressed.has('d') || pressed.has('arrowright')) dx += 1;

        if (dx !== 0 || dy !== 0) {
          const length = Math.hypot(dx, dy);

          setPlayerPos(prev => {
            const stepX = (dx / length) * PLAYER_SPEED;
            const stepY = (dy / length) * PLAYER_SPEED;

            const buffer = 0.4;

            const checkCollision = (pt: Point) => {
              // 1. 地圖邊界碰撞
              if (pt.x < 1 || pt.x > 22 || pt.y < 1 || pt.y > 18) return true;

              // 2. 建築物碰撞檢測
              const hasBuildCollision = buildings.some(b => {
                if (b.locationId !== save.currentLocation) return false;
                return pt.x >= b.pos.x - buffer &&
                       pt.x <= b.pos.x + b.size.x + buffer &&
                       pt.y >= b.pos.y - buffer &&
                       pt.y <= b.pos.y + b.size.y + buffer;
              });

              if (hasBuildCollision) return true;

              // 3. 場景特有邊界阻擋
              if (save.currentLocation === 'skybridge') {
                // 玩家只能在以下兩個平面連通的可行走區域內移動，否則視為撞牆：
                
                // 區域 A：天橋橫向橋面 (左端從 3.0 開始，右端延伸至 19.2，寬度 y: 8.0~10.0)
                const inBridge = pt.x >= 2.8 && pt.x <= 19.2 && pt.y >= 7.8 && pt.y <= 10.2;
                
                // 區域 B：通往右上角畫廊的縱向通道 (與大樓底邊完美貼合，x: 17.0~19.0，y 軸在 3.8 處大樓牆面截斷)
                const inPassage = pt.x >= 16.8 && pt.x <= 19.2 && pt.y >= 3.8 && pt.y <= 8.2;

                if (!inBridge && !inPassage) {
                  return true;
                }
              }

              return false;
            };

            // 滑動碰撞檢測：嘗試同時移動
            const nextBoth = { x: clamp(prev.x + stepX, 1, 22), y: clamp(prev.y + stepY, 1, 18) };
            if (!checkCollision(nextBoth)) {
              focusCameraOnPlayer(nextBoth);
              return nextBoth;
            }

            // 如果兩軸移動撞牆，嘗試僅 X 軸移動（允許沿牆滑動）
            const nextX = { x: clamp(prev.x + stepX, 1, 22), y: prev.y };
            if (!checkCollision(nextX)) {
              focusCameraOnPlayer(nextX);
              return nextX;
            }

            // 如果 X 軸也撞牆，嘗試僅 Y 軸移動
            const nextY = { x: prev.x, y: clamp(prev.y + stepY, 1, 18) };
            if (!checkCollision(nextY)) {
              focusCameraOnPlayer(nextY);
              return nextY;
            }

            // 若都撞牆，留在原地
            return prev;
          });
        }
      }

      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [modal, save.currentLocation]);

  const handleMouseDown = (event: MouseEvent) => {
    setIsDragging(true);
    hasMoved.current = false;
    dragStart.current = { x: event.clientX - mapPos.x, y: event.clientY - mapPos.y };
  };

  const handleMouseMove = (event: MouseEvent) => {
    if (!isDragging) return;

    hasMoved.current = true;
    setMapPos({
      x: clamp(event.clientX - dragStart.current.x, window.innerWidth - MAP_WIDTH, 0),
      y: clamp(event.clientY - dragStart.current.y, window.innerHeight - MAP_HEIGHT, 0),
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleEntityClick = (event: MouseEvent, entity: Entity) => {
    event.stopPropagation();
    if (hasMoved.current) return;

    if (distance(entity.pos, playerPos) > 1.35) {
      setModal({
        title: entity.label,
        content: '距離太遠了。也許你應該親自走近一點，再試著理解他。',
      });
      return;
    }

    interact(entity.id);
  };

  const handleLocationChange = (locationId: LocationId) => {
    setCurrentLocation(locationId);
    const spawn = locations[locationId].spawn;
    setPlayerPos(spawn);
    focusCameraOnPlayer(spawn);
    maybeTriggerGhost();
  };

  const playerScreen = isoToScreen(playerPos);
  const traumaFilter = save.ghosts.length > 0 ? 'grayscale(0.22) contrast(0.95)' : 'none';

  return (
    <div
      style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden', cursor: isDragging ? 'grabbing' : 'grab', background: '#080a0d', filter: traumaFilter }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <GlassPanel title="提燈筆記" variant="dark" style={{ position: 'absolute', top: 20, left: 20, zIndex: 100, width: 270 }} contentStyle={{ display: 'grid', gap: 12, padding: 16 }}>
        <div style={{ fontSize: 13, lineHeight: 1.7, color: '#bbb' }}>
          {bridgeArtist.innerWorldUnlocked ? '天橋盡頭出現了微弱的門縫光。' : '雨聲仍很密，故事還沒有拼合。'}<br />
          {bridgeArtist.ending === 'success' && <span style={{ color: '#b8ffd6' }}>畫家終於聽見了雨聲。</span>}
          {bridgeArtist.ending === 'failed' && <span style={{ color: '#ffd0d0' }}>天橋上留下了一道殘影。</span>}
        </div>
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 10 }}>
          <div style={{ color: '#eee', fontSize: 13, marginBottom: 8 }}>線索</div>
          <ul style={{ margin: 0, paddingLeft: 18, color: '#aaa', fontSize: 13, lineHeight: 1.6 }}>
            {save.collectedClues.length === 0 && <li>尚未收集</li>}
            {save.collectedClues.map(clueId => <li key={clueId}>{clueName(clueId)}</li>)}
          </ul>
        </div>
        {save.ghosts.length > 0 && <div style={{ color: '#ffb0b0', fontSize: 12, lineHeight: 1.5 }}>Ghost：{save.ghosts.length} 個殘影正在城市雨中徘徊。</div>}
        <GlimmerButton fullWidth onClick={onOpenDictionary}>情緒詞典</GlimmerButton>
        <GlimmerButton fullWidth onClick={onOpenTavern}>潛意識酒館</GlimmerButton>
        <GlimmerButton fullWidth onClick={onOpenReport}>餘波匯報</GlimmerButton>
        <GlimmerButton fullWidth tone="quiet" onClick={resetSave}>重置進度</GlimmerButton>
      </GlassPanel>

      <div style={{ position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 110, display: 'flex', gap: 8, padding: 8, background: 'rgba(0,0,0,0.72)', border: '1px solid #333', borderRadius: 999 }}>
        {locationOrder.map(locationId => (
          <GlimmerButton
            key={locationId}
            onClick={() => handleLocationChange(locationId)}
            tone={save.currentLocation === locationId ? 'primary' : 'ghost'}
            style={{ borderRadius: 999, minHeight: 32, padding: '6px 12px' }}
          >
            {locations[locationId].name}
          </GlimmerButton>
        ))}
      </div>

      <GlassPanel variant="dark" style={{ position: 'absolute', top: 20, right: 20, zIndex: 100, maxWidth: 330, pointerEvents: 'none' }} contentStyle={{ padding: '12px 16px', color: '#bbb', fontSize: 13, lineHeight: 1.7 }}>
        <strong style={{ color: '#eee' }}>{currentLocation.name}</strong> · {currentLocation.subtitle}<br />
        {currentLocation.ambient}<br />
        WASD / 方向鍵：移動<br />
        E / Space：互動
      </GlassPanel>

      {nearbyEntity && !modal && (
        <div style={{ position: 'absolute', bottom: 34, left: '50%', transform: 'translateX(-50%)', zIndex: 100, color: '#f4d99d', fontSize: 14, pointerEvents: 'none', background: 'rgba(0,0,0,0.72)', border: '1px solid rgba(244,217,157,0.28)', borderRadius: 999, padding: '8px 16px' }}>
          按 E 觀察：{nearbyEntity.label}
        </div>
      )}

      {ghostFlash && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 250, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffd0d0', background: 'rgba(80,0,0,0.16)', textShadow: '0 0 18px rgba(255,80,80,0.9)', fontSize: 24, letterSpacing: 2, pointerEvents: 'none' }}>
          {ghostFlash}
        </div>
      )}

      {discoveryNote && (
        <div style={{ position: 'absolute', top: '38%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 280, pointerEvents: 'none', textAlign: 'center' }}>
          <div style={{ color: '#f4d99d', fontSize: 22, fontWeight: 'bold', textShadow: '0 0 30px rgba(244,217,157,0.6), 0 0 60px rgba(244,217,157,0.2)', letterSpacing: 3, marginBottom: 8 }}>新的理解</div>
          <div style={{ color: '#e8e0d0', fontSize: 18, textShadow: '0 0 20px rgba(200,180,150,0.4)', letterSpacing: 2 }}>{discoveryNote}</div>
        </div>
      )}

      <div style={{ position: 'absolute', transform: `translate(${mapPos.x}px, ${mapPos.y}px)`, width: MAP_WIDTH, height: MAP_HEIGHT }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 45% 35%, rgba(45,55,65,0.95), rgba(5,7,10,1) 70%)' }} />
        <div style={{ position: 'absolute', left: ORIGIN_X - 920, top: ORIGIN_Y - 90, width: 1840, height: 1840, transform: 'rotateX(60deg) rotateZ(-45deg)', transformOrigin: 'center center', backgroundImage: 'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px), radial-gradient(circle at 50% 50%, rgba(120,140,160,0.16), rgba(30,34,40,0.86) 58%, rgba(10,12,16,0.96) 100%)', backgroundSize: '96px 96px, 96px 96px, cover', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 0 90px rgba(0,0,0,0.85) inset' }} />
        
        {/* 渲染寬敞的探索路面 */}
        <IsometricRoads locationId={save.currentLocation} isRepaired={bridgeArtist.ending === 'success'} />

        <div style={{ position: 'absolute', top: 58, left: '50%', transform: 'translateX(-50%)', width: 720, textAlign: 'center', pointerEvents: 'none', userSelect: 'none' }}>
          <div style={{ color: 'rgba(255,255,255,0.16)', fontSize: 28, letterSpacing: 8, fontWeight: 'bold' }}>{currentLocation.name}</div>
          <div style={{ color: 'rgba(255,255,255,0.28)', fontSize: 13, lineHeight: 1.7, marginTop: 10 }}>{currentLocation.description}</div>
        </div>

        {/* 渲染場景 3D 建築物 */}
        {buildings.filter(b => b.locationId === save.currentLocation).map(b => (
          <IsometricBuilding key={b.id} building={b} isRepaired={bridgeArtist.ending === 'success'} />
        ))}

        {entities.map(entity => {
          const screen = isoToScreen(entity.pos);
          const isNear = nearbyEntity?.id === entity.id;
          const isGalleryDoor = entity.id === 'gallery_door';
          const isPill = isGalleryDoor || entity.id === 'brush';

          const btnWidth = isPill ? 94 : (entity.type === 'npc' ? 64 : 48);
          const btnHeight = isPill ? 36 : (entity.type === 'npc' ? 84 : 48);
          const btnRadius = isPill ? '999px' : (entity.type === 'npc' ? '36px 36px 18px 18px' : '50%');
          const btnPadding = isPill ? '0 8px' : '0';

          return (
            <button
              key={entity.id}
              onClick={event => handleEntityClick(event, entity)}
              style={{
                position: 'absolute',
                left: screen.left,
                top: screen.top,
                transform: 'translate(-50%, -100%)',
                width: btnWidth,
                height: btnHeight,
                border: `2px solid ${entity.color}`,
                borderRadius: btnRadius,
                padding: btnPadding,
                background: entity.type === 'npc' ? 'rgba(255,170,51,0.12)' : 'rgba(255,255,255,0.08)',
                color: entity.color,
                cursor: 'pointer',
                zIndex: Math.round(screen.top) + (isGalleryDoor ? 500 : 0),
                boxShadow: isNear ? `0 0 36px ${entity.color}` : `0 0 18px ${entity.color}55`,
                fontWeight: 'bold',
                userSelect: 'none',
                transition: 'box-shadow 0.18s, transform 0.18s',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title={entity.label}
            >
              {isPill ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%', height: '100%', whiteSpace: 'nowrap' }}>
                  <span style={{
                    fontSize: 13,
                    fontWeight: 'bold',
                    background: 'rgba(255, 255, 255, 0.15)',
                    borderRadius: '50%',
                    width: 22,
                    height: 22,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {entity.icon}
                  </span>
                  <span style={{ fontSize: 11, letterSpacing: 0.5, fontWeight: 'bold' }}>
                    {entity.label}
                  </span>
                </div>
              ) : (
                <>
                  <div style={{ fontSize: entity.type === 'npc' ? 18 : 14 }}>{entity.icon}</div>
                  <div style={{ fontSize: 11, marginTop: 2 }}>{entity.label}</div>
                </>
              )}
            </button>
          );
        })}

        <div style={{ position: 'absolute', left: playerScreen.left, top: playerScreen.top, transform: 'translate(-50%, -100%)', width: 56, height: 86, zIndex: Math.round(playerScreen.top) + 5, pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', left: '50%', bottom: 4, transform: 'translateX(-50%)', width: 86, height: 34, background: 'radial-gradient(ellipse, rgba(0,0,0,0.5), transparent 68%)' }} />
          <div style={{ position: 'absolute', left: '50%', bottom: 22, transform: 'translateX(-50%)', width: 44, height: 52, borderRadius: '22px 22px 14px 14px', background: 'linear-gradient(#263341, #10151d)', border: '1px solid rgba(255,255,255,0.18)', boxShadow: '0 0 28px rgba(116,180,255,0.22)' }} />
          <div style={{ position: 'absolute', left: '50%', bottom: 68, transform: 'translateX(-50%)', width: 26, height: 26, borderRadius: '50%', background: '#c8d4df', border: '1px solid rgba(255,255,255,0.42)' }} />
          <div style={{ position: 'absolute', right: -4, bottom: 30, width: 16, height: 24, borderRadius: 8, background: 'rgba(255,217,132,0.86)', boxShadow: '0 0 34px rgba(255,206,103,0.8)' }} />
        </div>
      </div>

      {modal && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)' }} onClick={() => setModal(null)}>
          <GlassPanel title={modal.title} variant="dark" style={{ width: 540 }} contentStyle={{ color: '#ccc', lineHeight: 1.8, whiteSpace: 'pre-line' }}>
            {modal.content}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 18 }} onClick={event => event.stopPropagation()}>
              {modal.actions?.map(action => (
                <GlimmerButton key={action.label} tone={action.tone} onClick={action.onClick}>{action.label}</GlimmerButton>
              ))}
              <GlimmerButton onClick={() => setModal(null)}>關閉</GlimmerButton>
            </div>
          </GlassPanel>
        </div>
      )}
    </div>
  );
}
