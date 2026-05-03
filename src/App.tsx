import { useState, useRef, MouseEvent } from 'react';

const initialState = {
  inventory: [] as string[],
  discoveredClues: [] as string[]
};

export default function App() {
  const [gameState, setGameState] = useState(initialState);
  const [isDragging, setIsDragging] = useState(false);
  const [mapPos, setMapPos] = useState({ x: 0, y: 0 });
  const [modal, setModal] = useState<{ title: string; content: string } | null>(null);
  const dragStart = useRef({ x: 0, y: 0 });
  const hasMoved = useRef(false);

  const handleMouseDown = (e: MouseEvent) => {
    setIsDragging(true);
    hasMoved.current = false;
    dragStart.current = { x: e.clientX - mapPos.x, y: e.clientY - mapPos.y };
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;
    hasMoved.current = true;
    setMapPos({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y,
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleInteract = (e: MouseEvent, targetId: string) => {
    e.stopPropagation();
    if (hasMoved.current) return; // 拖曳時不觸發互動

    if (targetId === 'painter') {
      if (gameState.inventory.includes('brush')) {
        setModal({
          title: '天橋畫家',
          content: '畫家看到你手裡的畫筆，空洞的眼神閃過一絲波動...\n\n(準備進入裏世界！)',
        });
      } else {
        setModal({
          title: '天橋畫家',
          content: '他對著空氣不停地揮動畫筆，喃喃自語：「色彩...不見了...」',
        });
      }
    } else if (targetId === 'brush') {
      if (!gameState.inventory.includes('brush')) {
        setGameState(prev => ({ ...prev, inventory: [...prev.inventory, 'brush'] }));
        setModal({
          title: '獲得線索',
          content: '你在公廁角落找到了一支乾涸的畫筆。',
        });
      }
    }
  };

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        position: 'relative',
        overflow: 'hidden',
        cursor: isDragging ? 'grabbing' : 'grab',
        background: '#0a0c0f',
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* HUD 背包 */}
      <div style={{
        position: 'absolute', top: 20, left: 20, zIndex: 100,
        background: 'rgba(0,0,0,0.85)', padding: '15px', color: 'white',
        borderRadius: '8px', border: '1px solid #555', minWidth: '160px',
        pointerEvents: 'none',
      }}>
        <h3 style={{ margin: '0 0 10px 0', borderBottom: '1px solid #555', paddingBottom: '5px', fontSize: '14px' }}>
          🎒 提燈背包
        </h3>
        <ul style={{ margin: 0, paddingLeft: '20px', color: '#aaa', fontSize: '13px' }}>
          {gameState.inventory.length === 0 && <li>空無一物</li>}
          {gameState.inventory.includes('brush') && <li>🖌️ 乾涸的畫筆</li>}
        </ul>
      </div>

      {/* 操作提示 */}
      <div style={{
        position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
        zIndex: 100, color: '#666', fontSize: '13px', pointerEvents: 'none',
      }}>
        拖曳滑鼠移動地圖 · 點擊角色互動
      </div>

      {/* 可拖曳大地圖 */}
      <div style={{
        position: 'absolute',
        transform: `translate(${mapPos.x}px, ${mapPos.y}px)`,
        width: 2000,
        height: 1500,
      }}>
        {/* 地面格線裝飾 */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)
          `,
          backgroundSize: '80px 80px',
        }} />

        {/* 場景名稱 */}
        <div style={{
          position: 'absolute', top: 40, left: '50%', transform: 'translateX(-50%)',
          color: 'rgba(255,255,255,0.15)', fontSize: '28px', letterSpacing: '8px',
          fontWeight: 'bold', pointerEvents: 'none', userSelect: 'none',
        }}>
          微 光 城 市
        </div>

        {/* NPC：畫家 — 放在地圖中央偏左 */}
        <div
          onClick={(e) => handleInteract(e, 'painter')}
          style={{
            position: 'absolute', top: 600, left: 700,
            width: 72, height: 72,
            background: 'rgba(255, 120, 0, 0.15)',
            border: '2px solid orange',
            borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'orange', fontWeight: 'bold', fontSize: '13px',
            cursor: 'pointer',
            boxShadow: '0 0 24px rgba(255, 120, 0, 0.6)',
            userSelect: 'none',
            transition: 'box-shadow 0.2s',
          }}
          onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 0 40px rgba(255,120,0,0.9)')}
          onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 0 24px rgba(255,120,0,0.6)')}
        >
          畫家
        </div>

        {/* 線索：畫筆 — 放在畫家右上方 */}
        {!gameState.inventory.includes('brush') && (
          <div
            onClick={(e) => handleInteract(e, 'brush')}
            style={{
              position: 'absolute', top: 480, left: 900,
              width: 52, height: 52,
              background: 'rgba(255,255,255,0.08)',
              border: '2px dashed rgba(255,255,255,0.6)',
              borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '22px', cursor: 'pointer',
              boxShadow: '0 0 16px rgba(255,255,255,0.3)',
              userSelect: 'none',
              animation: 'pulse 2s infinite',
            }}
            title="有什麼東西..."
          >
            ✨
          </div>
        )}
      </div>

      {/* 互動對話框 */}
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
              background: '#1a1a1a', padding: '30px', borderRadius: '10px',
              color: 'white', width: '420px', border: '1px solid #555',
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

      <style>{`
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 16px rgba(255,255,255,0.3); }
          50% { box-shadow: 0 0 32px rgba(255,255,255,0.7); }
        }
      `}</style>
    </div>
  );
}
