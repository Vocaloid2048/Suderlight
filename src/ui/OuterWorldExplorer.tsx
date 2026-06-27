import { MouseEvent, useEffect, useMemo, useRef, useState } from 'react';
import { GlimmerButton, GlassPanel } from '../components';
import { bridgeArtistClues, clueOrder, locations, type ClueId, type LocationId, type NpcId } from '../data/verticalSlice';
import { getPlayerAuthHeaders } from '../lib/playerId';
import type { CollectClueResult } from '../store/gameStore';
import type { GameSave } from '../systems/saveSystem';
import brushImage from '../../images/item/ChatGPT Image 2026年5月29日 下午10_49_08.png';
import newspaperImage from '../../images/item/ChatGPT Image 2026年5月29日 下午10_50_17.png';
import sketchbookImage from '../../images/item/ChatGPT Image 2026年5月29日 下午10_51_17.png';
import painterImage from '../../images/character/IMG_3556.png';
import painterUnlockedImage from '../../images/character/IMG_3562.png';

// ---- 通用地圖資料層（可依 npcId 替換） ----
import {
  MAP_WIDTH, MAP_HEIGHT, TILE_W, TILE_H, ORIGIN_X, ORIGIN_Y, PLAYER_SPEED,
  buildings, roadDefs,
  clamp, lerp, isoToScreen, getSkybridgeElevation, worldToScreen,
  distance, getOffsetPos,
} from '../data/outerWorlds/bridgePainter';

// ---- 型別 ----
type Point = { x: number; y: number };
type EntityId = 'painter' | 'gallery_door' | 'torn_canvas' | ClueId;
type ModalAction = { label: string; tone?: 'primary' | 'danger' | 'ghost'; onClick: () => void };
type ModalState = { title: string; content: string; actions?: ModalAction[]; discoveryContent?: string; discoveryTitle?: string; discoveryDesc?: string } | null;

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
  onEnterInnerWorld: () => void;
  addFlagToNpc: (npcId: NpcId, flag: string) => void;
  onOpenArcFailure: () => void;
  npcId?: NpcId;
};

// ---- 工具 ----
const CLUE_IMAGE_MAP: Partial<Record<ClueId, string>> = {
  brush: brushImage,
  newspaper: newspaperImage,
  sketchbook: sketchbookImage,
};

function clueName(clueId: ClueId) {
  return (bridgeArtistClues as Record<string, { label: string }>)[clueId]?.label ?? clueId;
}

function adjustColorBrightness(hex: string, percent: number) {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = (num >> 16) + amt;
  const G = (num >> 8 & 0x00ff) + amt;
  const B = (num & 0x0000ff) + amt;
  const cc = (v: number) => Math.max(0, Math.min(255, v));
  return `#${cc(R).toString(16).padStart(2, '0')}${cc(G).toString(16).padStart(2, '0')}${cc(B).toString(16).padStart(2, '0')}`;
}

// ---- 等角建築渲染 ----
type WindowDef = { side: 'left' | 'right'; x: number; y: number; w: number; h: number };
type Building = { id: string; name: string; locationId: string; pos: Point; size: { x: number; y: number }; tall: number; baseColor: string; windows?: WindowDef[]; decorations?: (isRepaired: boolean) => React.ReactNode };

function getSurfacePoint(side: 'left' | 'right', rX: number, rY: number, s1: { left: number; top: number }, s2: { left: number; top: number }, s3: { left: number; top: number }, t1: { left: number; top: number }, t2: { left: number; top: number }, t3: { left: number; top: number }) {
  const bSide = side === 'left' ? s3 : s2;
  const bOther = side === 'left' ? s2 : s1;
  const tSide = side === 'left' ? t3 : t2;
  const tOther = side === 'left' ? t2 : t1;
  const bPt = { left: lerp(bSide.left, bOther.left, rX), top: lerp(bSide.top, bOther.top, rX) };
  const tPt = { left: lerp(tSide.left, tOther.left, rX), top: lerp(tSide.top, tOther.top, rX) };
  return { left: lerp(bPt.left, tPt.left, rY), top: lerp(bPt.top, tPt.top, rY) };
}

function getWindowPoints(win: WindowDef, s1: any, s2: any, s3: any, t1: any, t2: any, t3: any) {
  const p00 = getSurfacePoint(win.side, win.x, win.y, s1, s2, s3, t1, t2, t3);
  const p10 = getSurfacePoint(win.side, win.x + win.w, win.y, s1, s2, s3, t1, t2, t3);
  const p11 = getSurfacePoint(win.side, win.x + win.w, win.y + win.h, s1, s2, s3, t1, t2, t3);
  const p01 = getSurfacePoint(win.side, win.x, win.y + win.h, s1, s2, s3, t1, t2, t3);
  return `${p00.left},${p00.top} ${p10.left},${p10.top} ${p11.left},${p11.top} ${p01.left},${p01.top}`;
}

function IsometricBuilding({ building, isRepaired }: { building: Building; isRepaired: boolean }) {
  const p0 = { x: building.pos.x, y: building.pos.y };
  const p1 = { x: building.pos.x + building.size.x, y: building.pos.y };
  const p2 = { x: building.pos.x + building.size.x, y: building.pos.y + building.size.y };
  const p3 = { x: building.pos.x, y: building.pos.y + building.size.y };
  const s0 = isoToScreen(p0), s1 = isoToScreen(p1), s2 = isoToScreen(p2), s3 = isoToScreen(p3);
  const t0 = { left: s0.left, top: s0.top - building.tall }, t1 = { left: s1.left, top: s1.top - building.tall }, t2 = { left: s2.left, top: s2.top - building.tall }, t3 = { left: s3.left, top: s3.top - building.tall };
  const topFace = `${t0.left},${t0.top} ${t1.left},${t1.top} ${t2.left},${t2.top} ${t3.left},${t3.top}`;
  const leftFace = `${s3.left},${s3.top} ${s2.left},${s2.top} ${t2.left},${t2.top} ${t3.left},${t3.top}`;
  const rightFace = `${s2.left},${s2.top} ${s1.left},${s1.top} ${t1.left},${t1.top} ${t2.left},${t2.top}`;
  const c = building.baseColor;
  const mc = isRepaired ? c : '#3a3a3a';
  const lc = isRepaired ? adjustColorBrightness(c, 25) : '#5a5a5a';
  const dc = isRepaired ? adjustColorBrightness(c, -25) : '#222222';

  const gWin: WindowDef | null = building.id === 'gallery' ? { side: 'left', x: 0.36, y: 0.05, w: 0.28, h: 0.44 } : null;
  const gFrame: WindowDef | null = gWin ? { side: gWin.side, x: gWin.x - 0.03, y: gWin.y - 0.04, w: gWin.w + 0.06, h: gWin.h + 0.06 } : null;
  const gPts = gWin ? getWindowPoints(gWin, s1, s2, s3, t1, t2, t3) : null;
  const gFPts = gFrame ? getWindowPoints(gFrame, s1, s2, s3, t1, t2, t3) : null;
  const knob = gWin ? getSurfacePoint(gWin.side, gWin.x + gWin.w * 0.78, gWin.y + gWin.h * 0.58, s1, s2, s3, t1, t2, t3) : null;

  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: MAP_WIDTH, height: MAP_HEIGHT, pointerEvents: 'none', zIndex: Math.round(s2.top) }}>
      <svg width={MAP_WIDTH} height={MAP_HEIGHT} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
        <polygon points={`${s0.left},${s0.top} ${s1.left},${s1.top} ${s2.left},${s2.top} ${s3.left},${s3.top}`} fill="rgba(0,0,0,0.45)" filter="blur(8px)" />
        <polygon points={leftFace} fill={mc} stroke={isRepaired ? adjustColorBrightness(c, -10) : '#1a1a1a'} strokeWidth="1.5" style={{ transition: 'fill 1.5s ease, stroke 1.5s ease' }} />
        <polygon points={rightFace} fill={dc} stroke={isRepaired ? adjustColorBrightness(c, -30) : '#121212'} strokeWidth="1.5" style={{ transition: 'fill 1.5s ease, stroke 1.5s ease' }} />
        <polygon points={topFace} fill={lc} stroke={isRepaired ? adjustColorBrightness(c, 10) : '#2a2a2a'} strokeWidth="1.5" style={{ transition: 'fill 1.5s ease, stroke 1.5s ease' }} />
        {building.windows?.map((w, i) => {
          const pts = getWindowPoints(w, s1, s2, s3, t1, t2, t3);
          return <polygon key={i} points={pts} fill={isRepaired ? '#ffd54f' : 'rgba(255,255,255,0.05)'} style={{ transition: 'fill 1.5s ease', filter: isRepaired ? 'drop-shadow(0px 0px 4px rgba(255,213,79,0.85))' : 'none' }} />;
        })}
        {gFPts && <polygon points={gFPts} fill={isRepaired ? 'rgba(96,42,77,0.94)' : 'rgba(30,30,34,0.95)'} stroke={isRepaired ? 'rgba(255,214,150,0.45)' : 'rgba(255,255,255,0.12)'} strokeWidth="1.2" style={{ transition: 'fill 1.5s ease, stroke 1.5s ease', filter: isRepaired ? 'drop-shadow(0 0 6px rgba(255,180,120,0.18))' : 'none' }} />}
        {gPts && <polygon points={gPts} fill={isRepaired ? 'rgba(62,22,48,0.96)' : 'rgba(16,16,18,0.96)'} stroke={isRepaired ? 'rgba(255,196,132,0.28)' : 'rgba(255,255,255,0.08)'} strokeWidth="1" style={{ transition: 'fill 1.5s ease, stroke 1.5s ease' }} />}
        {gWin && <line x1={getSurfacePoint(gWin.side, gWin.x + gWin.w * 0.52, gWin.y, s1, s2, s3, t1, t2, t3).left} y1={getSurfacePoint(gWin.side, gWin.x + gWin.w * 0.52, gWin.y, s1, s2, s3, t1, t2, t3).top} x2={getSurfacePoint(gWin.side, gWin.x + gWin.w * 0.52, gWin.y + gWin.h, s1, s2, s3, t1, t2, t3).left} y2={getSurfacePoint(gWin.side, gWin.x + gWin.w * 0.52, gWin.y + gWin.h, s1, s2, s3, t1, t2, t3).top} stroke={isRepaired ? 'rgba(255,230,180,0.32)' : 'rgba(255,255,255,0.08)'} strokeWidth="0.9" style={{ transition: 'stroke 1.5s ease' }} />}
        {knob && <circle cx={knob.left} cy={knob.top} r={2.3} fill={isRepaired ? '#ffdca8' : '#8a8a92'} stroke={isRepaired ? 'rgba(120,74,22,0.7)' : 'rgba(25,25,28,0.9)'} strokeWidth="0.8" style={{ transition: 'fill 1.5s ease, stroke 1.5s ease', filter: isRepaired ? 'drop-shadow(0 0 5px rgba(255,212,140,0.45))' : 'none' }} />}
      </svg>
      <div style={{ position: 'absolute', left: s2.left, top: s0.top - building.tall - 20, transform: 'translateX(-50%)', color: isRepaired ? '#fff' : '#888', fontSize: 11, padding: '2px 6px', background: isRepaired ? 'rgba(30,40,50,0.85)' : 'rgba(0,0,0,0.65)', border: `1px solid ${isRepaired ? '#ffe082' : '#444'}`, borderRadius: 4, boxShadow: isRepaired ? '0 0 10px rgba(255,224,130,0.3)' : 'none', pointerEvents: 'auto', userSelect: 'none' }}>{building.name}</div>
      {building.decorations?.(isRepaired)}
    </div>
  );
}

// ---- 道路渲染 ----
const BRIDGE_RAIL_HEIGHT = 14;
const BRIDGE_DECK_ELEVATION = 76;

function IsometricRoads({ locationId, isRepaired }: { locationId: LocationId; isRepaired: boolean }) {
  const rDefs = useMemo(() => roadDefs(locationId), [locationId]);
  const toElevatedScreen = (pt: Point) => {
    const b = isoToScreen(pt);
    return { left: b.left, top: b.top - getSkybridgeElevation(pt) };
  };
  const roadFill = isRepaired ? 'rgba(45,64,89,0.45)' : 'rgba(30,30,30,0.65)';
  const roadStroke = isRepaired ? 'rgba(255,224,130,0.35)' : 'rgba(255,255,255,0.06)';

  const bridgeDetails = useMemo(() => {
    if (locationId !== 'skybridge') return null;
    const piers = [
      { deck: toElevatedScreen({ x: 4.0, y: 10 }), base: isoToScreen({ x: 4.0, y: 10 }) },
      { deck: toElevatedScreen({ x: 7.5, y: 10 }), base: isoToScreen({ x: 7.5, y: 10 }) },
      { deck: toElevatedScreen({ x: 11.5, y: 10 }), base: isoToScreen({ x: 11.5, y: 10 }) },
      { deck: toElevatedScreen({ x: 15.5, y: 10 }), base: isoToScreen({ x: 15.5, y: 10 }) },
      { deck: toElevatedScreen({ x: 18.5, y: 10 }), base: isoToScreen({ x: 18.5, y: 10 }) },
      { deck: toElevatedScreen({ x: 17.0, y: 6.0 }), base: isoToScreen({ x: 17.0, y: 6.0 }) },
      { deck: toElevatedScreen({ x: 19.0, y: 6.0 }), base: isoToScreen({ x: 19.0, y: 6.0 }) },
    ];
    const railings: Array<Array<{ p1: { left: number; top: number }; p2: { left: number; top: number } }>> = [];
    const rA: typeof railings[0] = [];
    for (let x = 6.0; x <= 19.01; x += 0.8) { const p = toElevatedScreen({ x, y: 10 }); rA.push({ p1: p, p2: { left: p.left, top: p.top - BRIDGE_RAIL_HEIGHT } }); }
    railings.push(rA);
    const rB: typeof railings[0] = [];
    for (let x = 4.0; x <= 16.61; x += 0.8) { const p = toElevatedScreen({ x, y: 8 }); rB.push({ p1: p, p2: { left: p.left, top: p.top - BRIDGE_RAIL_HEIGHT } }); }
    const pLast = toElevatedScreen({ x: 17.0, y: 8.0 }); rB.push({ p1: pLast, p2: { left: pLast.left, top: pLast.top - BRIDGE_RAIL_HEIGHT } });
    railings.push(rB);
    const rC: typeof railings[0] = [];
    for (let y = 4.0; y <= 8.0; y += 0.8) { const p = toElevatedScreen({ x: 17, y }); rC.push({ p1: p, p2: { left: p.left, top: p.top - BRIDGE_RAIL_HEIGHT } }); }
    railings.push(rC);
    const rD: typeof railings[0] = [];
    for (let y = 4.0; y <= 9.61; y += 0.8) { const p = toElevatedScreen({ x: 19, y }); rD.push({ p1: p, p2: { left: p.left, top: p.top - BRIDGE_RAIL_HEIGHT } }); }
    const pLast2 = toElevatedScreen({ x: 19, y: 10.0 }); rD.push({ p1: pLast2, p2: { left: pLast2.left, top: pLast2.top - BRIDGE_RAIL_HEIGHT } });
    railings.push(rD);
    const rL: typeof railings[0] = []; for (let y = 10.0; y <= 16.01; y += 0.8) { const p = toElevatedScreen({ x: 4, y }); rL.push({ p1: p, p2: { left: p.left, top: p.top - BRIDGE_RAIL_HEIGHT } }); } railings.push(rL);
    const rR: typeof railings[0] = []; for (let y = 10.0; y <= 16.01; y += 0.8) { const p = toElevatedScreen({ x: 6, y }); rR.push({ p1: p, p2: { left: p.left, top: p.top - BRIDGE_RAIL_HEIGHT } }); } railings.push(rR);
    return { piers, railings };
  }, [locationId]);

  return (
    <svg width={MAP_WIDTH} height={MAP_HEIGHT} style={{ position: 'absolute', left: 0, top: 0, zIndex: 1, pointerEvents: 'none', overflow: 'visible' }}>
      {locationId === 'skybridge' && bridgeDetails && (
        <g>{bridgeDetails.piers.map((pier, i) => {
          const sh = Math.max(26, pier.base.top - pier.deck.top + 22);
          return (<g key={i}><rect x={pier.deck.left - 3} y={pier.deck.top} width={6} height={sh} rx={2} fill={isRepaired ? 'rgba(116,143,171,0.22)' : 'rgba(120,128,140,0.12)'} stroke={isRepaired ? 'rgba(255,224,130,0.10)' : 'rgba(255,255,255,0.05)'} strokeWidth="1" style={{ transition: 'fill 1.5s ease, stroke 1.5s ease' }} /><rect x={pier.base.left - 6} y={pier.base.top + 20} width={12} height={4} rx={1} fill={isRepaired ? 'rgba(72,96,124,0.18)' : 'rgba(90,96,110,0.10)'} style={{ transition: 'fill 1.5s ease' }} /></g>);
        })}</g>
      )}
      {rDefs.map((pts, idx) => {
        const sp = pts.map(pt => toElevatedScreen(pt));
        const ptsStr = sp.map(p => `${p.left},${p.top}`).join(' ');
        const isStairs = locationId === 'skybridge' && idx === 2;
        return (<g key={idx}>
          {isRepaired && <polygon points={ptsStr} fill="none" stroke="rgba(255,224,130,0.12)" strokeWidth="12" style={{ filter: 'blur(4px)', transition: 'stroke 1.5s ease' }} />}
          <polygon points={ptsStr} fill={roadFill} stroke={roadStroke} strokeWidth="2.5" style={{ transition: 'fill 1.5s ease, stroke 1.5s ease' }} />
          {locationId === 'skybridge' && idx <= 1 && <polygon points={`${sp[2].left},${sp[2].top} ${sp[3].left},${sp[3].top} ${isoToScreen(pts[3]).left},${isoToScreen(pts[3]).top} ${isoToScreen(pts[2]).left},${isoToScreen(pts[2]).top}`} fill="rgba(22,30,40,0.24)" stroke="rgba(255,255,255,0.035)" strokeWidth="1" />}
          {isStairs && <g>{Array.from({ length: 18 }).map((_, si) => { const t = si / 17; const sy = lerp(10.08, 15.92, t); const p1 = toElevatedScreen({ x: 4, y: sy }); const p2 = toElevatedScreen({ x: 6, y: sy }); return (<g key={si}><line x1={p1.left} y1={p1.top} x2={p2.left} y2={p2.top} stroke={isRepaired ? 'rgba(255,224,130,0.52)' : 'rgba(255,255,255,0.22)'} strokeWidth="1.6" /><line x1={p1.left} y1={p1.top + 3} x2={p2.left} y2={p2.top + 3} stroke="rgba(0,0,0,0.28)" strokeWidth="1" /></g>); })}</g>}
        </g>);
      })}
      {locationId === 'skybridge' && bridgeDetails && (
        <g>{bridgeDetails.railings.map((rg, gi) => (<g key={gi}>{rg.map((l, i) => (<line key={i} x1={l.p1.left} y1={l.p1.top} x2={l.p2.left} y2={l.p2.top} stroke={isRepaired ? 'rgba(255,224,130,0.45)' : 'rgba(255,255,255,0.15)'} strokeWidth="1" style={{ transition: 'stroke 1.5s ease' }} />))}{rg.length > 0 && <path d={`M ${rg[0].p2.left} ${rg[0].p2.top} ` + rg.slice(1).map(l => `L ${l.p2.left} ${l.p2.top}`).join(' ')} fill="none" stroke={isRepaired ? 'rgba(255,224,130,0.65)' : 'rgba(255,255,255,0.25)'} strokeWidth="1.5" style={{ transition: 'stroke 1.5s ease' }} />}</g>))}</g>
      )}
    </svg>
  );
}

// ============================================================
export default function OuterWorldExplorer({
  save, collectClue, setCurrentLocation, resetSave, onOpenConversation, onOpenDictionary, onOpenTavern, onOpenReport, onEnterInnerWorld, addFlagToNpc, onOpenArcFailure, npcId: _npcId,
}: OuterWorldExplorerProps) {
  const [playerPos, setPlayerPos] = useState<Point>(locations[save.currentLocation].spawn);
  const [isDragging, setIsDragging] = useState(false);
  const [mapPos, setMapPos] = useState({ x: -320, y: -160 });
  const [modal, setModal] = useState<ModalState>(null);
  const [ghostFlash, setGhostFlash] = useState<string | null>(null);
  const dragStart = useRef({ x: 0, y: 0 });
  const hasMoved = useRef(false);
  const keys = useRef(new Set<string>());

  const displayLoc = useMemo(() => {
    if (save.currentLocation === 'skybridge') {
      return { id: 'skybridge' as LocationId, name: '表世界', subtitle: '街道、報攤與公園', description: '天橋、報攤與公園，這些在白晝下失色的微光之處，正透過漫長的道路和臺階連接在一起。往事在這裡延伸，等待著你去探索。', ambient: '雨後的車流低鳴、舊報紙的油墨味、潮濕泥土與落葉的微光', spawn: locations['skybridge'].spawn };
    }
    return locations[save.currentLocation];
  }, [save.currentLocation]);

  const bridgeArtist = save.npcs.bridge_artist;

  const entities = useMemo<Entity[]>(() => {
    const list: Entity[] = [];
    if (save.currentLocation === 'skybridge') {
      if (bridgeArtist.ending === 'failed') {
        list.push({ id: 'torn_canvas', label: '被撕碎的空白畫布', type: 'clue', pos: { x: 13, y: 9 }, color: '#7a7a8a', icon: '碎' });
      } else {
        list.push({ id: 'painter', label: '天橋畫家', type: 'npc', pos: { x: 13, y: 9 }, color: bridgeArtist.ending === 'success' ? '#7acc7a' : '#ffaa33', icon: bridgeArtist.ending === 'success' ? '光' : '畫' });
      }
      list.push({ id: 'gallery_door', label: '畫廊大門', type: 'clue', pos: { x: 18.0, y: 7.0 }, color: '#ec407a', icon: '門' });
    }
    clueOrder.forEach(clueId => {
      const clue = (bridgeArtistClues as Record<string, { locationId: string; pos: Point; label: string; color: string; icon: string }>)[clueId];
      if (!clue) return;
      const isVisible = save.currentLocation === 'skybridge' ? (clue.locationId === 'skybridge' || clue.locationId === 'newsstand' || clue.locationId === 'park') : clue.locationId === save.currentLocation;
      if (isVisible && !save.collectedClues.includes(clueId as ClueId)) {
        let ap = save.currentLocation === 'skybridge' ? getOffsetPos(clue.locationId, clue.pos) : clue.pos;
        list.push({ id: clueId as ClueId, label: clue.label, type: 'clue', pos: ap, color: clue.color, icon: clue.icon });
      }
    });
    return list;
  }, [bridgeArtist.ending, save.collectedClues, save.currentLocation]);

  const nearbyEntity = entities.find(e => distance(e.pos, playerPos) <= 1.35);

  const focusCameraOnPlayer = (pos: Point) => {
    const base = isoToScreen(pos);
    const s = { left: base.left, top: base.top - getSkybridgeElevation(pos) };
    setMapPos({ x: clamp(window.innerWidth / 2 - s.left, window.innerWidth - MAP_WIDTH, 0), y: clamp(window.innerHeight / 2 - s.top + 80, window.innerHeight - MAP_HEIGHT, 0) });
  };

  const maybeTriggerGhost = () => {
    if (save.ghosts.length === 0 || Math.random() >= 0.1) return;
    setGhostFlash(save.ghosts[0].memoryText);
    setTimeout(() => setGhostFlash(null), 1800);
  };

  const interact = (targetId: EntityId) => {
    if (targetId === 'gallery_door') {
      if (bridgeArtist.innerWorldUnlocked && bridgeArtist.ending === 'none') {
        setModal({ title: '進入心理世界', content: '你站在失色畫廊沉重的雕花橡木門前。\n\n此時你已解鎖了心理世界的存取權，大門正散發著玄妙的心智波動。\n\n是否推開大門，潛入畫家的心理世界（第一層：榮耀美術館）進行探索？', actions: [{ label: '潛入心理世界', tone: 'primary', onClick: () => { setModal(null); onEnterInnerWorld(); } }, { label: '留在外面', onClick: () => setModal(null) }] });
      } else {
        setModal({ title: '進入建築物', content: `你站在失色畫廊沉重的雕花橡木門前。\n\n${bridgeArtist.ending === 'success' ? '在被開導後，這裡已經泛起了溫暖的色彩，門縫下透出令人安心的金黃色光芒。' : '這扇門被冰冷沉悶的死灰包圍，彷彿封鎖了一段不願示人的過往。'}\n\n是否推開大門進入探索？`, actions: [{ label: '推門進入', tone: 'primary', onClick: () => { setModal({ title: '失色畫廊 - 內部幻境', content: `【失色畫廊 · 內部】\n\n你推開了大門。此時畫廊內部呈現出一個宏大的心智空間，牆壁上掛滿了未填滿的畫布。${bridgeArtist.ending === 'success' ? '\n\n【治癒共鳴】高大的採光窗下，一道明亮柔和的暖光斜射在地板上。雨聲此時在畫廊內迴響，空洞的灰色畫布上慢慢浮現出春天的線條與輪廓，那是重生的起點。' : '\n\n【失色迴廊】四下寂靜無聲，只有陰暗的灰階霧氣漂浮。所有的作品都沒有顏色，像一座封存了辨色力與希望的宏大墓碑，這就是他封閉的內心深處。\n\n（提示：你尚未解鎖心理世界的探尋權限，需要與畫家進一步對話並收集更多線索）'}`, actions: [{ label: '回到外表世界', onClick: () => setModal(null) }] }); } }, { label: '留在外面', onClick: () => setModal(null) }] });
      }
      return;
    }
    if (targetId === 'painter') {
      if (bridgeArtist.ending === 'success') { setModal({ title: '成功結局：雨聲仍在', content: '他沒有重新看見色彩，也沒有立刻變好。\n\n但他終於放下畫筆，坐在失色畫廊的地上，聽見雨聲從遠處回來。\n\n「原來……不畫畫的時候，我也還在。」', actions: [{ label: '查看餘波匯報', tone: 'primary', onClick: onOpenReport }] }); return; }
      onOpenConversation(); return;
    }
    if (targetId === 'torn_canvas') {
      const interacted = bridgeArtist.flags.includes('torn_canvas_first_interaction');
      if (interacted) { setModal({ title: '被撕碎的空白畫布', content: '碎布還在原地。雨水繼續浸透它們。\n你注意到最大那塊碎片上的鉛筆線——\n它是一筆從畫框中央向外拖出去的長線，\n在撕裂處戛然而止。\n像一段話，說到一半就斷了。\n\n「連這最後的......空白......你都不肯......留給我嗎？」\n\n你感覺天橋的風變冷了一些。', actions: [{ label: '走向終章', tone: 'primary', onClick: () => { setModal(null); onOpenArcFailure(); } }] }); } else { setModal({ title: '被撕碎的空白畫布', content: '你蹲下身，手指觸到濕透的帆布邊緣。\n纖維在水裡泡得發軟，觸感像死去的皮膚。\n你試著把碎片拼回原來的形狀——但它們已經泡皺了，\n再也無法對齊。\n雨水從你的指縫流過，把撕裂的邊緣沖得更碎。\n\n「連這最後的空白，你都不肯留給我嗎？」\n\n（稍後再來看看它吧。）'}); addFlagToNpc('bridge_artist', 'torn_canvas_first_interaction'); }
      return;
    }
    const result = collectClue(targetId as ClueId);
    const clue = (bridgeArtistClues as Record<string, { content: string; dictionaryHint: string; label: string }>)[targetId as string];
    maybeTriggerGhost();
    const buildContent = () => { let c = `${clue.content}`; if (result.unlockedNow) c += '\n\n天橋盡頭傳來一聲很輕的門軸聲。某個通往內心深處的入口，似乎鬆動了。'; return c; };
    const openCm = (extra?: { title?: string; desc?: string }) => { const hint = `情緒詞典浮現：${clue?.dictionaryHint ?? ''}`; setModal({ title: `獲得線索：${result.label}`, content: buildContent(), discoveryContent: hint, discoveryTitle: extra?.title, discoveryDesc: extra?.desc }); };
    if (!result.alreadyCollected) {
      getPlayerAuthHeaders().then(h => fetch('/api/investigation/collect', { method: 'POST', headers: { 'Content-Type': 'application/json', ...h }, body: JSON.stringify({ clueId: targetId }) }).then(r => r.json()).then(data => { const unlocked = Array.isArray(data.unlockedEntries) ? data.unlockedEntries : Array.isArray(data.newlyUnlockedDictionary) ? data.newlyUnlockedDictionary : []; if (unlocked.length === 0) { openCm(); return; } fetch('/api/dictionary').then(r => r.json()).then(dict => { const entry = (dict.entries as Array<{ id: string; name: string; description?: string }>).find(item => unlocked.includes(item.id)); openCm(entry ? { title: entry.name, desc: entry.description ?? clue?.dictionaryHint } : undefined); }).catch(() => openCm()); }).catch(() => openCm()));
      return;
    }
    openCm();
  };

  useEffect(() => { focusCameraOnPlayer(playerPos); window.addEventListener('resize', () => focusCameraOnPlayer(playerPos)); return () => window.removeEventListener('resize', () => focusCameraOnPlayer(playerPos)); }, []);
  useEffect(() => { if (save.currentLocation === 'newsstand' || save.currentLocation === 'park') { const ol = save.currentLocation; setCurrentLocation('skybridge'); const ns = getOffsetPos(ol, locations[ol].spawn); setPlayerPos(ns); focusCameraOnPlayer(ns); } }, [save.currentLocation, setCurrentLocation]);
  useEffect(() => {
    const hkd = (e: KeyboardEvent) => { if (e.key === 'Escape' && modal) { setModal(null); return; } if (modal) return; if (['w','a','s','d','arrowup','arrowleft','arrowdown','arrowright'].includes(e.key.toLowerCase())) { e.preventDefault(); keys.current.add(e.key.toLowerCase()); } if ((e.key === 'e' || e.key === ' ') && nearbyEntity) { e.preventDefault(); interact(nearbyEntity.id); } };
    const hku = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase());
    window.addEventListener('keydown', hkd); window.addEventListener('keyup', hku);
    return () => { window.removeEventListener('keydown', hkd); window.removeEventListener('keyup', hku); };
  }, [modal, nearbyEntity]);
  useEffect(() => {
    let frame = 0;
    const tick = () => {
      if (!modal) {
        let dx = 0, dy = 0;
        if (keys.current.has('w') || keys.current.has('arrowup')) dy -= 1;
        if (keys.current.has('s') || keys.current.has('arrowdown')) dy += 1;
        if (keys.current.has('a') || keys.current.has('arrowleft')) dx -= 1;
        if (keys.current.has('d') || keys.current.has('arrowright')) dx += 1;
        if (dx !== 0 || dy !== 0) {
          const len = Math.hypot(dx, dy);
          setPlayerPos(prev => {
            const sx = (dx / len) * PLAYER_SPEED, sy = (dy / len) * PLAYER_SPEED;
            const buffer = 0.4;
            const maxX = save.currentLocation === 'skybridge' ? 28 : 22, maxY = save.currentLocation === 'skybridge' ? 22 : 18;
            const checkCol = (pt: Point) => {
              if (pt.x < 1 || pt.x > maxX || pt.y < 1 || pt.y > maxY) return true;
              const bc = buildings.some(b => { let ap = b.pos; if (save.currentLocation === 'skybridge' && (b.locationId !== 'skybridge' && b.locationId !== 'newsstand' && b.locationId !== 'park')) return false; if (save.currentLocation === 'skybridge' && b.locationId !== 'skybridge') ap = getOffsetPos(b.locationId, b.pos); return pt.x >= ap.x - buffer && pt.x <= ap.x + b.size.x + buffer && pt.y >= ap.y - buffer && pt.y <= ap.y + b.size.y + buffer; });
              if (bc) return true;
              if (save.currentLocation === 'skybridge') {
                const inB = pt.x >= 4.5 && pt.x <= 19.0 && pt.y >= 8.5 && pt.y <= 10.0;
                const inP = pt.x >= 17.5 && pt.x <= 19.0 && pt.y >= 7.0 && pt.y <= 8.5;
                const inS = pt.x >= 4.5 && pt.x <= 6.0 && pt.y >= 10.0 && pt.y <= 17.0;
                const inG = pt.x >= 4.5 && pt.x <= 26.0 && pt.y >= 16.5 && pt.y <= 19.0;
                if (!inB && !inP && !inS && !inG) return true;
              }
              return false;
            };
            const nb = { x: clamp(prev.x + sx, 1, maxX), y: clamp(prev.y + sy, 1, maxY) };
            if (!checkCol(nb)) { focusCameraOnPlayer(nb); return nb; }
            const nx = { x: clamp(prev.x + sx, 1, maxX), y: prev.y };
            if (!checkCol(nx)) { focusCameraOnPlayer(nx); return nx; }
            const ny = { x: prev.x, y: clamp(prev.y + sy, 1, maxY) };
            if (!checkCol(ny)) { focusCameraOnPlayer(ny); return ny; }
            return prev;
          });
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [modal, save.currentLocation]);

  const handleMouseDown = (e: MouseEvent) => { setIsDragging(true); hasMoved.current = false; dragStart.current = { x: e.clientX - mapPos.x, y: e.clientY - mapPos.y }; };
  const handleMouseMove = (e: MouseEvent) => { if (!isDragging) return; hasMoved.current = true; setMapPos({ x: clamp(e.clientX - dragStart.current.x, window.innerWidth - MAP_WIDTH, 0), y: clamp(e.clientY - dragStart.current.y, window.innerHeight - MAP_HEIGHT, 0) }); };
  const handleMouseUp = () => setIsDragging(false);
  const handleEntityClick = (e: MouseEvent, entity: Entity) => { e.stopPropagation(); if (hasMoved.current) return; if (distance(entity.pos, playerPos) > 1.35) { setModal({ title: entity.label, content: '距離太遠了。也許你應該親自走近一點，再試著理解他。' }); return; } interact(entity.id); };

  const pb = isoToScreen(playerPos);
  const ps = { left: pb.left, top: pb.top - getSkybridgeElevation(playerPos) };
  const traumaFilter = save.ghosts.length > 0 ? 'grayscale(0.22) contrast(0.95)' : 'none';

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden', cursor: isDragging ? 'grabbing' : 'grab', background: '#080a0d', filter: traumaFilter }} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
      <GlassPanel title="提燈筆記" variant="dark" style={{ position: 'absolute', top: 20, left: 20, zIndex: 100, width: 270 }} contentStyle={{ display: 'grid', gap: 12, padding: 16 }}>
        <div style={{ fontSize: 13, lineHeight: 1.7, color: '#bbb' }}>
          {bridgeArtist.innerWorldUnlocked ? '天橋盡頭出現了微弱的門縫光。' : '雨聲仍很密，故事還沒有拼合。'}<br />
          {bridgeArtist.ending === 'success' && <span style={{ color: '#b8ffd6' }}>畫家終於聽見了雨聲。</span>}
          {bridgeArtist.ending === 'failed' && <span style={{ color: '#ffd0d0' }}>天橋上只剩下一張被撕碎的空白畫布。</span>}
        </div>
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 10 }}>
          <div style={{ color: '#eee', fontSize: 13, marginBottom: 8 }}>線索</div>
          <ul style={{ margin: 0, paddingLeft: 18, color: '#aaa', fontSize: 13, lineHeight: 1.6 }}>
            {save.collectedClues.length === 0 && <li>尚未收集</li>}
            {save.collectedClues.map(cid => <li key={cid}>{clueName(cid)}</li>)}
          </ul>
        </div>
        {save.ghosts.length > 0 && <div style={{ color: '#ffb0b0', fontSize: 12, lineHeight: 1.5 }}>Ghost：{save.ghosts.length} 個殘影正在城市雨中徘徊。</div>}
        <GlimmerButton fullWidth onClick={onOpenDictionary}>情緒詞典</GlimmerButton>
        <GlimmerButton fullWidth onClick={onOpenTavern}>潛意識酒館</GlimmerButton>
        <GlimmerButton fullWidth onClick={onOpenReport}>餘波匯報</GlimmerButton>
        <GlimmerButton fullWidth tone="quiet" onClick={resetSave}>重置進度</GlimmerButton>
      </GlassPanel>

      <GlassPanel variant="dark" style={{ position: 'absolute', top: 20, right: 20, zIndex: 100, maxWidth: 330, pointerEvents: 'none' }} contentStyle={{ padding: '12px 16px', color: '#bbb', fontSize: 13, lineHeight: 1.7 }}>
        <strong style={{ color: '#eee' }}>{displayLoc.name}</strong> · {displayLoc.subtitle}<br />
        {displayLoc.ambient}<br />
        WASD / 方向鍵：移動<br />
        E / Space：互動
      </GlassPanel>

      {nearbyEntity && !modal && <div style={{ position: 'absolute', bottom: 34, left: '50%', transform: 'translateX(-50%)', zIndex: 100, color: '#f4d99d', fontSize: 14, pointerEvents: 'none', background: 'rgba(0,0,0,0.72)', border: '1px solid rgba(244,217,157,0.28)', borderRadius: 999, padding: '8px 16px' }}>按 E 觀察：{nearbyEntity.label}</div>}
      {ghostFlash && <div style={{ position: 'absolute', inset: 0, zIndex: 250, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffd0d0', background: 'rgba(80,0,0,0.16)', textShadow: '0 0 18px rgba(255,80,80,0.9)', fontSize: 24, letterSpacing: 2, pointerEvents: 'none' }}>{ghostFlash}</div>}

      <div style={{ position: 'absolute', transform: `translate(${mapPos.x}px, ${mapPos.y}px)`, width: MAP_WIDTH, height: MAP_HEIGHT }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 45% 35%, rgba(45,55,65,0.95), rgba(5,7,10,1) 70%)' }} />
        <div style={{ position: 'absolute', left: ORIGIN_X - 920, top: ORIGIN_Y - 90, width: 1840, height: 1840, transform: 'rotateX(60deg) rotateZ(-45deg)', transformOrigin: 'center center', backgroundImage: 'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px), radial-gradient(circle at 50% 50%, rgba(120,140,160,0.16), rgba(30,34,40,0.86) 58%, rgba(10,12,16,0.96) 100%)', backgroundSize: '96px 96px, 96px 96px, cover', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 0 90px rgba(0,0,0,0.85) inset' }} />
        <IsometricRoads locationId={save.currentLocation} isRepaired={bridgeArtist.ending === 'success'} />
        <div style={{ position: 'absolute', top: 58, left: '50%', transform: 'translateX(-50%)', width: 720, textAlign: 'center', pointerEvents: 'none', userSelect: 'none' }}>
          <div style={{ color: 'rgba(255,255,255,0.16)', fontSize: 28, letterSpacing: 8, fontWeight: 'bold' }}>{displayLoc.name}</div>
          <div style={{ color: 'rgba(255,255,255,0.28)', fontSize: 13, lineHeight: 1.7, marginTop: 10 }}>{displayLoc.description}</div>
        </div>
        {buildings.filter(b => save.currentLocation === 'skybridge' ? (b.locationId === 'skybridge' || b.locationId === 'newsstand' || b.locationId === 'park') : b.locationId === save.currentLocation).map(b => {
          let ab = b;
          if (save.currentLocation === 'skybridge' && (b.locationId === 'newsstand' || b.locationId === 'park')) { const mp = getOffsetPos(b.locationId, b.pos); ab = { ...b, pos: mp }; if (b.id === 'news_cabin') { ab = { ...ab, windows: [{ side: 'left', x: 0.2, y: 0.3, w: 0.6, h: 0.4 }], decorations: (isR: boolean) => { const sc = isoToScreen({ x: ab.pos.x + 1.5, y: ab.pos.y + 3.0 }); return <div style={{ position: 'absolute', left: sc.left, top: sc.top - 12, width: 48, height: 18, background: isR ? 'linear-gradient(90deg, #ffb300, #ff8f00)' : '#444', border: '1px solid #ffe082', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 9, fontWeight: 'bold', boxShadow: isR ? '0 0 12px #ff8f00' : 'none', transform: 'skewY(-15deg)', transition: 'all 1.5s', pointerEvents: 'none' }}>OPEN</div>; } }; } }
          return <IsometricBuilding key={ab.id} building={ab} isRepaired={bridgeArtist.ending === 'success'} />;
        })}
        {entities.map(entity => {
          const es = isoToScreen(entity.pos); const s = { left: es.left, top: es.top - getSkybridgeElevation(entity.pos) };
          const isNear = nearbyEntity?.id === entity.id;
          const isGDoor = entity.id === 'gallery_door';
          const cImg = entity.type === 'clue' ? CLUE_IMAGE_MAP[entity.id as ClueId] : undefined;
          const isImg = entity.type === 'clue' && Boolean(cImg);
          const isPtr = entity.id === 'painter';
          const isTC = entity.id === 'torn_canvas';
          const isPill = !isImg && !isPtr && !isTC && (isGDoor || entity.id === 'brush' || entity.id === 'newspaper' || entity.id === 'sketchbook' || entity.id === 'accident_report');
          const bw = isTC ? 82 : (isImg ? 88 : (isPill ? 94 : (entity.type === 'npc' ? 64 : 48)));
          const bh = isTC ? 82 : (isImg ? 112 : (isPill ? 36 : (entity.type === 'npc' ? 84 : 48)));
          return (
            <button key={entity.id} onClick={e => handleEntityClick(e, entity)} style={{ position: 'absolute', left: s.left, top: s.top, transform: 'translate(-50%, -100%)', width: bw, height: bh, border: isTC ? '2px dashed #5a5a6e' : (isPtr ? 'none' : `2px solid ${entity.color}`), borderRadius: isPtr ? '0' : isTC ? '8px 14px 10px 4px' : isImg ? '14px' : isPill ? '999px' : entity.type === 'npc' ? '36px 36px 18px 18px' : '50%', padding: isPtr ? '0' : isTC ? '4px' : isImg ? '4px' : isPill ? '0 8px' : '0', background: isTC ? 'rgba(20,22,30,0.94)' : isPtr ? 'transparent' : isImg ? 'rgba(14,18,25,0.92)' : entity.type === 'npc' ? 'rgba(255,170,51,0.12)' : 'rgba(255,255,255,0.08)', color: isTC ? '#8a8a9c' : entity.color, cursor: 'pointer', zIndex: Math.round(s.top) + (isGDoor ? 500 : 0), boxShadow: isTC ? (isNear ? '0 0 28px rgba(120,120,140,0.35)' : '0 0 10px rgba(120,120,140,0.15)') : isPtr ? (isNear ? '0 0 26px rgba(255,196,132,0.65)' : 'none') : (isNear ? `0 0 36px ${entity.color}` : `0 0 18px ${entity.color}55`), fontWeight: 'bold', userSelect: 'none', transition: 'box-shadow 0.18s, transform 0.18s', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }} title={entity.label}>
              {isPtr ? <img src={bridgeArtist.ending === 'success' ? painterUnlockedImage : painterImage} alt={entity.label} style={{ width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'center bottom', border: 'none', borderRadius: 0, filter: isNear ? 'drop-shadow(0 0 20px rgba(255,196,132,0.45))' : 'none' }} />
              : isImg && cImg ? <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center', width: '100%', height: '100%' }}><img src={cImg} alt={entity.label} style={{ width: '100%', height: 72, objectFit: 'cover', borderRadius: 9, border: '1px solid rgba(255,255,255,0.18)', boxShadow: '0 3px 10px rgba(0,0,0,0.35)' }} /><span style={{ fontSize: 11, lineHeight: 1.2, letterSpacing: 0.2, color: '#f7f0dc', textShadow: '0 0 6px rgba(0,0,0,0.45)' }}>{entity.label}</span></div>
              : isPill ? <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%', height: '100%', whiteSpace: 'nowrap' }}><span style={{ fontSize: 13, fontWeight: 'bold', background: 'rgba(255,255,255,0.15)', borderRadius: '50%', width: 22, height: 22, minWidth: 22, minHeight: 22, flexShrink: 0, flexGrow: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{entity.icon}</span><span style={{ fontSize: 11, letterSpacing: 0.5, fontWeight: 'bold' }}>{entity.label}</span></div>
              : isTC ? <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, width: '100%', height: '100%' }}><div style={{ fontSize: 22, opacity: 0.55, filter: 'grayscale(1)', lineHeight: 1 }}>🧩</div><span style={{ fontSize: 9, letterSpacing: 0.3, color: '#7a7a8c', textAlign: 'center', lineHeight: 1.3, maxWidth: 70 }}>{entity.label}</span></div>
              : <><div style={{ fontSize: entity.type === 'npc' ? 18 : 14 }}>{entity.icon}</div><div style={{ fontSize: 11, marginTop: 2 }}>{entity.label}</div></>}
            </button>
          );
        })}
        <div style={{ position: 'absolute', left: ps.left, top: ps.top, transform: 'translate(-50%, -100%)', width: 56, height: 86, zIndex: 9999, pointerEvents: 'none' }}>
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
            {modal.discoveryContent && <div style={{ marginTop: 14, color: '#d0c8ba', fontSize: 14, lineHeight: 1.7, whiteSpace: 'pre-line' }}>{modal.discoveryContent}</div>}
            {(modal.discoveryTitle || modal.discoveryDesc) && <div style={{ marginTop: 10, padding: '12px 14px', borderRadius: 8, background: 'rgba(214,163,94,0.1)', border: '1px solid rgba(214,163,94,0.15)', color: '#d0a050' }}>{modal.discoveryTitle && <div style={{ fontWeight: 600, marginBottom: 4 }}>{modal.discoveryTitle}</div>}{modal.discoveryDesc && <div>{modal.discoveryDesc}</div>}</div>}
            {modal.actions && modal.actions.length > 0 && <div style={{ marginTop: 18, display: 'flex', gap: 10, flexWrap: 'wrap' }}>{modal.actions.map((a, i) => <GlimmerButton key={i} tone={a.tone as any} onClick={a.onClick}>{a.label}</GlimmerButton>)}</div>}
          </GlassPanel>
        </div>
      )}
    </div>
  );
}
