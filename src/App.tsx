import { useEffect, useMemo, useRef, useState, MouseEvent } from 'react';
import BlankPainterChat from './components/BlankPainterChat';
import { bridgeArtistClues, clueOrder, locationOrder, locations, type ClueId, type LocationId } from './data/verticalSlice';
import type { DialogueEvaluationResult } from './systems/npcStateEngine';
import { useGameStore } from './store/gameStore';

type Point = { x: number; y: number };
type ModalAction = { label: string; tone?: 'primary' | 'danger' | 'default'; onClick: () => void };
type ModalState = { title: string; content: string; actions?: ModalAction[] } | null;
type EntityId = 'painter' | ClueId;

type Entity = {
  id: EntityId;
  label: string;
  type: 'npc' | 'clue';
  pos: Point;
  color: string;
  icon: string;
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

export default function App() {
  const save = useGameStore(state => state.save);
  const collectClue = useGameStore(state => state.collectClue);
  const setCurrentLocation = useGameStore(state => state.setCurrentLocation);
  const evaluateDialogue = useGameStore(state => state.evaluateDialogue);
  const completeNpcSuccess = useGameStore(state => state.completeNpcSuccess);
  const failNpc = useGameStore(state => state.failNpc);
  const resetSave = useGameStore(state => state.resetSave);

  const [playerPos, setPlayerPos] = useState<Point>(locations[save.currentLocation].spawn);
  const [isDragging, setIsDragging] = useState(false);
  const [mapPos, setMapPos] = useState({ x: -320, y: -160 });
  const [modal, setModal] = useState<ModalState>(null);
  const [activeChat, setActiveChat] = useState<null | 'painter'>(null);
  const [ghostFlash, setGhostFlash] = useState<string | null>(null);
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

  useEffect(() => {
    focusCameraOnPlayer(playerPos);

    const onResize = () => focusCameraOnPlayer(playerPos);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();

      if (key === 'escape' && activeChat) {
        setActiveChat(null);
        return;
      }

      if (key === 'escape' && modal) {
        setModal(null);
        return;
      }

      if (modal || activeChat) return;

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
  }, [modal, activeChat, nearbyEntity]);

  useEffect(() => {
    let frame = 0;

    const tick = () => {
      if (!modal && !activeChat) {
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
  }, [modal, activeChat]);

  const handleMouseDown = (e: MouseEvent) => {
    setIsDragging(true);
    hasMoved.current = false;
    dragStart.current = { x: e.clientX - mapPos.x, y: e.clientY - mapPos.y };
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;

    hasMoved.current = true;
    setMapPos({
      x: clamp(e.clientX - dragStart.current.x, window.innerWidth - MAP_WIDTH, 0),
      y: clamp(e.clientY - dragStart.current.y, window.innerHeight - MAP_HEIGHT, 0),
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleEntityClick = (e: MouseEvent, entity: Entity) => {
    e.stopPropagation();
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

  const openFailureModal = () => {
    setActiveChat(null);
    setModal({
      title: '失敗結局：空白被關上',
      content: '畫家最後看了你一眼。\n\n「連這最後的空白，你都不肯留給我嗎？」\n\n他收起畫布，走進天橋最暗的雨裡。Ghost System 已記錄：bridge_artist failed。',
    });
  };

  const openSuccessModal = () => {
    setModal({
      title: '成功結局：雨聲仍在',
      content: '他沒有重新看見色彩，也沒有立刻變好。\n\n但他終於放下畫筆，坐在失色畫廊的地上，聽見雨聲從遠處回來。\n\n「原來……不畫畫的時候，我也還在。」',
    });
  };

  const openInnerWorld = () => {
    if (!bridgeArtist.innerWorldUnlocked) {
      setModal({
        title: '心理世界尚未解鎖',
        content: `目前 Knowledge ${save.player.knowledge}/70，Trust ${bridgeArtist.trust}/50。還需要更多理解與信任。`,
      });
      return;
    }

    setActiveChat(null);
    setModal({
      title: '心理世界：失色畫廊',
      content: '你推開一扇沒有把手的門。畫廊裡所有作品都只剩灰階，牆壁像被雨水浸透的紙。畫家站在中央，手裡握著那支乾涸的畫筆。\n\n這裡不是要把色彩還給他，而是讓他知道：沒有色彩的他，也仍然存在。',
      actions: [
        {
          label: '陪他坐下，聽雨聲',
          tone: 'primary',
          onClick: () => {
            completeNpcSuccess('bridge_artist');
            openSuccessModal();
          },
        },
        {
          label: '要求他畫出春天',
          tone: 'danger',
          onClick: () => {
            failNpc('bridge_artist');
            openFailureModal();
          },
        },
      ],
    });
  };

  const handleDialogueEvaluated = (playerInput: string): DialogueEvaluationResult => {
    return evaluateDialogue('bridge_artist', playerInput);
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

      setActiveChat('painter');
      return;
    }

    const result = collectClue(targetId);
    const clue = bridgeArtistClues[targetId];
    maybeTriggerGhost();

    setModal({
      title: `獲得線索：${result.label}`,
      content: `${clue.content}\n\n情緒詞典浮現：${clue.dictionaryHint}${result.unlockedNow ? '\n\n天橋盡頭傳來一聲很輕的門軸聲。某個通往內心深處的入口，似乎鬆動了。' : ''}`,
    });
  };

  const playerScreen = isoToScreen(playerPos);
  const traumaFilter = save.ghosts.length > 0 ? 'grayscale(0.22) contrast(0.95)' : 'none';

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        position: 'relative',
        overflow: 'hidden',
        cursor: isDragging ? 'grabbing' : 'grab',
        background: '#080a0d',
        filter: traumaFilter,
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div style={{
        position: 'absolute', top: 20, left: 20, zIndex: 100,
        background: 'rgba(0,0,0,0.85)', padding: '15px', color: 'white',
        borderRadius: '8px', border: '1px solid #555', width: '250px',
      }}>
        <h3 style={{ margin: '0 0 10px 0', borderBottom: '1px solid #555', paddingBottom: '5px', fontSize: '14px' }}>
          提燈筆記
        </h3>
        <div style={{ fontSize: 13, lineHeight: 1.7, color: '#bbb' }}>
          {bridgeArtist.innerWorldUnlocked ? '天橋盡頭出現了微弱的門縫光。' : '雨聲仍很密，故事還沒有拼合。'}<br />
          {bridgeArtist.ending === 'success' && <span style={{ color: '#b8ffd6' }}>畫家終於聽見了雨聲。</span>}
          {bridgeArtist.ending === 'failed' && <span style={{ color: '#ffd0d0' }}>天橋上留下了一道殘影。</span>}
        </div>
        <h3 style={{ margin: '12px 0 8px 0', borderBottom: '1px solid #555', paddingBottom: '5px', fontSize: '14px' }}>
          線索
        </h3>
        <ul style={{ margin: 0, paddingLeft: '20px', color: '#aaa', fontSize: '13px', lineHeight: 1.6 }}>
          {save.collectedClues.length === 0 && <li>尚未收集</li>}
          {save.collectedClues.map(clueId => <li key={clueId}>{clueName(clueId)}</li>)}
        </ul>
        {save.ghosts.length > 0 && (
          <div style={{ marginTop: 12, color: '#ffb0b0', fontSize: 12, lineHeight: 1.5 }}>
            Ghost：{save.ghosts.length} 個殘影正在城市雨中徘徊。
          </div>
        )}
        <button
          onClick={resetSave}
          style={{ marginTop: 12, background: '#202329', color: '#aaa', border: '1px solid #444', borderRadius: 6, padding: '6px 10px', cursor: 'pointer', fontSize: 12 }}
        >
          重置進度
        </button>
      </div>

      <div style={{
        position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 110,
        display: 'flex', gap: 8, padding: 8,
        background: 'rgba(0,0,0,0.72)', border: '1px solid #333', borderRadius: 999,
      }}>
        {locationOrder.map(locationId => (
          <button
            key={locationId}
            onClick={() => handleLocationChange(locationId)}
            style={{
              background: save.currentLocation === locationId ? '#7a5130' : '#191b20',
              color: save.currentLocation === locationId ? '#fff' : '#aaa',
              border: save.currentLocation === locationId ? '1px solid #d6a35e' : '1px solid #333',
              borderRadius: 999,
              padding: '7px 12px',
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            {locations[locationId].name}
          </button>
        ))}
      </div>

      <div style={{
        position: 'absolute', top: 20, right: 20, zIndex: 100,
        background: 'rgba(0,0,0,0.72)', padding: '12px 16px', color: '#bbb',
        borderRadius: '8px', border: '1px solid #333', fontSize: '13px', lineHeight: 1.7,
        pointerEvents: 'none', maxWidth: 310,
      }}>
        <strong style={{ color: '#eee' }}>{currentLocation.name}</strong> · {currentLocation.subtitle}<br />
        {currentLocation.ambient}<br />
        WASD / 方向鍵：移動<br />
        E / Space：互動
      </div>

      {nearbyEntity && !modal && !activeChat && (
        <div style={{
          position: 'absolute', bottom: 34, left: '50%', transform: 'translateX(-50%)',
          zIndex: 100, color: '#f4d99d', fontSize: '14px', pointerEvents: 'none',
          background: 'rgba(0,0,0,0.72)', border: '1px solid rgba(244,217,157,0.28)',
          borderRadius: 999, padding: '8px 16px',
        }}>
          按 E 觀察：{nearbyEntity.label}
        </div>
      )}

      {ghostFlash && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 250,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#ffd0d0', background: 'rgba(80,0,0,0.16)',
          textShadow: '0 0 18px rgba(255,80,80,0.9)',
          fontSize: 24, letterSpacing: 2, pointerEvents: 'none',
        }}>
          {ghostFlash}
        </div>
      )}

      <div style={{
        position: 'absolute',
        transform: `translate(${mapPos.x}px, ${mapPos.y}px)`,
        width: MAP_WIDTH,
        height: MAP_HEIGHT,
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(circle at 45% 35%, rgba(45,55,65,0.95), rgba(5,7,10,1) 70%)',
        }} />

        <div style={{
          position: 'absolute',
          left: ORIGIN_X - 920,
          top: ORIGIN_Y - 90,
          width: 1840,
          height: 1840,
          transform: 'rotateX(60deg) rotateZ(-45deg)',
          transformOrigin: 'center center',
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px),
            radial-gradient(circle at 50% 50%, rgba(120,140,160,0.16), rgba(30,34,40,0.86) 58%, rgba(10,12,16,0.96) 100%)
          `,
          backgroundSize: '96px 96px, 96px 96px, cover',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 0 90px rgba(0,0,0,0.85) inset',
        }} />

        <div style={{
          position: 'absolute', top: 58, left: '50%', transform: 'translateX(-50%)',
          width: 720, textAlign: 'center', pointerEvents: 'none', userSelect: 'none',
        }}>
          <div style={{
            color: 'rgba(255,255,255,0.16)', fontSize: '28px', letterSpacing: '8px',
            fontWeight: 'bold',
          }}>
            {currentLocation.name}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.28)', fontSize: 13, lineHeight: 1.7, marginTop: 10 }}>
            {currentLocation.description}
          </div>
        </div>

        {entities.map(entity => {
          const screen = isoToScreen(entity.pos);
          const isNear = nearbyEntity?.id === entity.id;

          return (
            <button
              key={entity.id}
              onClick={(e) => handleEntityClick(e, entity)}
              style={{
                position: 'absolute',
                left: screen.left,
                top: screen.top,
                transform: 'translate(-50%, -100%)',
                width: entity.type === 'npc' ? 64 : 48,
                height: entity.type === 'npc' ? 84 : 48,
                border: `2px solid ${entity.color}`,
                borderRadius: entity.type === 'npc' ? '36px 36px 18px 18px' : '50%',
                background: entity.type === 'npc' ? 'rgba(255,170,51,0.12)' : 'rgba(255,255,255,0.08)',
                color: entity.color,
                cursor: 'pointer',
                zIndex: Math.round(screen.top),
                boxShadow: isNear ? `0 0 36px ${entity.color}` : `0 0 18px ${entity.color}55`,
                fontWeight: 'bold',
                userSelect: 'none',
                transition: 'box-shadow 0.18s, transform 0.18s',
              }}
              title={entity.label}
            >
              <div style={{ fontSize: entity.type === 'npc' ? 18 : 14 }}>{entity.icon}</div>
              <div style={{ fontSize: 11, marginTop: 2 }}>{entity.label}</div>
            </button>
          );
        })}

        <div style={{
          position: 'absolute',
          left: playerScreen.left,
          top: playerScreen.top,
          transform: 'translate(-50%, -100%)',
          width: 56,
          height: 86,
          zIndex: Math.round(playerScreen.top) + 5,
          pointerEvents: 'none',
        }}>
          <div style={{
            position: 'absolute', left: '50%', bottom: 4, transform: 'translateX(-50%)',
            width: 86, height: 34,
            background: 'radial-gradient(ellipse, rgba(0,0,0,0.5), transparent 68%)',
          }} />
          <div style={{
            position: 'absolute', left: '50%', bottom: 22, transform: 'translateX(-50%)',
            width: 44, height: 52,
            borderRadius: '22px 22px 14px 14px',
            background: 'linear-gradient(#263341, #10151d)',
            border: '1px solid rgba(255,255,255,0.18)',
            boxShadow: '0 0 28px rgba(116,180,255,0.22)',
          }} />
          <div style={{
            position: 'absolute', left: '50%', bottom: 68, transform: 'translateX(-50%)',
            width: 26, height: 26, borderRadius: '50%',
            background: '#c8d4df',
            border: '1px solid rgba(255,255,255,0.42)',
          }} />
          <div style={{
            position: 'absolute', right: -4, bottom: 30,
            width: 16, height: 24, borderRadius: 8,
            background: 'rgba(255,217,132,0.86)',
            boxShadow: '0 0 34px rgba(255,206,103,0.8)',
          }} />
        </div>
      </div>

      {activeChat === 'painter' && (
        <BlankPainterChat
          inventory={save.collectedClues}
          knowledge={save.player.knowledge}
          npcState={bridgeArtist}
          onClose={() => setActiveChat(null)}
          onDialogueEvaluated={handleDialogueEvaluated}
          onEnterInnerWorld={openInnerWorld}
          onEndingTriggered={openFailureModal}
        />
      )}

      {modal && (
        <div
          style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            zIndex: 260, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.6)',
          }}
          onClick={() => setModal(null)}
        >
          <div
            style={{
              background: '#17191d', padding: '30px', borderRadius: '10px',
              color: 'white', width: '520px', border: '1px solid #555',
              boxShadow: '0 10px 40px rgba(0,0,0,0.9)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <h2 style={{ marginTop: 0, color: '#eee', fontSize: '18px' }}>{modal.title}</h2>
            <p style={{ lineHeight: 1.8, color: '#ccc', whiteSpace: 'pre-line', fontSize: '15px' }}>
              {modal.content}
            </p>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
              {modal.actions?.map(action => (
                <button
                  key={action.label}
                  onClick={action.onClick}
                  style={{
                    background: action.tone === 'primary' ? '#8a5b2d' : action.tone === 'danger' ? '#5a2528' : '#333',
                    color: 'white',
                    border: action.tone === 'primary' ? '1px solid #d6a35e' : action.tone === 'danger' ? '1px solid #a84c55' : '1px solid #555',
                    padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '14px',
                  }}
                >
                  {action.label}
                </button>
              ))}
              <button
                onClick={() => setModal(null)}
                style={{
                  background: '#333', color: 'white', border: '1px solid #555',
                  padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '14px',
                }}
              >
                關閉
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
