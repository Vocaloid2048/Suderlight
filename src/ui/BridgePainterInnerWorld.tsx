import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { GuiFrame, GlassPanel, GlimmerButton } from '../components';
import { useGameStore } from '../store/gameStore';
import {
  ALL_PSYCH_LAYERS,
  getPsychLayer,
  type PsychLayerData,
  type PsychInteractable,
  type UnderstandingReward,
  type LayerColorScheme,
} from '../data/psychologicalWorlds/bridgePainterWorld';
import {
  tryAddInsight,
  getInsightFragments,
  getCurrentLayerUnderstanding,
  hasInsight,
  type UnderstandingState,
} from '../systems/understandingSystem';
import { isPlaytestEnabled } from '../hooks/narrativePlaytest';
import accidentMemoryVideo from '../video/grok-video-5614ed35-6339-496a-bc6b-027280fb9c19.mp4';

// ============================================================
// Props
// ============================================================
type Props = {
  onReturnToSurface: (depth: number) => void;
  onAdvanceLayer?: (layer: number) => void;
};

// ============================================================
// 視圖狀態
// ============================================================
type LayerPhase =
  | { type: 'entering' }
  | { type: 'exploring' }
  | { type: 'observing'; target: PsychInteractable; showDeep: boolean }
  | { type: 'reflecting'; target: PsychInteractable }
  | { type: 'insight_revealed'; target: PsychInteractable; reward: UnderstandingReward }
  | { type: 'layer_complete' }
  | { type: 'arc_complete' };

// ============================================================
// 色調參數
// ============================================================
type SchemeColors = ReturnType<typeof getSchemeColors>;

function getSchemeColors(scheme: LayerColorScheme) {
  const map = {
    gold:   { accent:'#d4a35e', text:'#d8c29b', sub:'#b0a58b', cellEmpty:'rgba(255,255,255,0.02)', cellNorm:'rgba(255,255,255,0.04)', cellDisc:'rgba(255,255,255,0.06)', cellInsight:'linear-gradient(135deg, rgba(214,163,94,0.16), rgba(138,91,45,0.1))', border:'rgba(214,163,94,0.12)', gridBg:'radial-gradient(ellipse at center, rgba(45,36,22,0.5), rgba(18,14,10,0.85))' },
    cold:  { accent:'#6b9ec4', text:'#b0c8dd', sub:'#7a8fa0', cellEmpty:'rgba(160,180,200,0.03)', cellNorm:'rgba(160,180,200,0.05)', cellDisc:'rgba(160,180,200,0.08)', cellInsight:'linear-gradient(135deg, rgba(107,158,196,0.16), rgba(60,110,150,0.1))', border:'rgba(107,158,196,0.12)', gridBg:'radial-gradient(ellipse at center, rgba(12,22,35,0.5), rgba(4,8,14,0.88))' },
    faded: { accent:'#a89880', text:'#c8bca0', sub:'#8a7e6c', cellEmpty:'rgba(180,160,140,0.02)', cellNorm:'rgba(180,160,140,0.04)', cellDisc:'rgba(180,160,140,0.07)', cellInsight:'linear-gradient(135deg, rgba(168,152,128,0.12), rgba(130,110,80,0.08))', border:'rgba(168,152,128,0.1)', gridBg:'radial-gradient(ellipse at center, rgba(38,34,28,0.5), rgba(16,14,12,0.88))' },
    void:  { accent:'#b8a9c9', text:'#4a3f5c', sub:'#7a6e8a', cellEmpty:'rgba(200,180,220,0.04)', cellNorm:'rgba(200,180,220,0.06)', cellDisc:'rgba(200,180,220,0.1)', cellInsight:'linear-gradient(135deg, rgba(184,169,201,0.14), rgba(150,130,180,0.08))', border:'rgba(184,169,201,0.2)', gridBg:'rgba(245,243,248,0.5)' },
  };
  return map[scheme];
}

// ============================================================
// 心理世界飄浮文字與視覺化輔助組件
// ============================================================

const LAYER_FLOATING_TEXTS: Record<number, string[]> = {
  1: [
    "天才畫家。",
    "他的色彩像會呼吸。",
    "下一幅作品一定更驚人。",
    "沒有人比他更懂紅色。",
    "他的藍色讓人想起海。",
    "請在這裡簽名，老師。",
    "你是靠顏色活著的人。",
    "大家都在等你的下一幅畫。"
  ],
  2: [
    "不能看顏色了。",
    "不能畫畫了。",
    "我的作品毀了。",
    "為什麼是我？",
    "我以前不是這樣的。"
  ],
  3: [
    "沒有顏色的畫，算什麼畫？",
    "他們會失望的。",
    "我已經不是畫家了。",
    "不要簽名。",
    "空白至少不會出錯。"
  ],
  4: [
    "我一直在等顏色回來。",
    "可是我沒有等自己回來。",
    "我不是這樣的。",
    "如果我變了，我還值得被記住嗎？",
    "我能不能不是以前那個我，也繼續畫下去？"
  ]
};

const floatingTextStyle = `
@keyframes psychDrift {
  0% {
    transform: translate(0, 0) scale(0.9);
    opacity: 0;
  }
  15% {
    opacity: 0.55;
  }
  85% {
    opacity: 0.55;
  }
  100% {
    transform: translate(-30px, -45px) scale(1.05);
    opacity: 0;
  }
}
`;

function FloatingComments({ layerNum }: { layerNum: number }) {
  const texts = LAYER_FLOATING_TEXTS[layerNum] || [];
  const items = useMemo(() => {
    return Array.from({ length: 6 }).map((_, idx) => {
      const text = texts[idx % texts.length];
      const top = 5 + Math.random() * 85;
      const left = 3 + Math.random() * 70;
      const duration = 12 + Math.random() * 8;
      const delay = Math.random() * 10;
      const fontSize = 12 + Math.random() * 5;
      return { text, top, left, duration, delay, fontSize };
    });
  }, [layerNum, texts]);

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 1 }}>
      <style>{floatingTextStyle}</style>
      {items.map((item, index) => (
        <div
          key={`${layerNum}-${index}`}
          style={{
            position: 'absolute',
            top: `${item.top}%`,
            left: `${item.left}%`,
            color: 'rgba(255, 255, 255, 0.45)',
            fontSize: item.fontSize,
            fontStyle: 'italic',
            fontFamily: 'serif',
            letterSpacing: 2,
            whiteSpace: 'nowrap',
            textShadow: '0 0 10px rgba(255,255,255,0.15)',
            animation: `psychDrift ${item.duration}s linear ${item.delay}s infinite`,
            opacity: 0,
          }}
        >
          {item.text}
        </div>
      ))}
    </div>
  );
}

const PIN_COORDINATES: Record<string, { top: string; left: string }> = {
  // Layer 1 (Glory Museum)
  champion_painting: { top: '34%', left: '50%' },
  award_trophy: { top: '20%', left: '24%' },
  media_interview: { top: '23%', left: '78%' },
  audience_wall: { top: '70%', left: '28%' },
  signature_display: { top: '72%', left: '76%' },

  // Layer 2 (Accident Site)
  shattered_windshield: { top: '35%', left: '22%' },
  accident_newspaper: { top: '25%', left: '72%' },
  color_test_chart: { top: '65%', left: '16%' },
  broken_brush_scene: { top: '72%', left: '84%' },
  bridge_railing: { top: '80%', left: '50%' },

  // Layer 3 (Fading Studio)
  fading_canvas_series: { top: '22%', left: '28%' },
  unsent_withdrawal_letter: { top: '65%', left: '18%' },
  cracked_mirror: { top: '42%', left: '50%' },
  empty_tubes_pile: { top: '75%', left: '72%' },
  last_fan_letter: { top: '62%', left: '82%' },

  // Layer 4 (Blank Frame Chamber)
  the_empty_frame: { top: '44%', left: '50%' },
  echo_trophy: { top: '22%', left: '24%' },
  echo_broken_brush: { top: '22%', left: '76%' },
  new_canvas: { top: '68%', left: '78%' }
};

interface InteractivePinProps {
  icon: string;
  name: string;
  isCollected: boolean;
  isDiscovered: boolean;
  onClick: () => void;
  style: React.CSSProperties;
}

function InteractivePin({
  icon,
  name,
  isCollected,
  isDiscovered,
  onClick,
  style
}: InteractivePinProps) {
  return (
    <button
      onClick={onClick}
      style={{
        position: 'absolute',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        background: 'none',
        border: 'none',
        outline: 'none',
        zIndex: 10,
        transition: 'transform 0.2s ease',
        ...style
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'scale(1.15) translate(-43%, -43%)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'scale(1) translate(-50%, -50%)';
      }}
    >
      <div style={{
        width: 44,
        height: 44,
        borderRadius: '50%',
        background: isCollected 
          ? 'linear-gradient(135deg, rgba(255, 224, 130, 0.95), rgba(214, 163, 94, 0.95))' 
          : isDiscovered 
            ? 'rgba(255, 255, 255, 0.28)' 
            : 'rgba(255, 255, 255, 0.14)',
        border: `2px solid ${isCollected ? '#ffd54f' : 'rgba(255, 255, 255, 0.45)'}`,
        boxShadow: isCollected 
          ? '0 0 16px #ffd54f, inset 0 0 8px rgba(255,255,255,0.5)' 
          : '0 0 10px rgba(255,255,255,0.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 22,
        transition: 'all 0.3s ease'
      }}>
        {icon}
      </div>
      <div style={{
        marginTop: 6,
        color: isCollected ? '#ffd54f' : '#eee',
        fontSize: 11,
        fontWeight: 'bold',
        padding: '2px 8px',
        background: 'rgba(0, 0, 0, 0.72)',
        borderRadius: 12,
        border: '1px solid rgba(255, 255, 255, 0.18)',
        whiteSpace: 'nowrap',
        textShadow: isCollected ? '0 0 4px rgba(255,213,79,0.5)' : 'none'
      }}>
        {name}{isCollected && ' ✦'}
      </div>
    </button>
  );
}

function AccidentVideoPlaceholder({ children, layerNum }: { children: React.ReactNode; layerNum: number }) {
  const [videoEnded, setVideoEnded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  return (
    <div style={{
      width: 'min(95vw, 100%)',
      height: 'min(95vh, 100%)',
      borderRadius: 20,
      background: '#000',
      border: '1px solid rgba(107, 158, 196, 0.3)',
      boxShadow: '0 10px 30px rgba(0,0,0,0.8)',
      position: 'relative',
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      filter: videoEnded ? 'grayscale(100%)' : 'none',
      transition: 'filter 2.5s ease-in-out',
    }}>
      <video
        ref={videoRef}
        autoPlay
        muted
        controls
        onEnded={() => setVideoEnded(true)}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          opacity: 0.65
        }}
      >
        <source src={accidentMemoryVideo} type="video/mp4" />
      </video>

      <div style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: videoEnded ? 'rgba(0,0,0,0.55)' : 'rgba(12,22,35,0.4)',
        pointerEvents: 'none',
        zIndex: 1
      }}>
        {!videoEnded && (
          <div style={{
            position: 'absolute',
            top: 20,
            right: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'rgba(255,0,0,0.15)',
            border: '1px solid rgba(255,0,0,0.3)',
            padding: '4px 10px',
            borderRadius: 6,
            color: '#ff8a80',
            fontSize: 11,
            fontWeight: 'bold'
          }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ff3d00', display: 'inline-block' }} />
            車禍回憶畫面播映中...
          </div>
        )}
        {videoEnded && (
          <div style={{
            position: 'absolute',
            top: 20,
            right: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.2)',
            padding: '4px 10px',
            borderRadius: 6,
            color: '#bbb',
            fontSize: 11,
            fontWeight: 'bold'
          }}>
            🎥 播放結束 · 畫面定格（灰階）
          </div>
        )}

        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#6b9ec4" strokeWidth="1.5" style={{ opacity: 0.3, marginBottom: 12 }}>
          <path d="M23 7l-7 5 7 5V7z" />
          <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
        </svg>
        <div style={{ color: '#b0c8dd', fontSize: 13, opacity: 0.5, letterSpacing: 1.5 }}>
          【記憶影片投影區】
        </div>
      </div>

      {!videoEnded && (
        <button
          onClick={() => setVideoEnded(true)}
          style={{
            position: 'absolute',
            bottom: 20,
            left: 20,
            background: 'rgba(107,158,196,0.2)',
            border: '1px solid rgba(107,158,196,0.4)',
            color: '#b0c8dd',
            borderRadius: 6,
            padding: '4px 10px',
            fontSize: 11,
            cursor: 'pointer',
            zIndex: 5,
            transition: 'background 0.2s'
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(107,158,196,0.4)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(107,158,196,0.2)'}
        >
          ⏩ 模擬播放結束
        </button>
      )}

      {/* 漂浮心聲文字 */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none' }}>
        <FloatingComments layerNum={layerNum} />
      </div>

      {/* 讓交互按鈕浮在影片最上層 */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 3, pointerEvents: 'auto' }}>
        {children}
      </div>
    </div>
  );
}

function GloryMuseumVisual({ children, layerNum }: { children: React.ReactNode; layerNum: number }) {
  return (
    <div style={{
      width: 'min(95vw, 100%)',
      height: 'min(95vh, 100%)',
      borderRadius: 20,
      background: 'radial-gradient(circle at 50% 30%, rgba(120,92,48,0.45), rgba(22,16,10,0.98))',
      border: '1px solid rgba(214, 163, 94, 0.28)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      boxShadow: '0 10px 30px rgba(0,0,0,0.8)',
      overflow: 'hidden'
    }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 0%, rgba(255,230,180,0.16), transparent 55%)', pointerEvents: 'none' }} />

      {/* 美術館主展牆 */}
      <div style={{
        position: 'absolute',
        top: '10%',
        width: '58%',
        height: '52%',
        borderRadius: 16,
        background: 'linear-gradient(160deg, rgba(78,58,32,0.85), rgba(35,24,14,0.92))',
        border: '2px solid rgba(214,163,94,0.32)',
        boxShadow: '0 16px 36px rgba(0,0,0,0.45), inset 0 0 24px rgba(255,220,150,0.08)'
      }}>
        <div style={{ position: 'absolute', inset: 18, border: '2px solid rgba(245,213,141,0.24)', borderRadius: 12 }} />
      </div>

      {/* 左右聚光氛圍（去除格子感） */}
      <div style={{ position: 'absolute', left: '6%', top: '12%', width: '26%', height: '48%', borderRadius: '50%', background: 'radial-gradient(circle at center, rgba(255,230,170,0.16), rgba(255,230,170,0.02) 65%, transparent 75%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', right: '6%', top: '12%', width: '26%', height: '48%', borderRadius: '50%', background: 'radial-gradient(circle at center, rgba(255,230,170,0.16), rgba(255,230,170,0.02) 65%, transparent 75%)', pointerEvents: 'none' }} />

      {/* 掌聲與媒體氛圍 */}
      <div style={{ position: 'absolute', bottom: '10%', left: '50%', transform: 'translateX(-50%)', color: 'rgba(255,220,160,0.42)', fontSize: 12, letterSpacing: 3, fontStyle: 'italic', userSelect: 'none', pointerEvents: 'none' }}>
        掌聲不息 · 媒體聚焦 · 榮耀陳列
      </div>

      {/* 漂浮心聲文字 */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 4, pointerEvents: 'none' }}>
        <FloatingComments layerNum={layerNum} />
      </div>

      {/* 交互點 */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 5, pointerEvents: 'auto' }}>
        {children}
      </div>
    </div>
  );
}

function WhiteCanvasVisual({ children, layerNum }: { children: React.ReactNode; layerNum: number }) {
  return (
    <div style={{
      width: 'min(95vw, 100%)',
      height: 'min(95vh, 100%)',
      borderRadius: 20,
      background: 'radial-gradient(circle at center, rgba(38,34,28,0.7), rgba(16,14,12,0.98))',
      border: '1px solid rgba(168, 152, 128, 0.25)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      boxShadow: '0 10px 30px rgba(0,0,0,0.8)'
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', width: '100%', height: '100%', justifyContent: 'center' }}>
        {/* Easel Stand */}
        <div style={{ width: 14, height: '72%', background: 'linear-gradient(to bottom, #5c4033, #3d2b1f)', position: 'absolute', top: '5%', transform: 'rotate(-3deg)', zIndex: 1 }} />
        <div style={{ width: '38%', height: 16, background: '#3d2b1f', borderRadius: 8, position: 'absolute', top: '58%', zIndex: 3, boxShadow: '0 4px 8px rgba(0,0,0,0.6)' }} />
        
        {/* Canvas */}
        <div style={{
          width: '55%',
          height: '58%',
          background: '#fcfcfc',
          border: '8px solid #8d6e63',
          borderRadius: 5,
          boxShadow: '0 16px 32px rgba(0,0,0,0.65)',
          zIndex: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'absolute',
          top: '8%',
          transform: 'rotate(-1deg)'
        }}>
          <div style={{ width: '100%', height: '100%', border: '1px solid rgba(0,0,0,0.05)', background: 'linear-gradient(135deg, #ffffff, #f7f7f7)' }} />
        </div>
        
        {/* Silhouette */}
        <div style={{
          width: '10%',
          height: '20%',
          background: 'linear-gradient(to top, rgba(0,0,0,0.9), rgba(40,35,30,0.45))',
          borderRadius: '50% 50% 16px 12px',
          position: 'absolute',
          top: '46%',
          left: '24%',
          zIndex: 4,
          filter: 'blur(1px)',
          transform: 'rotate(-8deg)'
        }} title="坐在畫架前的畫家" />
      </div>
      
      {/* 漂浮心聲文字 */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 4, pointerEvents: 'none' }}>
        <FloatingComments layerNum={layerNum} />
      </div>

      {/* 讓交互按鈕浮在畫布最上層 */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 5, pointerEvents: 'auto' }}>
        {children}
      </div>
    </div>
  );
}

function GlowingCanvasVisual({ children, layerNum }: { children: React.ReactNode; layerNum: number }) {
  const [isColored, setIsColored] = useState(false);
  useEffect(() => {
    const interval = setInterval(() => {
      setIsColored(true);
      setTimeout(() => {
        setIsColored(false);
      }, 2500);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{
      width: 'min(95vw, 100%)',
      height: 'min(95vh, 100%)',
      borderRadius: 20,
      background: 'radial-gradient(circle at center, rgba(30,25,35,0.7), rgba(8,6,12,0.98))',
      border: '1px solid rgba(184, 169, 201, 0.25)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      boxShadow: '0 10px 30px rgba(0,0,0,0.8)'
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', width: '100%', height: '100%', justifyContent: 'center' }}>
        {/* Easel Stand */}
        <div style={{ width: 16, height: '72%', background: 'linear-gradient(to bottom, #422a1d, #251811)', position: 'absolute', top: '5%', transform: 'rotate(-2deg)', zIndex: 1 }} />
        <div style={{ width: '40%', height: 18, background: '#251811', borderRadius: 9, position: 'absolute', top: '58%', zIndex: 3, boxShadow: '0 5px 10px rgba(0,0,0,0.6)' }} />
        
        {/* Canvas */}
        <div style={{
          width: '58%',
          height: '58%',
          background: isColored ? 'linear-gradient(135deg, #1e88e5, #1565c0)' : '#555555',
          border: '9px solid #8d6e63',
          borderRadius: 6,
          boxShadow: isColored 
            ? '0 0 80px rgba(30, 136, 229, 0.95), 0 16px 36px rgba(0,0,0,0.7)' 
            : '0 16px 32px rgba(0,0,0,0.65)',
          zIndex: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'absolute',
          top: '8%',
          transform: 'rotate(1deg)',
          transition: 'background 1.5s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 1.5s ease',
        }}>
          <div style={{
            position: 'absolute',
            color: isColored ? '#ffffff' : '#aaaaaa',
            fontSize: 12,
            fontWeight: 'bold',
            letterSpacing: 2.5,
            textShadow: isColored ? '0 0 10px rgba(255,255,255,0.8)' : 'none',
            transition: 'color 1s ease',
            userSelect: 'none',
            pointerEvents: 'none'
          }}>
            {isColored ? '【靈魂的蔚藍】' : '【安靜的灰色】'}
          </div>
        </div>
        
        {/* Silhouette */}
        <div style={{
          width: '9%',
          height: '20%',
          background: 'linear-gradient(to top, rgba(0,0,0,0.92), rgba(20,15,30,0.65))',
          borderRadius: '50% 50% 14px 12px',
          position: 'absolute',
          top: '46%',
          left: '25%',
          zIndex: 4,
          filter: 'blur(1px)',
          transform: 'rotate(-4deg)',
        }} title="在畫架前的畫家" />
      </div>
      
      {/* 漂浮心聲文字 */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 4, pointerEvents: 'none' }}>
        <FloatingComments layerNum={layerNum} />
      </div>

      {/* 讓交互按鈕浮在空白畫框最上層 */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 5, pointerEvents: 'auto' }}>
        {children}
      </div>
    </div>
  );
}

// ============================================================
// 主組件
// ============================================================
export default function BridgePainterInnerWorld({ onReturnToSurface, onAdvanceLayer }: Props) {
  const [layerNum, setLayerNum] = useState<number>(1);
  const save = useGameStore(s => s.save);
  const trust = save?.npcs?.bridge_artist?.trust ?? 20;
  const resistance = 100 - trust;
  const isAllLayersUnlocked = resistance <= 50; // trust >= 50 (心防解開臨界點)
  const [understanding, setUnderstanding] = useState<UnderstandingState>(() => ({ insightIds: [] }));
  const [phase, setPhase] = useState<LayerPhase>({ type: 'entering' });
  const [discoveredIds, setDiscoveredIds] = useState<string[]>([]);

  const layer = useMemo(() => getPsychLayer(layerNum)!, [layerNum]);
  const colors = getSchemeColors(layer.colorScheme);
  const score = useMemo(() => getCurrentLayerUnderstanding(understanding, layerNum), [understanding, layerNum]);
  const thresholdMet = score >= layer.nextLayerThreshold && layer.nextLayerThreshold > 0;
  const isLast = layerNum >= 4;

  const handleEnter = useCallback(() => setPhase({ type: 'exploring' }), []);

  const handleClickObject = useCallback((obj: PsychInteractable) => {
    setDiscoveredIds(prev => prev.includes(obj.id) ? prev : [...prev, obj.id]);
    setPhase({ type: 'observing', target: obj, showDeep: false });
  }, []);

  const handleLookCloser = useCallback(() => {
    if (phase.type === 'observing') setPhase({ type: 'observing', target: phase.target, showDeep: true });
  }, [phase]);

  const handleStartReflection = useCallback(() => {
    if (phase.type === 'observing') setPhase({ type: 'reflecting', target: phase.target });
  }, [phase]);

  const handleChooseReflection = useCallback((choseInsight: boolean) => {
    if (phase.type !== 'reflecting') return;
    const { state: newU, reward } = tryAddInsight(understanding, phase.target.id, choseInsight, layerNum);
    if (!reward) { setPhase({ type: 'exploring' }); return; }
    setUnderstanding(newU);
    setPhase({ type: 'insight_revealed', target: phase.target, reward });
  }, [phase, understanding, layerNum]);

  const handleCloseInsight = useCallback(() => setPhase({ type: 'exploring' }), []);

  const handleLayerComplete = useCallback(() => {
    if (onAdvanceLayer) onAdvanceLayer(layerNum);
    if (isLast) { setPhase({ type: 'arc_complete' }); return; }
    setLayerNum(layerNum + 1);
    setUnderstanding({ insightIds: [] });
    setDiscoveredIds([]);
    setPhase({ type: 'entering' });
  }, [layerNum, isLast, onAdvanceLayer]);

  const handleArcComplete = useCallback(() => {
    if (onAdvanceLayer) onAdvanceLayer(4);
    onReturnToSurface(3);
  }, [onReturnToSurface, onAdvanceLayer]);

  const handleReturn = useCallback(() => onReturnToSurface(Math.min(layerNum, 3)), [layerNum, onReturnToSurface]);

  const insightCount = understanding.insightIds.length;
  const insightFragments = getInsightFragments(understanding);
  const showLayerCompleteBtn = phase.type === 'exploring' && (
    thresholdMet || (isLast && insightCount >= 3)
  );
  const isModalOpen = phase.type !== 'exploring';

  // ---- 進入畫面 ----
  if (phase.type === 'entering') {
    return (
      <GuiFrame tone="inner">
        <div style={{ position:'relative',zIndex:2,height:'100%',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:48 }}>
          <GlassPanel title={`第${['一','二','三','四'][layerNum-1]}層`} subtitle={layer.layerName} variant="warm" style={{ maxWidth:640,width:'100%',textAlign:'center' }}>
            <div style={{ color:colors.sub,fontSize:13,fontStyle:'italic',lineHeight:1.8,marginBottom:20,padding:'10px 16px',borderRadius:8,background:'rgba(0,0,0,0.25)' }}>{layer.emotionalForeword}</div>
            <div style={{ color:colors.text,fontSize:15,lineHeight:2.2,whiteSpace:'pre-line',marginBottom:28 }}>{layer.sceneDescription}</div>
            <GlimmerButton tone="primary" onClick={handleEnter}>進入{layer.layerName}</GlimmerButton>
          </GlassPanel>
        </div>
      </GuiFrame>
    );
  }

  // ---- 層級完成 ----
  if (phase.type === 'layer_complete') {
    return (
      <GuiFrame tone="inner">
        <div style={{ position:'relative',zIndex:2,height:'100%',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:48 }}>
          <GlassPanel title="理解達成" subtitle={layer.layerName} variant="paper" style={{ maxWidth:560,width:'100%',textAlign:'center' }}>
            <div style={{ color:'#3a2a14',fontSize:15,lineHeight:2,fontStyle:'italic',marginBottom:12 }}>「{layer.playerUnderstanding}」</div>
            <div style={{ color:'#6a5a3a',fontSize:13,lineHeight:1.8,marginBottom:24,padding:'10px 14px',borderRadius:8,background:'rgba(214,163,94,0.08)' }}>你已獲得 {insightCount} 個理解片段，理解了這一層的核心。</div>
            <GlimmerButton tone="primary" onClick={handleLayerComplete} fullWidth>{isLast ? '走向終章' : '深入下一層'}</GlimmerButton>
          </GlassPanel>
        </div>
      </GuiFrame>
    );
  }

  // ---- 弧線完成 ----
  if (phase.type === 'arc_complete') {
    return (
      <GuiFrame tone="inner">
        <div style={{ position:'relative',zIndex:2,height:'100%',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:48 }}>
          <GlassPanel title="情感弧線完成" subtitle="Success → Trauma → Identity Collapse → Acceptance" variant="paper" style={{ maxWidth:600,width:'100%',textAlign:'center' }}>
            <div style={{ color:'#3a2a14',fontSize:20,fontWeight:600,lineHeight:2,marginBottom:8 }}>你走完了天橋畫家的整個情感弧線。</div>
            <div style={{ color:'#5a4328',fontSize:15,lineHeight:2.2,fontStyle:'italic',whiteSpace:'pre-line',marginBottom:8 }}>從榮耀的囚籠，到創傷的雨夜，{'\n'}從身分的崩解，到空白中的接納。</div>
            <div style={{ color:'#4a3620',fontSize:14,lineHeight:1.9,marginBottom:24,padding:'12px 16px',borderRadius:10,background:'rgba(214,163,94,0.1)',border:'1px solid rgba(214,163,94,0.15)' }}>他的畫框始終是空白的——但現在你知道，那不是空缺，那是完成。</div>
            <GlimmerButton tone="primary" onClick={handleArcComplete} fullWidth>返回表世界</GlimmerButton>
          </GlassPanel>
        </div>
      </GuiFrame>
    );
  }

  // ---- 探索畫面 ----
  const CH = ['一','二','三','四'];
  const layerAtmoText = (n:number) => {
    switch(n){case 1:return '金色燈光照亮空蕩的大廳。\n所有的榮耀都像被保鮮膜包著——完美，但無法觸碰。';case 2:return '灰色的雨，永遠下著。\n空氣中沒有色彩——只剩下深淺不一的灰。';case 3:return '灰塵在光線中懸浮。\n畫布上的顏色，正一點一點地消失。';case 4:return '純白的虛空。沒有邊界，沒有重力——只有寂靜與完成。';default:return '';}
  };

  return (
    <GuiFrame tone="inner">
      <div style={{ position:'relative',zIndex:2,height:'100%',display:'grid',gridTemplateColumns:'270px 1fr',gap:20,padding:28 }}>
        {/* 左側欄 */}
        <aside style={{ display:'flex',flexDirection:'column',gap:14,overflowY:'auto',maxHeight:'calc(100vh - 100px)' }}>
          <GlassPanel title={`第${CH[layerNum-1]}層`} subtitle={layer.layerName} variant={layer.colorScheme==='void'?'paper':'warm'} contentStyle={{ display:'flex',flexDirection:'column',gap:12 }}>
            <div style={{ color:colors.sub,fontSize:13,lineHeight:1.9,whiteSpace:'pre-line' }}>{layerAtmoText(layerNum)}</div>
            {layer.nextLayerThreshold > 0 && (
              <div style={{ marginTop:4 }}>
                <div style={{ display:'flex',justifyContent:'space-between',fontSize:11,color:colors.sub,marginBottom:4 }}><span>理解深度</span><span>{score}/{layer.nextLayerThreshold}</span></div>
                <div style={{ width:'100%',height:4,borderRadius:2,background:colors.cellEmpty,overflow:'hidden' }}>
                  <div style={{ width:`${Math.min(100,(score/layer.nextLayerThreshold)*100)}%`,height:'100%',borderRadius:2,background:`linear-gradient(90deg, ${colors.accent}, ${colors.accent}88)`,transition:'width 0.5s ease' }}/>
                </div>
              </div>
            )}
            {isLast && (
              <div style={{ marginTop:4 }}>
                <div style={{ display:'flex',justifyContent:'space-between',fontSize:11,color:colors.sub,marginBottom:4 }}><span>理解深度</span><span>{insightCount}/{layer.interactables.length} 個片段</span></div>
                <div style={{ width:'100%',height:4,borderRadius:2,background:colors.cellEmpty,overflow:'hidden' }}>
                  <div style={{ width:`${Math.min(100,(insightCount/layer.interactables.length)*100)}%`,height:'100%',borderRadius:2,background:`linear-gradient(90deg, ${colors.accent}, ${colors.accent}88)`,transition:'width 0.5s ease' }}/>
                </div>
              </div>
            )}
            {/* 層級指示器 */}
            <div style={{ display:'flex',gap:6,justifyContent:'center',marginTop:4 }}>
              {[1,2,3,4].map(n => (
                <div key={n} style={{ width:10,height:10,borderRadius:'50%',background:n===layerNum?colors.accent:n<layerNum?`${colors.accent}55`:colors.cellEmpty,border:n===layerNum?`2px solid ${colors.accent}`:`1px solid ${colors.accent}33`,transition:'all 0.3s ease' }} title={`Layer ${n}`}/>
              ))}
            </div>
          </GlassPanel>

          {/* 心防狀態面板 */}
          <GlassPanel title="心理狀態" subtitle="天橋畫家" variant={isAllLayersUnlocked ? 'paper' : 'dark'} contentStyle={{ display:'flex',flexDirection:'column',gap:8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: colors.sub }}>
              <span>當前心防抗拒值</span>
              <span style={{ color: isAllLayersUnlocked ? '#81c784' : colors.accent, fontWeight: 'bold' }}>
                {isAllLayersUnlocked ? '已瓦解 (≤50%)' : `${resistance}%`}
              </span>
            </div>
            <div style={{ width: '100%', height: 6, borderRadius: 3, background: colors.cellEmpty, overflow: 'hidden' }}>
              <div style={{
                width: `${resistance}%`,
                height: '100%',
                borderRadius: 3,
                background: isAllLayersUnlocked ? 'linear-gradient(90deg, #66bb6a, #43a047)' : `linear-gradient(90deg, ${colors.accent}, #e53935)`,
                transition: 'width 0.5s ease'
              }} />
            </div>
            <div style={{ fontSize: 11, color: colors.sub, marginTop: 4, lineHeight: 1.4 }}>
              {isAllLayersUnlocked 
                ? '✨ 他的心防已經瓦解，你現在可以自由穿梭並探索全部四層心理世界。' 
                : `🚪 當抗拒值降低到 50% 或以下時（目前：${resistance}%），將會解鎖全部的心理世界。`}
            </div>
          </GlassPanel>

          {insightCount > 0 && (
            <GlassPanel title="理解碎片" subtitle={`${insightCount} 個片段`} variant="paper" contentStyle={{ display:'flex',flexDirection:'column',gap:10 }}>
              {insightFragments.map((f,i) => (
                <div key={i} style={{ padding:'10px 12px',borderRadius:8,background:'rgba(214,163,94,0.1)',border:'1px solid rgba(214,163,94,0.18)',color:'#4a3620',fontSize:13,lineHeight:1.7,fontStyle:'italic' }}>「{f}」</div>
              ))}
            </GlassPanel>
          )}

          <div style={{ display:'flex',flexDirection:'column',gap:8,marginTop:'auto' }}>
            {showLayerCompleteBtn && (
              <GlimmerButton tone="primary" onClick={() => setPhase({ type:'layer_complete' })} fullWidth>深入理解 →</GlimmerButton>
            )}
            <GlimmerButton tone="quiet" onClick={handleReturn} fullWidth>返回表世界</GlimmerButton>
          </div>
        </aside>

        {/* 右側主區域 */}
        <main style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          opacity: isModalOpen ? 0.3 : 1,
          pointerEvents: isModalOpen ? 'none' : 'auto',
          transition: 'opacity 0.3s ease',
          height: '100%',
          overflow: 'hidden',
          flex: 1
        }}>

          {/* 第一到四層：居中放大地圖式探索 */}
          <div style={{ position: 'relative', width: '100%', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {layerNum === 1 && (
                <GloryMuseumVisual layerNum={layerNum}>
                  {layer.interactables.map(obj => {
                    const coord = PIN_COORDINATES[obj.id] || { top: '50%', left: '50%' };
                    const isDisc = discoveredIds.includes(obj.id);
                    const hasIn = hasInsight(understanding, obj.id);
                    return (
                      <InteractivePin
                        key={obj.id}
                        icon={getIcon(obj.id)}
                        name={obj.name}
                        isCollected={hasIn}
                        isDiscovered={isDisc}
                        onClick={() => handleClickObject(obj)}
                        style={{ top: coord.top, left: coord.left, transform: 'translate(-50%, -50%)' }}
                      />
                    );
                  })}
                </GloryMuseumVisual>
              )}

              {layerNum === 2 && (
                <AccidentVideoPlaceholder layerNum={layerNum}>


                  {layer.interactables.map(obj => {
                    const coord = PIN_COORDINATES[obj.id] || { top: '50%', left: '50%' };
                    const isDisc = discoveredIds.includes(obj.id);
                    const hasIn = hasInsight(understanding, obj.id);
                    return (
                      <InteractivePin
                        key={obj.id}
                        icon={getIcon(obj.id)}
                        name={obj.name}
                        isCollected={hasIn}
                        isDiscovered={isDisc}
                        onClick={() => handleClickObject(obj)}
                        style={{ top: coord.top, left: coord.left, transform: 'translate(-50%, -50%)' }}
                      />
                    );
                  })}
                </AccidentVideoPlaceholder>
              )}
              {layerNum === 3 && (
                <WhiteCanvasVisual layerNum={layerNum}>

                  {layer.interactables.map(obj => {
                    const coord = PIN_COORDINATES[obj.id] || { top: '50%', left: '50%' };
                    const isDisc = discoveredIds.includes(obj.id);
                    const hasIn = hasInsight(understanding, obj.id);
                    return (
                      <InteractivePin
                        key={obj.id}
                        icon={getIcon(obj.id)}
                        name={obj.name}
                        isCollected={hasIn}
                        isDiscovered={isDisc}
                        onClick={() => handleClickObject(obj)}
                        style={{ top: coord.top, left: coord.left, transform: 'translate(-50%, -50%)' }}
                      />
                    );
                  })}
                </WhiteCanvasVisual>
              )}
              {layerNum === 4 && (
                <GlowingCanvasVisual layerNum={layerNum}>

                  {layer.interactables.map(obj => {
                    const coord = PIN_COORDINATES[obj.id] || { top: '50%', left: '50%' };
                    const isDisc = discoveredIds.includes(obj.id);
                    const hasIn = hasInsight(understanding, obj.id);
                    return (
                      <InteractivePin
                        key={obj.id}
                        icon={getIcon(obj.id)}
                        name={obj.name}
                        isCollected={hasIn}
                        isDiscovered={isDisc}
                        onClick={() => handleClickObject(obj)}
                        style={{ top: coord.top, left: coord.left, transform: 'translate(-50%, -50%)' }}
                      />
                    );
                  })}
                </GlowingCanvasVisual>
              )}
            </div>

          {/* 快速層級切換 */}
          <div style={{ position: 'absolute', bottom: 14, left: '50%', transform: 'translateX(-50%)', zIndex: 8, display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center', width: 'calc(100% - 28px)', maxWidth: 600, padding: '6px 12px', background: 'rgba(255,255,255,0.06)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)', backdropFilter: 'blur(2px)' }}>
            <span style={{ fontSize: 13, color: '#f5c16c', fontWeight: 'bold', letterSpacing: 1 }}>
              {isAllLayersUnlocked ? '心防徹底解鎖：自由切換層級' : '層級切換'}
            </span>
            <div style={{ display: 'flex', gap: 16, width: '100%', justifyContent: 'center' }}>
              {[1, 2, 3, 4].map(num => (
                <GlimmerButton
                  key={num}
                  tone={layerNum === num ? 'primary' : 'ghost'}
                  onClick={() => {
                    setLayerNum(num as number);
                    setUnderstanding({ insightIds: [] });
                    setDiscoveredIds([]);
                    setPhase({ type: 'exploring' });
                  }}
                  style={{ fontSize: 15, padding: '10px 32px', minHeight: 44, borderRadius: 10, flex: 1, maxWidth: 160 }}
                >
                  第{CH[num-1]}層
                </GlimmerButton>
              ))}
            </div>
          </div>
        </main>

        {/* 模態 */}
        {isModalOpen && <div onClick={handleCloseInsight} style={{ position:'absolute',inset:0,zIndex:3,background:'rgba(0,0,0,0.35)' }}/>}

        {(phase.type==='observing'||phase.type==='reflecting') && (
          <ObservingPanel phase={phase} colors={colors} onLookCloser={handleLookCloser} onStartReflection={handleStartReflection} onChooseReflection={handleChooseReflection} />
        )}

        {phase.type==='insight_revealed' && (
          <InsightPanel phase={phase} colors={colors} onClose={handleCloseInsight} />
        )}
      </div>
    </GuiFrame>
  );
}

// ============================================================
// 輔助函數
// ============================================================
function getIcon(id: string): string {
  const m: Record<string,string> = {
    champion_painting:'🎨',award_trophy:'🏆',media_interview:'📰',audience_wall:'💬',signature_display:'✍️',
    shattered_windshield:'🪟',accident_newspaper:'📰',color_test_chart:'🔬',broken_brush_scene:'🖌️',bridge_railing:'🌉',
    fading_canvas_series:'🖼️',unsent_withdrawal_letter:'✉️',cracked_mirror:'🪞',empty_tubes_pile:'🎨',last_fan_letter:'💌',
    the_empty_frame:'🖼️',echo_trophy:'✨',echo_broken_brush:'✨',new_canvas:'🖌️',
  };
  return m[id]??'📦';
}

// ============================================================
// 觀察面板子組件
// ============================================================
function ObservingPanel({ phase, colors, onLookCloser, onStartReflection, onChooseReflection }: {
  phase: LayerPhase & { type: 'observing'|'reflecting' };
  colors: SchemeColors;
  onLookCloser: () => void;
  onStartReflection: () => void;
  onChooseReflection: (choseInsight: boolean) => void;
}) {
  const target = phase.target;
  const showDeep = phase.type==='reflecting' ? true : (phase as {showDeep:boolean}).showDeep;
  return (
    <GlassPanel title={target.name} subtitle={phase.type==='reflecting'?'你的想法是…':'觀察'} variant="warm"
      style={{ position:'absolute',right:48,top:'50%',transform:'translateY(-50%)',zIndex:4,width:380,maxHeight:'80vh',overflowY:'auto' }}>
      <div style={{ color:colors.text,fontSize:14,lineHeight:1.9,whiteSpace:'pre-line',marginBottom:16 }}>{target.surfaceInfo}</div>
      {showDeep && <div style={{ marginTop:0,marginBottom:16,padding:'14px 16px',borderRadius:10,background:'rgba(0,0,0,0.35)',border:`1px solid ${colors.accent}22`,color:colors.text,fontSize:13.5,lineHeight:2,whiteSpace:'pre-line' }}>{target.deepMessage}</div>}
      <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
        {!showDeep && <GlimmerButton tone="primary" onClick={onLookCloser} fullWidth>仔細觀察</GlimmerButton>}
        {showDeep && phase.type==='observing' && <GlimmerButton tone="primary" onClick={onStartReflection} fullWidth>思考一下…</GlimmerButton>}
        {phase.type==='reflecting' && (
          <>
            <GlimmerButton tone="ghost" onClick={() => onChooseReflection(false)} fullWidth>{target.reflectionChoices[0]?.text??'…'}</GlimmerButton>
            <GlimmerButton tone="primary" onClick={() => onChooseReflection(true)} fullWidth>{target.reflectionChoices[1]?.text??'…'}</GlimmerButton>
          </>
        )}
      </div>
    </GlassPanel>
  );
}

// ============================================================
// 洞察揭示面板子組件
// ============================================================
function InsightPanel({ phase, colors, onClose }: {
  phase: LayerPhase & { type:'insight_revealed' };
  colors: SchemeColors;
  onClose: () => void;
}) {
  const { target, reward } = phase;
  return (
    <GlassPanel title="理解片段" subtitle={target.name} variant="paper"
      style={{ position:'absolute',right:48,top:'50%',transform:'translateY(-50%)',zIndex:4,width:380 }}>
      <div style={{ padding:'16px 0',color:'#3a2a14',fontSize:15,lineHeight:2,fontStyle:'italic',textAlign:'center' }}>「{reward.reason}」</div>
      <div style={{ marginTop:8,padding:'10px 14px',borderRadius:8,background:'rgba(214,163,94,0.15)',border:'1px solid rgba(214,163,94,0.2)',color:'#5a4328',fontSize:12.5,lineHeight:1.7 }}>{target.insight}</div>
      <div style={{ marginTop:18 }}><GlimmerButton tone="primary" onClick={onClose} fullWidth>繼續探索</GlimmerButton></div>
    </GlassPanel>
  );
}
