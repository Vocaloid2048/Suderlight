import { MouseEvent, useEffect, useMemo, useRef, useState } from 'react';
import { GlimmerButton, GlassPanel } from '../components';
import { bridgeArtistClues, clueOrder, locationOrder, locations, type ClueId, type LocationId } from '../data/verticalSlice';
import type { CollectClueResult } from '../store/gameStore';
import type { GameSave } from '../systems/saveSystem';

type Point = { x: number; y: number };
type EntityId = 'painter' | ClueId;
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
            const next = {
              x: clamp(prev.x + (dx / length) * PLAYER_SPEED, 1, 22),
              y: clamp(prev.y + (dy / length) * PLAYER_SPEED, 1, 18),
            };
            focusCameraOnPlayer(next);
            return next;
          });
        }
      }

      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [modal]);

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
        <div style={{ position: 'absolute', top: 58, left: '50%', transform: 'translateX(-50%)', width: 720, textAlign: 'center', pointerEvents: 'none', userSelect: 'none' }}>
          <div style={{ color: 'rgba(255,255,255,0.16)', fontSize: 28, letterSpacing: 8, fontWeight: 'bold' }}>{currentLocation.name}</div>
          <div style={{ color: 'rgba(255,255,255,0.28)', fontSize: 13, lineHeight: 1.7, marginTop: 10 }}>{currentLocation.description}</div>
        </div>

        {entities.map(entity => {
          const screen = isoToScreen(entity.pos);
          const isNear = nearbyEntity?.id === entity.id;

          return (
            <button
              key={entity.id}
              onClick={event => handleEntityClick(event, entity)}
              style={{ position: 'absolute', left: screen.left, top: screen.top, transform: 'translate(-50%, -100%)', width: entity.type === 'npc' ? 64 : 48, height: entity.type === 'npc' ? 84 : 48, border: `2px solid ${entity.color}`, borderRadius: entity.type === 'npc' ? '36px 36px 18px 18px' : '50%', background: entity.type === 'npc' ? 'rgba(255,170,51,0.12)' : 'rgba(255,255,255,0.08)', color: entity.color, cursor: 'pointer', zIndex: Math.round(screen.top), boxShadow: isNear ? `0 0 36px ${entity.color}` : `0 0 18px ${entity.color}55`, fontWeight: 'bold', userSelect: 'none', transition: 'box-shadow 0.18s, transform 0.18s' }}
              title={entity.label}
            >
              <div style={{ fontSize: entity.type === 'npc' ? 18 : 14 }}>{entity.icon}</div>
              <div style={{ fontSize: 11, marginTop: 2 }}>{entity.label}</div>
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
