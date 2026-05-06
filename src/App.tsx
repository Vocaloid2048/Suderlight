import { useEffect, useMemo, useRef, useState, MouseEvent } from 'react';
import BlankPainterChat from './components/BlankPainterChat';


type Point = { x: number; y: number };
type ModalState = { title: string; content: string } | null;

type Entity = {
  id: 'painter' | 'brush' | 'newspaper';
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

const initialState = {
  inventory: [] as string[],
  discoveredClues: [] as string[],
};

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

export default function App() {
  const [gameState, setGameState] = useState(initialState);
  const [playerPos, setPlayerPos] = useState<Point>({ x: 10, y: 9 });
  const [isDragging, setIsDragging] = useState(false);
  const [mapPos, setMapPos] = useState({ x: -320, y: -160 });
  const [modal, setModal] = useState<ModalState>(null);
  const [activeChat, setActiveChat] = useState<null | 'painter'>(null);
  const dragStart = useRef({ x: 0, y: 0 });

  const hasMoved = useRef(false);
  const keys = useRef(new Set<string>());

  const entities = useMemo<Entity[]>(() => {
    const list: Entity[] = [
      {
        id: 'painter',
        label: '天橋畫家',
        type: 'npc',
        pos: { x: 13, y: 9 },
        color: '#ffaa33',
        icon: '畫',
      },
      {
        id: 'newspaper',
        label: '舊報紙',
        type: 'clue',
        pos: { x: 7, y: 12 },
        color: '#d8d8d8',
        icon: '紙',
      },
    ];

    if (!gameState.inventory.includes('brush')) {
      list.push({
        id: 'brush',
        label: '乾涸的畫筆',
        type: 'clue',
        pos: { x: 15, y: 6 },
        color: '#ffffff',
        icon: '筆',
      });
    }

    return list;
  }, [gameState.inventory]);

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

  const interact = (targetId: Entity['id']) => {
    if (targetId === 'painter') {
      setActiveChat('painter');
      return;
    }


    if (targetId === 'brush' && !gameState.inventory.includes('brush')) {
      setGameState(prev => ({ ...prev, inventory: [...prev.inventory, 'brush'] }));
      setModal({
        title: '獲得線索：乾涸的畫筆',
        content: '你在潮濕的後巷角落找到了一支畫筆。筆尖已經乾硬，像一段被迫停下來的句子。\n\n（背包已更新。）',
      });
      return;
    }

    if (targetId === 'newspaper' && !gameState.inventory.includes('newspaper')) {
      setGameState(prev => ({ ...prev, inventory: [...prev.inventory, 'newspaper'] }));
      setModal({
        title: '獲得線索：舊報紙',
        content: '報紙被雨水泡皺了，只剩下一角還能辨認：\n\n「天才青年畫家車禍後失去辨色能力……」\n\n（情緒詞典中出現了新的空白頁。）',
      });
    }
  };

  const playerScreen = isoToScreen(playerPos);

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        position: 'relative',
        overflow: 'hidden',
        cursor: isDragging ? 'grabbing' : 'grab',
        background: '#080a0d',
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div style={{
        position: 'absolute', top: 20, left: 20, zIndex: 100,
        background: 'rgba(0,0,0,0.85)', padding: '15px', color: 'white',
        borderRadius: '8px', border: '1px solid #555', minWidth: '180px',
        pointerEvents: 'none',
      }}>
        <h3 style={{ margin: '0 0 10px 0', borderBottom: '1px solid #555', paddingBottom: '5px', fontSize: '14px' }}>
          提燈背包
        </h3>
        <ul style={{ margin: 0, paddingLeft: '20px', color: '#aaa', fontSize: '13px' }}>
          {gameState.inventory.length === 0 && <li>空無一物</li>}
          {gameState.inventory.includes('brush') && <li>乾涸的畫筆</li>}
          {gameState.inventory.includes('newspaper') && <li>舊報紙</li>}
        </ul>
      </div>

      <div style={{
        position: 'absolute', top: 20, right: 20, zIndex: 100,
        background: 'rgba(0,0,0,0.72)', padding: '12px 16px', color: '#bbb',
        borderRadius: '8px', border: '1px solid #333', fontSize: '13px', lineHeight: 1.7,
        pointerEvents: 'none',
      }}>
        WASD / 方向鍵：移動修復師<br />
        E / Space：與附近線索互動<br />
        滑鼠拖曳：臨時查看地圖
      </div>

      {nearbyEntity && !modal && (
        <div style={{
          position: 'absolute', bottom: 34, left: '50%', transform: 'translateX(-50%)',
          zIndex: 100, color: '#f4d99d', fontSize: '14px', pointerEvents: 'none',
          background: 'rgba(0,0,0,0.72)', border: '1px solid rgba(244,217,157,0.28)',
          borderRadius: 999, padding: '8px 16px',
        }}>
          按 E 觀察：{nearbyEntity.label}
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
          position: 'absolute', top: 60, left: '50%', transform: 'translateX(-50%)',
          color: 'rgba(255,255,255,0.15)', fontSize: '28px', letterSpacing: '8px',
          fontWeight: 'bold', pointerEvents: 'none', userSelect: 'none',
        }}>
          微 光 城 市
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
          inventory={gameState.inventory}
          onClose={() => setActiveChat(null)}
        />
      )}

      {modal && (
        <div
          style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.6)',
          }}
          onClick={() => setModal(null)}
        >
          <div
            style={{
              background: '#17191d', padding: '30px', borderRadius: '10px',
              color: 'white', width: '460px', border: '1px solid #555',
              boxShadow: '0 10px 40px rgba(0,0,0,0.9)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <h2 style={{ marginTop: 0, color: '#eee', fontSize: '18px' }}>{modal.title}</h2>
            <p style={{ lineHeight: 1.8, color: '#ccc', whiteSpace: 'pre-line', fontSize: '15px' }}>
              {modal.content}
            </p>
            <button
              onClick={() => setModal(null)}
              style={{
                background: '#333', color: 'white', border: '1px solid #555',
                padding: '8px 20px', borderRadius: '4px', cursor: 'pointer',
                marginTop: '10px', fontSize: '14px',
              }}
            >
              關閉
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
