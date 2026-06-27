// ============================================================
// NpcInnerWorld — 通用心理世界 UI
// 接收 npcId prop，動態從 registry 載入資料
// 對 npcId='bridge_artist' 完全沿用原有視覺；
// 其他 NPC 顯示「Coming Soon」佔位
// ============================================================

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { GuiFrame, GlassPanel, GlimmerButton } from '../components';
import { useGameStore } from '../store/gameStore';
import {
  getAllPsychLayers,
  getPsychLayerForNpc,
  type PsychLayerData,
  type PsychInteractable,
  type UnderstandingReward,
  type LayerColorScheme,
} from '../data/psychologicalWorlds/index';
import { getNpcDefinition } from '../data/npcs/registry';
import type { NpcId } from '../data/verticalSlice';
import {
  tryAddInsight,
  getInsightFragments,
  getCurrentLayerUnderstanding,
  hasInsight,
  type UnderstandingState,
} from '../systems/understandingSystem';
import {
  type InnerWorldSave,
  type InnerWorldLayerState,
  type UnderstoodItem,
} from '../systems/npcStateEngine';
import { isPlaytestEnabled } from '../hooks/narrativePlaytest';
import accidentMemoryVideo from '../video/grok-video-5614ed35-6339-496a-bc6b-027280fb9c19.mp4';

// ============================================================
// Props
// ============================================================
type Props = {
  onReturnToSurface: (depth: number) => void;
  onAdvanceLayer?: (layer: number) => void;
  /** 外部傳入：是否直接展示情感弧線失敗畫面 */
  arcFailure?: boolean;
  /** 弧線失敗畫面 → 查看心靈餘波匯報 */
  onOpenReport?: () => void;
  /** NPC ID，預設為 bridge_artist */
  npcId?: NpcId;
};

const STRESS_UNLOCK_BY_LAYER: Record<1 | 2 | 3 | 4, number> = {
  1: 100,
  2: 75,
  3: 55,
  4: 35,
};

function getLayerStressRequirement(layer: number): number {
  return STRESS_UNLOCK_BY_LAYER[layer as 1 | 2 | 3 | 4] ?? 100;
}

function isLayerUnlockedByStress(layer: number, stress: number): boolean {
  return stress <= getLayerStressRequirement(layer);
}

function getMaxUnlockedLayerByStress(stress: number): number {
  const unlocked = [1, 2, 3, 4].filter(layer => isLayerUnlockedByStress(layer, stress));
  return unlocked.length > 0 ? Math.max(...unlocked) : 1;
}

function stressColor(stress: number): string {
  if (stress <= 35) return '#66bb6a';
  if (stress <= 55) return '#ffc107';
  if (stress <= 75) return '#ff9800';
  return '#ef5350';
}

type LayerPhase =
  | { type: 'entering' }
  | { type: 'exploring' }
  | { type: 'observing'; target: PsychInteractable; showDeep: boolean }
  | { type: 'reflecting'; target: PsychInteractable }
  | { type: 'insight_revealed'; target: PsychInteractable; reward: UnderstandingReward }
  | { type: 'layer_complete' }
  | { type: 'arc_complete' };

type SchemeColors = ReturnType<typeof getSchemeColors>;

function getSchemeColors(scheme: LayerColorScheme) {
  const map = {
    gold:   { accent:'#d4a35e', text:'#d8c29b', sub:'#b0a58b', cellEmpty:'rgba(255,255,255,0.12)', cellNorm:'rgba(255,255,255,0.08)', cellDisc:'rgba(255,255,255,0.10)', cellInsight:'linear-gradient(135deg, rgba(214,163,94,0.16), rgba(138,91,45,0.1))', border:'rgba(214,163,94,0.12)', gridBg:'radial-gradient(ellipse at center, rgba(45,36,22,0.5), rgba(18,14,10,0.85))' },
    cold:  { accent:'#6b9ec4', text:'#b0c8dd', sub:'#7a8fa0', cellEmpty:'rgba(160,180,200,0.14)', cellNorm:'rgba(160,180,200,0.10)', cellDisc:'rgba(160,180,200,0.12)', cellInsight:'linear-gradient(135deg, rgba(107,158,196,0.16), rgba(60,110,150,0.1))', border:'rgba(107,158,196,0.12)', gridBg:'radial-gradient(ellipse at center, rgba(12,22,35,0.5), rgba(4,8,14,0.88))' },
    faded: { accent:'#a89880', text:'#c8bca0', sub:'#8a7e6c', cellEmpty:'rgba(180,160,140,0.12)', cellNorm:'rgba(180,160,140,0.08)', cellDisc:'rgba(180,160,140,0.10)', cellInsight:'linear-gradient(135deg, rgba(168,152,128,0.12), rgba(130,110,80,0.08))', border:'rgba(168,152,128,0.1)', gridBg:'radial-gradient(ellipse at center, rgba(38,34,28,0.5), rgba(16,14,12,0.88))' },
    void:  { accent:'#b8a9c9', text:'#d8cee8', sub:'#b0a0c8', cellEmpty:'rgba(184,169,201,0.16)', cellNorm:'rgba(184,169,201,0.10)', cellDisc:'rgba(184,169,201,0.14)', cellInsight:'linear-gradient(135deg, rgba(184,169,201,0.16), rgba(150,130,180,0.08))', border:'rgba(184,169,201,0.2)', gridBg:'rgba(30,25,40,0.5)' },
  };
  return map[scheme];
}

const floatingTextStyle = `
@keyframes psychDrift {
  0% { transform: translate(0, 0) scale(0.9); opacity: 0; }
  15% { opacity: 0.55; }
  85% { opacity: 0.55; }
  100% { transform: translate(-30px, -45px) scale(1.05); opacity: 0; }
}
`;

function FloatingComments({ layerNum, floatingTextsByLayer }: { layerNum: number; floatingTextsByLayer: Record<number, string[]> }) {
  const texts = floatingTextsByLayer[layerNum] || [];
  const items = useMemo(() => {
    return Array.from({ length: 6 }).map((_, idx) => {
      const text = texts[idx % texts.length] || '';
      return {
        text,
        top: 5 + Math.random() * 85,
        left: 3 + Math.random() * 70,
        duration: 12 + Math.random() * 8,
        delay: Math.random() * 10,
        fontSize: 12 + Math.random() * 5,
      };
    });
  }, [layerNum, texts]);

  if (texts.length === 0) return null;

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 1 }}>
      <style>{floatingTextStyle}</style>
      {items.map((item, index) => (
        <div key={`${layerNum}-${index}`} style={{ position: 'absolute', top: `${item.top}%`, left: `${item.left}%`, color: 'rgba(255, 255, 255, 0.45)', fontSize: item.fontSize, fontStyle: 'italic', fontFamily: 'serif', letterSpacing: 2, whiteSpace: 'nowrap', textShadow: '0 0 10px rgba(255,255,255,0.15)', animation: `psychDrift ${item.duration}s linear ${item.delay}s infinite`, opacity: 0 }}>
          {item.text}
        </div>
      ))}
    </div>
  );
}

interface InteractivePinProps {
  icon: string; name: string; isCollected: boolean; isDiscovered: boolean; onClick: () => void; style: React.CSSProperties;
}

function InteractivePin({ icon, name, isCollected, isDiscovered, onClick, style }: InteractivePinProps) {
  return (
    <button onClick={onClick} style={{ position: 'absolute', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'none', border: 'none', outline: 'none', zIndex: 10, transition: 'transform 0.2s ease', pointerEvents: 'auto', ...style }} onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.15) translate(-43%, -43%)'; }} onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1) translate(-50%, -50%)'; }}>
      <div style={{ width: 44, height: 44, borderRadius: '50%', background: isCollected ? 'linear-gradient(135deg, rgba(255, 224, 130, 0.95), rgba(214, 163, 94, 0.95))' : isDiscovered ? 'rgba(255, 255, 255, 0.28)' : 'rgba(255, 255, 255, 0.14)', border: `2px solid ${isCollected ? '#ffd54f' : 'rgba(255, 255, 255, 0.45)'}`, boxShadow: isCollected ? '0 0 16px #ffd54f, inset 0 0 8px rgba(255,255,255,0.5)' : '0 0 10px rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, transition: 'all 0.3s ease' }}>
        {icon}
      </div>
      <div style={{ marginTop: 6, color: isCollected ? '#ffd54f' : '#eee', fontSize: 11, fontWeight: 'bold', padding: '2px 8px', background: 'rgba(0, 0, 0, 0.72)', borderRadius: 12, border: '1px solid rgba(255, 255, 255, 0.18)', whiteSpace: 'nowrap', textShadow: isCollected ? '0 0 4px rgba(255,213,79,0.5)' : 'none' }}>
        {name}{isCollected && ' ✦'}
      </div>
    </button>
  );
}

// ---- Visual 組件（bridgePainter 原版；其他 NPC → Coming Soon）----

function ComingSoonVisual({ layerNum, npcId }: { layerNum: number; npcId: NpcId }) {
  return (
    <div style={{ width: 'min(95vw, 100%)', height: 'min(95vh, 100%)', borderRadius: 20, background: 'rgba(12,12,20,0.95)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
      <div style={{ textAlign: 'center', color: '#888' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🚧</div>
        <div style={{ fontSize: 18, color: '#aaa' }}>第{['一','二','三','四'][layerNum-1]}層</div>
        <div style={{ fontSize: 13, marginTop: 8, color: '#666' }}>（{npcId} 的心理世界尚未開放）</div>
      </div>
    </div>
  );
}

function MuseumTrophyArtifact({ isCollected, isDiscovered, onClick, style }: { isCollected: boolean; isDiscovered: boolean; onClick: () => void; style: React.CSSProperties }) {
  return (
    <button onClick={onClick} style={{ position: 'absolute', cursor: 'pointer', background: 'none', border: 'none', outline: 'none', zIndex: 10, transform: 'translate(-50%, -50%)', transition: 'transform 0.2s ease, filter 0.2s ease', pointerEvents: 'auto', ...style }} onMouseEnter={e => { e.currentTarget.style.transform = 'translate(-50%, -50%) scale(1.08)'; e.currentTarget.style.filter = 'brightness(1.08)'; }} onMouseLeave={e => { e.currentTarget.style.transform = 'translate(-50%, -50%) scale(1)'; e.currentTarget.style.filter = 'brightness(1)'; }} title="獲獎獎盃">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <div style={{ width: 58, height: 58, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34, background: isCollected ? 'radial-gradient(circle, rgba(255,244,180,0.98), rgba(232,185,74,0.92))' : isDiscovered ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.12)', border: `2px solid ${isCollected ? '#ffd54f' : 'rgba(255,255,255,0.35)'}`, boxShadow: isCollected ? '0 0 20px rgba(255,213,79,0.7), inset 0 0 10px rgba(255,255,255,0.5)' : '0 0 10px rgba(255,255,255,0.15)', transition: 'all 0.3s ease' }}>🏆</div>
        <div style={{ color: isCollected ? '#ffd54f' : '#ddd', fontSize: 11, fontWeight: 'bold', padding: '2px 8px', background: 'rgba(0,0,0,0.72)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.18)', whiteSpace: 'nowrap', textShadow: isCollected ? '0 0 6px rgba(255,213,79,0.6)' : 'none' }}>獲獎獎盃{isCollected && ' ✦'}</div>
      </div>
    </button>
  );
}

function AccidentVideoPlaceholder({ children, layerNum, floatingTextsByLayer }: { children: React.ReactNode; layerNum: number; floatingTextsByLayer: Record<number, string[]> }) {
  return (
    <div style={{ width: 'min(95vw, 100%)', height: 'min(95vh, 100%)', borderRadius: 20, background: 'radial-gradient(circle at 50% 55%, rgba(10,18,28,0.9), rgba(4,8,14,0.99))', border: '1px solid rgba(107, 158, 196, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', boxShadow: '0 10px 30px rgba(0,0,0,0.85)', overflow: 'hidden' }}>
      <video autoPlay loop muted playsInline style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.92 }}>
        <source src={accidentMemoryVideo} type="video/mp4" />
      </video>
      <div style={{ position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none' }}>
        <FloatingComments layerNum={layerNum} floatingTextsByLayer={floatingTextsByLayer} />
      </div>
      <div style={{ position: 'absolute', inset: 0, zIndex: 3, pointerEvents: 'auto' }}>{children}</div>
    </div>
  );
}

function GloryMuseumVisual({ children, layerNum, floatingTextsByLayer, onPaintingClick, isPaintingCollected, isPaintingDiscovered }: { children: React.ReactNode; layerNum: number; floatingTextsByLayer: Record<number, string[]>; onPaintingClick: () => void; isPaintingCollected: boolean; isPaintingDiscovered: boolean }) {
  return (
    <div style={{ width: 'min(95vw, 100%)', height: 'min(95vh, 100%)', borderRadius: 20, background: 'radial-gradient(circle at 50% 30%, rgba(120,92,48,0.45), rgba(22,16,10,0.98))', border: '1px solid rgba(214, 163, 94, 0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', boxShadow: '0 10px 30px rgba(0,0,0,0.8)', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 0%, rgba(255,230,180,0.16), transparent 55%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: '10%', width: '58%', height: '52%', borderRadius: 16, background: 'linear-gradient(160deg, rgba(78,58,32,0.85), rgba(35,24,14,0.92))', border: '2px solid rgba(214,163,94,0.32)', boxShadow: '0 16px 36px rgba(0,0,0,0.45), inset 0 0 24px rgba(255,220,150,0.08)' }}>
        <button onClick={onPaintingClick} style={{ position: 'absolute', inset: 18, border: isPaintingCollected ? '2px solid rgba(255, 221, 120, 0.75)' : '2px solid rgba(245,213,141,0.24)', borderRadius: 12, background: 'linear-gradient(140deg, rgba(248,243,234,0.96), rgba(239,232,218,0.94))', overflow: 'hidden', cursor: 'pointer', padding: 0, outline: 'none', boxShadow: isPaintingCollected ? '0 0 20px rgba(255, 209, 102, 0.35), inset 0 0 14px rgba(255,255,255,0.24)' : isPaintingDiscovered ? '0 0 0 1px rgba(255,255,255,0.16)' : 'none', transition: 'all 0.22s ease', zIndex: 3 }} onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.01)'; e.currentTarget.style.boxShadow = '0 0 16px rgba(255, 214, 130, 0.25), inset 0 0 12px rgba(255,255,255,0.18)'; }} onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = isPaintingCollected ? '0 0 20px rgba(255, 209, 102, 0.35), inset 0 0 14px rgba(255,255,255,0.24)' : isPaintingDiscovered ? '0 0 0 1px rgba(255,255,255,0.16)' : 'none'; }} title="獲獎畫作">
          <div style={{ position: 'absolute', inset: 0, opacity: 0.1, backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(56,42,23,0.35) 1px, transparent 1px)', backgroundSize: '8px 8px' }} />
          <div style={{ position: 'absolute', inset: '2% 2%', borderRadius: 10, background: 'linear-gradient(160deg, rgba(28,35,56,0.96), rgba(67,36,36,0.9) 48%, rgba(24,30,47,0.95))', boxShadow: 'inset 0 0 22px rgba(255,255,255,0.12)' }}>
            <div style={{ position: 'absolute', width: '72%', height: '46%', left: '7%', top: '12%', borderRadius: '60% 40% 58% 42%', transform: 'rotate(-9deg)', background: 'radial-gradient(circle at 38% 42%, rgba(116,197,255,0.95), rgba(39,127,224,0.88) 46%, rgba(23,74,156,0.75) 74%, rgba(12,34,82,0.35) 100%)', boxShadow: '0 0 18px rgba(65,145,235,0.35)' }} />
            <div style={{ position: 'absolute', width: '68%', height: '42%', right: '6%', bottom: '12%', borderRadius: '42% 58% 44% 56%', transform: 'rotate(11deg)', background: 'radial-gradient(circle at 55% 48%, rgba(255,142,142,0.94), rgba(226,59,59,0.9) 45%, rgba(166,27,27,0.78) 73%, rgba(79,9,9,0.32) 100%)', boxShadow: '0 0 18px rgba(220,70,70,0.32)' }} />
            <div style={{ position: 'absolute', width: '38%', height: '22%', left: '31%', top: '39%', borderRadius: '55% 45% 60% 40%', transform: 'rotate(-3deg)', background: 'radial-gradient(circle at 46% 50%, rgba(176,108,232,0.86), rgba(126,76,196,0.58), rgba(78,44,136,0.24), transparent 74%)', boxShadow: '0 0 14px rgba(146,88,214,0.35)' }} />
          </div>
          <div style={{ position: 'absolute', right: '5.5%', bottom: '5.5%', color: 'rgba(78,58,34,0.82)', fontSize: 11, letterSpacing: 1.1, fontWeight: 600, pointerEvents: 'none' }}>《紅與藍的和聲》</div>
        </button>
      </div>
      <div style={{ position: 'absolute', left: '50%', bottom: '16%', transform: 'translateX(-50%)', width: '78%', height: '22%', pointerEvents: 'none', zIndex: 2 }}>
        {[{ left: '4%', h: '56%', w: '4.8%' },{ left: '10%', h: '64%', w: '5.2%' },{ left: '17%', h: '58%', w: '5%' },{ left: '24%', h: '70%', w: '5.5%' },{ left: '31%', h: '60%', w: '5.1%' },{ left: '38%', h: '76%', w: '5.9%' },{ left: '46%', h: '63%', w: '5.2%' },{ left: '54%', h: '72%', w: '5.7%' },{ left: '62%', h: '58%', w: '5%' },{ left: '69%', h: '66%', w: '5.4%' },{ left: '76%', h: '61%', w: '5.1%' },{ left: '83%', h: '69%', w: '5.6%' },{ left: '90%', h: '57%', w: '4.8%' }].map((p, i) => (<div key={`front-${i}`} style={{ position: 'absolute', bottom: 0, left: p.left, width: p.w, height: p.h, background: 'linear-gradient(to top, rgba(8,7,10,0.94), rgba(34,30,36,0.8))', borderRadius: '46% 46% 12px 12px', filter: 'blur(0.35px)' }} />))}
        {[{ left: '8%', h: '48%', w: '4.2%' },{ left: '20%', h: '52%', w: '4.4%' },{ left: '33%', h: '50%', w: '4.3%' },{ left: '47%', h: '54%', w: '4.6%' },{ left: '61%', h: '49%', w: '4.2%' },{ left: '74%', h: '53%', w: '4.5%' },{ left: '86%', h: '47%', w: '4.2%' }].map((p, i) => (<div key={`back-${i}`} style={{ position: 'absolute', bottom: '18%', left: p.left, width: p.w, height: p.h, background: 'linear-gradient(to top, rgba(16,13,19,0.72), rgba(46,40,52,0.58))', borderRadius: '46% 46% 10px 10px', opacity: 0.92 }} />))}
      </div>
      <div style={{ position: 'absolute', left: '6%', top: '12%', width: '26%', height: '48%', borderRadius: '50%', background: 'radial-gradient(circle at center, rgba(255,230,170,0.16), rgba(255,230,170,0.02) 65%, transparent 75%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', right: '6%', top: '12%', width: '26%', height: '48%', borderRadius: '50%', background: 'radial-gradient(circle at center, rgba(255,230,170,0.16), rgba(255,230,170,0.02) 65%, transparent 75%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '10%', left: '50%', transform: 'translateX(-50%)', color: 'rgba(255,220,160,0.42)', fontSize: 12, letterSpacing: 3, fontStyle: 'italic', userSelect: 'none', pointerEvents: 'none' }}>掌聲不息 · 媒體聚焦 · 榮耀陳列</div>
      <div style={{ position: 'absolute', inset: 0, zIndex: 4, pointerEvents: 'none' }}>
        <FloatingComments layerNum={layerNum} floatingTextsByLayer={floatingTextsByLayer} />
      </div>
      <div style={{ position: 'absolute', inset: 0, zIndex: 5, pointerEvents: 'none' }}>{children}</div>
    </div>
  );
}

function WhiteCanvasVisual({ children, layerNum, floatingTextsByLayer }: { children: React.ReactNode; layerNum: number; floatingTextsByLayer: Record<number, string[]> }) {
  return (
    <div style={{ width: 'min(95vw, 100%)', height: 'min(95vh, 100%)', borderRadius: 20, background: 'radial-gradient(circle at center, rgba(38,34,28,0.7), rgba(16,14,12,0.98))', border: '1px solid rgba(168, 152, 128, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', boxShadow: '0 10px 30px rgba(0,0,0,0.8)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', width: '100%', height: '100%', justifyContent: 'center' }}>
        <div style={{ width: 14, height: '72%', background: 'linear-gradient(to bottom, #5c4033, #3d2b1f)', position: 'absolute', top: '5%', transform: 'rotate(-3deg)', zIndex: 1 }} />
        <div style={{ width: '38%', height: 16, background: '#3d2b1f', borderRadius: 8, position: 'absolute', top: '58%', zIndex: 3, boxShadow: '0 4px 8px rgba(0,0,0,0.6)' }} />
        <div style={{ width: '55%', height: '58%', background: '#fcfcfc', border: '8px solid #8d6e63', borderRadius: 5, boxShadow: '0 16px 32px rgba(0,0,0,0.65)', zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'absolute', top: '8%', transform: 'rotate(-1deg)' }}>
          <div style={{ width: '100%', height: '100%', border: '1px solid rgba(0,0,0,0.05)', background: 'linear-gradient(135deg, #ffffff, #f7f7f7)' }} />
        </div>
        <div style={{ width: '10%', height: '20%', background: 'linear-gradient(to top, rgba(0,0,0,0.9), rgba(40,35,30,0.45))', borderRadius: '50% 50% 16px 12px', position: 'absolute', top: '46%', left: '24%', zIndex: 4, filter: 'blur(1px)', transform: 'rotate(-8deg)' }} title="坐在畫架前的畫家" />
      </div>
      <div style={{ position: 'absolute', inset: 0, zIndex: 4, pointerEvents: 'none' }}>
        <FloatingComments layerNum={layerNum} floatingTextsByLayer={floatingTextsByLayer} />
      </div>
      <div style={{ position: 'absolute', inset: 0, zIndex: 5, pointerEvents: 'auto' }}>{children}</div>
    </div>
  );
}

function GlowingCanvasVisual({ children, layerNum, floatingTextsByLayer }: { children: React.ReactNode; layerNum: number; floatingTextsByLayer: Record<number, string[]> }) {
  const [isColored, setIsColored] = useState(false);
  useEffect(() => {
    const interval = setInterval(() => { setIsColored(true); setTimeout(() => { setIsColored(false); }, 2500); }, 6000);
    return () => clearInterval(interval);
  }, []);
  return (
    <div style={{ width: 'min(95vw, 100%)', height: 'min(95vh, 100%)', borderRadius: 20, background: 'radial-gradient(circle at center, rgba(30,25,35,0.7), rgba(8,6,12,0.98))', border: '1px solid rgba(184, 169, 201, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', boxShadow: '0 10px 30px rgba(0,0,0,0.8)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', width: '100%', height: '100%', justifyContent: 'center' }}>
        <div style={{ width: 16, height: '72%', background: 'linear-gradient(to bottom, #422a1d, #251811)', position: 'absolute', top: '5%', transform: 'rotate(-2deg)', zIndex: 1 }} />
        <div style={{ width: '40%', height: 18, background: '#251811', borderRadius: 9, position: 'absolute', top: '58%', zIndex: 3, boxShadow: '0 5px 10px rgba(0,0,0,0.6)' }} />
        <div style={{ width: '58%', height: '58%', background: isColored ? 'linear-gradient(135deg, #1e88e5, #1565c0)' : '#555555', border: '9px solid #8d6e63', borderRadius: 6, boxShadow: isColored ? '0 0 80px rgba(30, 136, 229, 0.95), 0 16px 36px rgba(0,0,0,0.7)' : '0 16px 32px rgba(0,0,0,0.65)', zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'absolute', top: '8%', transform: 'rotate(1deg)', transition: 'background 1.5s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 1.5s ease' }}>
          <div style={{ position: 'absolute', color: isColored ? '#ffffff' : '#aaaaaa', fontSize: 12, fontWeight: 'bold', letterSpacing: 2.5, textShadow: isColored ? '0 0 10px rgba(255,255,255,0.8)' : 'none', transition: 'color 1s ease', userSelect: 'none', pointerEvents: 'none' }}>{isColored ? '【靈魂的蔚藍】' : '【安靜的灰色】'}</div>
        </div>
        <div style={{ width: '9%', height: '20%', background: 'linear-gradient(to top, rgba(0,0,0,0.92), rgba(20,15,30,0.65))', borderRadius: '50% 50% 14px 12px', position: 'absolute', top: '46%', left: '25%', zIndex: 4, filter: 'blur(1px)', transform: 'rotate(-4deg)' }} title="在畫架前的畫家" />
      </div>
      <div style={{ position: 'absolute', inset: 0, zIndex: 4, pointerEvents: 'none' }}>
        <FloatingComments layerNum={layerNum} floatingTextsByLayer={floatingTextsByLayer} />
      </div>
      <div style={{ position: 'absolute', inset: 0, zIndex: 5, pointerEvents: 'auto' }}>{children}</div>
    </div>
  );
}

// ---- Icon map ----
function getIcon(id: string): string {
  const m: Record<string,string> = {
    champion_painting:'🎨',award_trophy:'🏆',media_interview:'📰',audience_wall:'💬',signature_display:'✍️',
    shattered_windshield:'🪟',accident_newspaper:'📰',color_test_chart:'🔬',broken_brush_scene:'🖌️',bridge_railing:'🌉',
    fading_canvas_series:'🖼️',unsent_withdrawal_letter:'✉️',cracked_mirror:'🪞',empty_tubes_pile:'🎨',last_fan_letter:'💌',
    the_empty_frame:'🖼️',echo_trophy:'✨',echo_broken_brush:'✨',new_canvas:'🖌️',
  };
  return m[id]??'📦';
}

function ObservingPanel({ phase, colors, onLookCloser, onStartReflection, onChooseReflection }: { phase: LayerPhase & { type: 'observing'|'reflecting' }; colors: SchemeColors; onLookCloser: () => void; onStartReflection: () => void; onChooseReflection: (choseInsight: boolean) => void; }) {
  const target = phase.target;
  const showDeep = phase.type==='reflecting' ? true : (phase as {showDeep:boolean}).showDeep;
  return (
    <GlassPanel title={target.name} subtitle={phase.type==='reflecting'?'你的想法是…':'觀察'} variant="warm" style={{ position:'absolute',left:'50%',top:'50%',transform:'translate(-50%, -50%)',zIndex:4,width:380,maxHeight:'80vh',overflowY:'auto' }}>
      <div style={{ color:colors.text,fontSize:14,lineHeight:1.9,whiteSpace:'pre-line',marginBottom:16 }}>{target.surfaceInfo}</div>
      {showDeep && <div style={{ marginTop:0,marginBottom:16,padding:'14px 16px',borderRadius:10,background:'rgba(0,0,0,0.35)',border:`1px solid ${colors.accent}22`,color:colors.text,fontSize:13.5,lineHeight:2,whiteSpace:'pre-line' }}>{target.deepMessage}</div>}
      <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
        {!showDeep && <GlimmerButton tone="primary" onClick={onLookCloser} fullWidth>仔細觀察</GlimmerButton>}
        {showDeep && phase.type==='observing' && <GlimmerButton tone="primary" onClick={onStartReflection} fullWidth>思考一下…</GlimmerButton>}
        {phase.type==='reflecting' && (<><GlimmerButton tone="ghost" onClick={() => onChooseReflection(false)} fullWidth>{target.reflectionChoices[0]?.text??'…'}</GlimmerButton><GlimmerButton tone="primary" onClick={() => onChooseReflection(true)} fullWidth>{target.reflectionChoices[1]?.text??'…'}</GlimmerButton></>)}
      </div>
    </GlassPanel>
  );
}

function InsightPanel({ phase, colors, onClose }: { phase: LayerPhase & { type:'insight_revealed' }; colors: SchemeColors; onClose: () => void; }) {
  const { target, reward } = phase;
  return (
    <GlassPanel title="理解片段" subtitle={target.name} variant="paper" style={{ position:'absolute',left:'50%',top:'50%',transform:'translate(-50%, -50%)',zIndex:4,width:380 }}>
      <div style={{ padding:'16px 0',color:'#3a2a14',fontSize:15,lineHeight:2,fontStyle:'italic',textAlign:'center' }}>「{reward.reason}」</div>
      <div style={{ marginTop:8,padding:'10px 14px',borderRadius:8,background:'rgba(214,163,94,0.15)',border:'1px solid rgba(214,163,94,0.2)',color:'#5a4328',fontSize:12.5,lineHeight:1.7 }}>{target.insight}</div>
      <div style={{ marginTop:18 }}><GlimmerButton tone="primary" onClick={onClose} fullWidth>繼續探索</GlimmerButton></div>
    </GlassPanel>
  );
}

// ============================================================
// 主組件
// ============================================================
export default function NpcInnerWorld({ onReturnToSurface, onAdvanceLayer, arcFailure, onOpenReport, npcId = 'bridge_artist' }: Props) {
  const npcDef = useMemo(() => getNpcDefinition(npcId), [npcId]);
  const psychLayers = useMemo(() => getAllPsychLayers(npcId), [npcId]);
  const { floatingTextsByLayer, pinCoordinates } = npcDef.visualRegistry;

  const save = useGameStore(s => s.save);
  const syncInnerWorldState = useGameStore(s => s.syncInnerWorldState);
  const stress = save?.npcs?.[npcId]?.stress ?? 100;
  const safeStress = Math.max(0, Math.min(100, stress));
  const maxUnlockedLayer = getMaxUnlockedLayerByStress(safeStress);
  const isAllLayersUnlocked = maxUnlockedLayer >= 4;
  const [layerLockMessage, setLayerLockMessage] = useState<string | null>(null);

  /** 追蹤內存世界中 savedInnerWorld 的版本，用於偵測外部修改（如 playtest unlock） */
  const prevInnerWorldRef = useRef<string>();

  const VISITED_KEY = `sud_${npcId}_inner_visited`;
  function loadVisitedLayers(): Set<number> {
    try {
      const raw = localStorage.getItem(VISITED_KEY);
      if (raw) { const arr: number[] = JSON.parse(raw); return new Set(arr.filter(n => n >= 1 && n <= 4)); }
    } catch { /* ignore */ }
    return new Set<number>();
  }
  const [visitedLayers, setVisitedLayers] = useState<Set<number>>(loadVisitedLayers);
  const initialVisited = loadVisitedLayers();
  const isReturnVisit = initialVisited.size > 0;

  function countCompletedFromSave(): number {
    const layers = save?.npcs?.[npcId]?.innerWorld?.layers;
    if (!layers) return 0;
    let count = 0;
    for (let l = 1; l <= 4; l++) { if (layers[l]?.completed) count++; }
    return count;
  }
  const completedCountInit = countCompletedFromSave();
  const nextLayerInit = completedCountInit + 1;
  const initialLayerNum = isReturnVisit ? (nextLayerInit <= 4 && initialVisited.has(nextLayerInit) ? nextLayerInit : Math.max(1, completedCountInit)) : 1;
  const [layerNum, setLayerNum] = useState<number>(initialLayerNum);
  const [phase, setPhase] = useState<LayerPhase>(isReturnVisit ? { type: 'exploring' } : { type: 'entering' });

  const markLayerVisited = useCallback((l: number) => {
    setVisitedLayers(prev => {
      if (prev.has(l)) return prev;
      const next = new Set(prev);
      next.add(l);
      try { localStorage.setItem(VISITED_KEY, JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  }, [VISITED_KEY]);

  useEffect(() => {
    if (isReturnVisit && phase.type === 'exploring') { markLayerVisited(layerNum); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const savedInnerWorld = save?.npcs?.[npcId]?.innerWorld;
  function loadUnderstandingFromSave(): Record<number, UnderstandingState> {
    const result: Record<number, UnderstandingState> = { 1: { insightIds: [] }, 2: { insightIds: [] }, 3: { insightIds: [] }, 4: { insightIds: [] } };
    if (savedInnerWorld?.layers) {
      for (const [layer, state] of Object.entries(savedInnerWorld.layers)) {
        const lNum = Number(layer);
        if (lNum >= 1 && lNum <= 4) result[lNum] = { insightIds: state.understoodItems.map(item => item.id) };
      }
    }
    return result;
  }
  function loadDiscoveredFromSave(): Record<number, string[]> {
    const result: Record<number, string[]> = { 1: [], 2: [], 3: [], 4: [] };
    if (savedInnerWorld?.layers) {
      for (const [layer, state] of Object.entries(savedInnerWorld.layers)) {
        const lNum = Number(layer);
        if (lNum >= 1 && lNum <= 4) result[lNum] = [...state.discoveredItems];
      }
    }
    return result;
  }
  function loadCompletedLayersFromSave(): Set<number> {
    const result = new Set<number>();
    if (savedInnerWorld?.layers) {
      for (const [layer, state] of Object.entries(savedInnerWorld.layers)) { if (state.completed) result.add(Number(layer)); }
    }
    return result;
  }
  const [understandingByLayer, setUnderstandingByLayer] = useState<Record<number, UnderstandingState>>(() => loadUnderstandingFromSave());
  const [discoveredByLayer, setDiscoveredByLayer] = useState<Record<number, string[]>>(() => loadDiscoveredFromSave());
  const [completedLayers, setCompletedLayers] = useState<Set<number>>(() => loadCompletedLayersFromSave());

  // 當 savedInnerWorld 被外部修改時（如 playtest unlock），重新初始化本地狀態
  useEffect(() => {
    const current = JSON.stringify(savedInnerWorld);
    if (current !== prevInnerWorldRef.current && prevInnerWorldRef.current !== undefined) {
      setUnderstandingByLayer(loadUnderstandingFromSave());
      setDiscoveredByLayer(loadDiscoveredFromSave());
      setCompletedLayers(loadCompletedLayersFromSave());
    }
    prevInnerWorldRef.current = current;
  }, [savedInnerWorld]); // eslint-disable-line react-hooks/exhaustive-deps

  const buildInnerWorldSave = useCallback((): InnerWorldSave => {
    const layers: Record<number, InnerWorldLayerState> = {};
    for (let l = 1; l <= 4; l++) {
      const layerData = psychLayers.find(ld => ld.layerNumber === l);
      layers[l] = {
        completed: completedLayers.has(l),
        understandingScore: getCurrentLayerUnderstanding(understandingByLayer[l] ?? { insightIds: [] }, l),
        understoodItems: (understandingByLayer[l]?.insightIds ?? []).map((id): UnderstoodItem => {
          const obj = layerData?.interactables.find(o => o.id === id);
          return { id, name: obj?.name ?? id, understandingReward: obj?.understandingReward ?? 0 };
        }),
        discoveredItems: discoveredByLayer[l] ?? [],
      };
    }
    const unlocked = [1, 2, 3, 4].filter(l => isLayerUnlockedByStress(l, safeStress));
    for (let l = 1; l <= 4; l++) { if (completedLayers.has(l) && l + 1 <= 4) { if (!unlocked.includes(l + 1)) unlocked.push(l + 1); } }
    return { unlockedLayers: [...new Set(unlocked)].sort(), layers };
  }, [understandingByLayer, discoveredByLayer, completedLayers, safeStress, psychLayers]);

  const syncToStore = useCallback(() => { syncInnerWorldState(buildInnerWorldSave()); }, [buildInnerWorldSave, syncInnerWorldState]);

  useEffect(() => { syncToStore(); }, [syncToStore, understandingByLayer, discoveredByLayer]); // eslint-disable-line react-hooks/exhaustive-deps

  const understanding = understandingByLayer[layerNum] ?? { insightIds: [] };
  const discoveredIds = discoveredByLayer[layerNum] ?? [];
  const layer = useMemo(() => psychLayers.find(l => l.layerNumber === layerNum)!, [layerNum, psychLayers]);
  const championPaintingObj = useMemo(() => layer?.interactables.find(o => o.id === 'champion_painting'), [layer]);
  const isChampionPaintingDiscovered = championPaintingObj ? discoveredIds.includes(championPaintingObj.id) : false;
  const isChampionPaintingCollected = championPaintingObj ? hasInsight(understanding, championPaintingObj.id) : false;
  const colors = useMemo(() => getSchemeColors(layer?.colorScheme ?? 'gold'), [layer]);
  const score = useMemo(() => getCurrentLayerUnderstanding(understanding, layerNum), [understanding, layerNum]);
  const thresholdMet = layer && score >= layer.nextLayerThreshold && layer.nextLayerThreshold > 0;
  const isLast = layerNum >= 4;

  const handleEnter = useCallback(() => { markLayerVisited(layerNum); setPhase({ type: 'exploring' }); }, [layerNum, markLayerVisited]);
  const handleClickObject = useCallback((obj: PsychInteractable) => { setDiscoveredByLayer(prev => { const current = prev[layerNum] ?? []; if (current.includes(obj.id)) return prev; return { ...prev, [layerNum]: [...current, obj.id] }; }); setPhase({ type: 'observing', target: obj, showDeep: false }); }, [layerNum]);
  const handleLookCloser = useCallback(() => { if (phase.type === 'observing') setPhase({ type: 'observing', target: phase.target, showDeep: true }); }, [phase]);
  const handleStartReflection = useCallback(() => { if (phase.type === 'observing') setPhase({ type: 'reflecting', target: phase.target }); }, [phase]);
  const handleChooseReflection = useCallback((choseInsight: boolean) => {
    if (phase.type !== 'reflecting') return;
    const { state: newU, reward } = tryAddInsight(understanding, phase.target.id, choseInsight, layerNum);
    if (!reward) { setPhase({ type: 'exploring' }); return; }
    setUnderstandingByLayer(prev => ({ ...prev, [layerNum]: newU }));
    setPhase({ type: 'insight_revealed', target: phase.target, reward });
  }, [phase, understanding, layerNum]);
  const handleCloseInsight = useCallback(() => setPhase({ type: 'exploring' }), []);
  const handleLayerComplete = useCallback(() => {
    if (onAdvanceLayer) onAdvanceLayer(layerNum);
    setCompletedLayers(prev => new Set([...prev, layerNum]));
    if (isLast) { setPhase({ type: 'arc_complete' }); return; }
    const nextL = layerNum + 1;
    if (!isLayerUnlockedByStress(nextL, safeStress)) { const required = getLayerStressRequirement(nextL); setLayerLockMessage(`第${['一','二','三','四'][nextL-1]}層尚未解鎖：需要恐懼值≤ ${required}（當前 ${safeStress}）。`); return; }
    setLayerNum(nextL);
    setPhase({ type: 'entering' });
  }, [layerNum, isLast, onAdvanceLayer, safeStress]);
  const handleArcComplete = useCallback(() => { if (onAdvanceLayer) onAdvanceLayer(4); onReturnToSurface(3); }, [onReturnToSurface, onAdvanceLayer]);
  const handleReturn = useCallback(() => { const cnt = completedLayers.size; return onReturnToSurface(Math.min(cnt, 3)); }, [completedLayers, onReturnToSurface]);

  const insightCount = understanding.insightIds.length;
  const insightFragments = getInsightFragments(understanding);
  const showLayerCompleteBtn = (phase.type === 'exploring' || phase.type === 'observing' || phase.type === 'reflecting' || phase.type === 'insight_revealed') && (thresholdMet || (isLast && insightCount >= 3));
  const isModalOpen = phase.type !== 'exploring' && phase.type !== 'entering' && phase.type !== 'layer_complete' && phase.type !== 'arc_complete';

  // 弧線失敗
  if (arcFailure) {
    return (
      <GuiFrame tone="inner">
        <div style={{ position:'relative',zIndex:2,height:'100%',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:48 }}>
          <GlassPanel title="情感弧線 — 斷裂" subtitle="Trust never built · Stress at threshold · Connection severed" variant="paper" style={{ maxWidth:600,width:'100%',textAlign:'center' }}>
            <div style={{ color:'#3a2a14',fontSize:20,fontWeight:600,lineHeight:2,marginBottom:8 }}>你沒能走完天橋畫家的情感弧線。</div>
            <div style={{ color:'#5a4328',fontSize:15,lineHeight:2.2,fontStyle:'italic',whiteSpace:'pre-line',marginBottom:8 }}>從懷疑到恐懼，從恐懼到崩潰。{'\n'}他沒有等到那個能走進他內心四個房間的人。</div>
            <div style={{ color:'#4a3620',fontSize:14,lineHeight:1.9,marginBottom:24,padding:'12px 16px',borderRadius:10,background:'rgba(214,163,94,0.1)',border:'1px solid rgba(214,163,94,0.15)' }}>天橋的雨還在落。他帶著最後一筆未完成的鉛筆線，走進雨夜最深處。{'\n'}恐懼值達到臨界，信任從未真正建立。{'\n'}空白畫布上的名字被雨水沖淡——城市的這一部分，繼續黯淡無光。</div>
            <GlimmerButton tone="primary" onClick={onOpenReport} fullWidth>查看心靈餘波匯報</GlimmerButton>
          </GlassPanel>
        </div>
      </GuiFrame>
    );
  }

  // 無世界資料（骨架 NPC）
  if (!layer) {
    return (
      <GuiFrame tone="inner">
        <div style={{ position:'relative',zIndex:2,height:'100%',display:'flex',alignItems:'center',justifyContent:'center',padding:48 }}>
          <GlassPanel title={`${npcDef.characterCard.displayName} 心理世界`} subtitle="Coming Soon" variant="dark" style={{ maxWidth:480,textAlign:'center' }}>
            <div style={{ color:'#888',fontSize:15,lineHeight:2 }}>此 NPC 的心理世界尚未開放。</div>
            <div style={{ marginTop:24 }}><GlimmerButton tone="quiet" onClick={() => onReturnToSurface(0)} fullWidth>返回表世界</GlimmerButton></div>
          </GlassPanel>
        </div>
      </GuiFrame>
    );
  }

  const CH = ['一','二','三','四'];
  const layerAtmoText = (n:number) => { switch(n){case 1:return '金色燈光照亮空蕩的大廳。\n所有的榮耀都像被保鮮膜包著——完美，但無法觸碰。';case 2:return '灰色的雨，永遠下著。\n空氣中沒有色彩——只剩下深淺不一的灰。';case 3:return '灰塵在光線中懸浮。\n畫布上的顏色，正一點一點地消失。';case 4:return '純白的虛空。沒有邊界，沒有重力——只有寂靜與完成。';default:return '';} };

  if (phase.type === 'entering') {
    return (
      <GuiFrame tone="inner">
        <div style={{ position:'relative',zIndex:2,height:'100%',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:48 }}>
          <GlassPanel title={`第${CH[layerNum-1]}層`} subtitle={layer.layerName} variant="warm" style={{ maxWidth:640,width:'100%',textAlign:'center' }}>
            <div style={{ color:colors.sub,fontSize:13,fontStyle:'italic',lineHeight:1.8,marginBottom:20,padding:'10px 16px',borderRadius:8,background:'rgba(0,0,0,0.25)' }}>{layer.emotionalForeword}</div>
            <div style={{ color:colors.text,fontSize:15,lineHeight:2.2,whiteSpace:'pre-line',marginBottom:28 }}>{layer.sceneDescription}</div>
            <GlimmerButton tone="primary" onClick={handleEnter}>進入{layer.layerName}</GlimmerButton>
          </GlassPanel>
        </div>
      </GuiFrame>
    );
  }

  if (phase.type === 'layer_complete') {
    return (
      <GuiFrame tone="inner">
        <div style={{ position:'relative',zIndex:2,height:'100%',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:48 }}>
          <GlassPanel title="理解達成" subtitle={layer.layerName} variant="paper" style={{ maxWidth:560,width:'100%',textAlign:'center' }}>
            <div style={{ color:'#3a2a14',fontSize:15,lineHeight:2,fontStyle:'italic',marginBottom:12 }}>「{layer.playerUnderstanding}」</div>
            <div style={{ color:'#6a5a3a',fontSize:13,lineHeight:1.8,marginBottom:24,padding:'10px 14px',borderRadius:8,background:'rgba(214,163,94,0.08)' }}>你已獲得 {insightCount} 個理解片段，理解了這一層的核心。</div>
            <div style={{ display:'flex',flexDirection:'column',gap:10 }}>
              <GlimmerButton tone="primary" onClick={handleLayerComplete} fullWidth>{isLast?'走向終章':'深入下一層'}</GlimmerButton>
              <GlimmerButton tone="quiet" onClick={() => { setPhase({ type:'exploring' }); setLayerLockMessage(null); }} fullWidth style={{ color:'#3a2a14',borderColor:'rgba(58,42,20,0.3)',opacity:0.9 }}>回到第{CH[layerNum-1]}層繼續探索</GlimmerButton>
            </div>
            {layerLockMessage && <div style={{ marginTop:8,fontSize:12,color:'#9a6a2b',lineHeight:1.7 }}>{layerLockMessage}</div>}
          </GlassPanel>
        </div>
      </GuiFrame>
    );
  }

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

  return (
    <GuiFrame tone="inner">
      <div style={{ position:'relative',zIndex:2,height:'100%',display:'grid',gridTemplateColumns:'270px 1fr',gap:20,padding:28 }}>
        <div style={{ display:'flex',flexDirection:'column',maxHeight:'calc(100vh - 100px)',minHeight:0,gap:8 }}>
          <aside style={{ display:'flex',flexDirection:'column',gap:14,overflowY:'auto',flex:1,minHeight:0,paddingRight:4 }}>
            <GlassPanel title={`第${CH[layerNum-1]}層`} subtitle={layer.layerName} variant="warm" style={{ flexShrink:0 }} contentStyle={{ display:'flex',flexDirection:'column',gap:12 }}>
              <div style={{ color:colors.sub,fontSize:13,lineHeight:1.9,whiteSpace:'pre-line' }}>{layerAtmoText(layerNum)}</div>
              {layer.nextLayerThreshold > 0 && (<div style={{ marginTop:4 }}><div style={{ display:'flex',justifyContent:'space-between',fontSize:11,color:colors.sub,marginBottom:4 }}><span>理解深度</span><span>{score}/{layer.nextLayerThreshold}</span></div><div style={{ width:'100%',height:4,borderRadius:2,background:colors.cellEmpty,overflow:'hidden' }}><div style={{ width:`${Math.min(100,(score/layer.nextLayerThreshold)*100)}%`,height:'100%',borderRadius:2,background:`linear-gradient(90deg, ${colors.accent}, ${colors.accent}88)`,transition:'width 0.5s ease' }}/></div></div>)}
              {isLast && (<div style={{ marginTop:4 }}><div style={{ display:'flex',justifyContent:'space-between',fontSize:11,color:colors.sub,marginBottom:4 }}><span>理解深度</span><span>{insightCount}/{layer.interactables.length} 個片段</span></div><div style={{ width:'100%',height:4,borderRadius:2,background:colors.cellEmpty,overflow:'hidden' }}><div style={{ width:`${Math.min(100,(insightCount/layer.interactables.length)*100)}%`,height:'100%',borderRadius:2,background:`linear-gradient(90deg, ${colors.accent}, ${colors.accent}88)`,transition:'width 0.5s ease' }}/></div></div>)}
              <div style={{ display:'flex',gap:6,justifyContent:'center',marginTop:4 }}>
                {[1,2,3,4].map(n => (<div key={n} style={{ width:10,height:10,borderRadius:'50%',background:n===layerNum?colors.accent:n<layerNum?`${colors.accent}55`:colors.cellEmpty,border:n===layerNum?`2px solid ${colors.accent}`:`1px solid ${colors.accent}33`,transition:'all 0.3s ease' }} title={`Layer ${n}`}/>))}
              </div>
            </GlassPanel>
            <GlassPanel title="心理狀態" subtitle={npcDef.characterCard.displayName} variant="dark" style={{ flexShrink:0 }} contentStyle={{ display:'flex',flexDirection:'column',gap:8 }}>
              <div style={{ display:'flex',justifyContent:'space-between',fontSize:11,color:colors.sub }}><span>當前恐懼值</span><span style={{ color:stressColor(safeStress),fontWeight:'bold' }}>{safeStress}</span></div>
              <div style={{ width:'100%',height:6,borderRadius:3,background:colors.cellEmpty,overflow:'hidden' }}><div style={{ width:`${safeStress}%`,height:'100%',borderRadius:3,background:stressColor(safeStress),transition:'width 0.5s ease' }}/></div>
              <div style={{ fontSize:11,color:'#7a7a7a',marginTop:4,lineHeight:1.5 }}>{isAllLayersUnlocked?'✨當前最高可進入第四層。':`當前最高可進入第${CH[maxUnlockedLayer-1]}層。門檻：第2層≤75，第3層≤55，第4層≤35。`}</div>
            </GlassPanel>
            {insightCount > 0 && (<GlassPanel title="理解碎片" subtitle={`${insightCount} 個片段`} variant="paper" style={{ flexShrink:0 }} contentStyle={{ display:'flex',flexDirection:'column',gap:10 }}>{insightFragments.map((f,i) => (<div key={i} style={{ padding:'10px 12px',borderRadius:8,background:'rgba(214,163,94,0.1)',border:'1px solid rgba(214,163,94,0.18)',color:'#4a3620',fontSize:13,lineHeight:1.7,fontStyle:'italic' }}>「{f}」</div>))}</GlassPanel>)}
          </aside>
          <div style={{ display:'flex',flexDirection:'column',gap:8,flexShrink:0,paddingTop:4 }}>
            {showLayerCompleteBtn && (<GlimmerButton tone="primary" onClick={() => setPhase({ type:'layer_complete' })} fullWidth>{isLast?'理解達成':'深入理解 →'}</GlimmerButton>)}
            <GlimmerButton tone="quiet" onClick={handleReturn} fullWidth>返回表世界</GlimmerButton>
          </div>
        </div>

        <main style={{ display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:16,opacity:isModalOpen?0.3:1,pointerEvents:isModalOpen?'none':'auto',transition:'opacity 0.3s ease',height:'100%',overflow:'hidden',flex:1 }}>
          <div style={{ position:'relative',width:'100%',flex:1,display:'flex',alignItems:'center',justifyContent:'center' }}>
            {/* bridgePainter 特定 Visuals；其他 NPC → Coming Soon */}
            {npcId === 'bridge_artist' ? (
              <>
                {layerNum === 1 && (
                  <GloryMuseumVisual layerNum={layerNum} floatingTextsByLayer={floatingTextsByLayer} onPaintingClick={() => { if (championPaintingObj) handleClickObject(championPaintingObj); }} isPaintingCollected={isChampionPaintingCollected} isPaintingDiscovered={isChampionPaintingDiscovered}>
                    {layer.interactables.map(obj => {
                      if (obj.id === 'champion_painting') return null;
                      const coord = pinCoordinates[obj.id] || { top:'50%',left:'50%' };
                      const isDisc = discoveredIds.includes(obj.id);
                      const hasIn = hasInsight(understanding, obj.id);
                      if (obj.id === 'award_trophy') return (<MuseumTrophyArtifact key={obj.id} isCollected={hasIn} isDiscovered={isDisc} onClick={() => handleClickObject(obj)} style={{ top:coord.top,left:coord.left }} />);
                      return (<InteractivePin key={obj.id} icon={getIcon(obj.id)} name={obj.name} isCollected={hasIn} isDiscovered={isDisc} onClick={() => handleClickObject(obj)} style={{ top:coord.top,left:coord.left,transform:'translate(-50%, -50%)' }} />);
                    })}
                  </GloryMuseumVisual>
                )}
                {layerNum === 2 && (
                  <AccidentVideoPlaceholder layerNum={layerNum} floatingTextsByLayer={floatingTextsByLayer}>
                    {layer.interactables.map(obj => { const coord = pinCoordinates[obj.id] || { top:'50%',left:'50%' }; const isDisc = discoveredIds.includes(obj.id); const hasIn = hasInsight(understanding, obj.id); return (<InteractivePin key={obj.id} icon={getIcon(obj.id)} name={obj.name} isCollected={hasIn} isDiscovered={isDisc} onClick={() => handleClickObject(obj)} style={{ top:coord.top,left:coord.left,transform:'translate(-50%, -50%)' }} />); })}
                  </AccidentVideoPlaceholder>
                )}
                {layerNum === 3 && (
                  <WhiteCanvasVisual layerNum={layerNum} floatingTextsByLayer={floatingTextsByLayer}>
                    {layer.interactables.map(obj => { const coord = pinCoordinates[obj.id] || { top:'50%',left:'50%' }; const isDisc = discoveredIds.includes(obj.id); const hasIn = hasInsight(understanding, obj.id); return (<InteractivePin key={obj.id} icon={getIcon(obj.id)} name={obj.name} isCollected={hasIn} isDiscovered={isDisc} onClick={() => handleClickObject(obj)} style={{ top:coord.top,left:coord.left,transform:'translate(-50%, -50%)' }} />); })}
                  </WhiteCanvasVisual>
                )}
                {layerNum === 4 && (
                  <GlowingCanvasVisual layerNum={layerNum} floatingTextsByLayer={floatingTextsByLayer}>
                    {layer.interactables.map(obj => { const coord = pinCoordinates[obj.id] || { top:'50%',left:'50%' }; const isDisc = discoveredIds.includes(obj.id); const hasIn = hasInsight(understanding, obj.id); return (<InteractivePin key={obj.id} icon={getIcon(obj.id)} name={obj.name} isCollected={hasIn} isDiscovered={isDisc} onClick={() => handleClickObject(obj)} style={{ top:coord.top,left:coord.left,transform:'translate(-50%, -50%)' }} />); })}
                  </GlowingCanvasVisual>
                )}
              </>
            ) : (
              <ComingSoonVisual layerNum={layerNum} npcId={npcId} />
            )}
          </div>

          <div style={{ position:'absolute',bottom:14,left:'50%',transform:'translateX(-50%)',zIndex:8,display:'flex',flexDirection:'column',gap:6,alignItems:'center',width:'calc(100% - 28px)',maxWidth:600,padding:'6px 12px',background:'rgba(255,255,255,0.06)',borderRadius:12,border:'1px solid rgba(255,255,255,0.12)',backdropFilter:'blur(2px)',pointerEvents:'auto' }}>
            <span style={{ fontSize:13,color:'#f5c16c',fontWeight:'bold',letterSpacing:1 }}>依完成進度與恐懼值門檻切換層級</span>
            {layerLockMessage && (<div style={{ marginBottom:2,display:'flex',flexDirection:'column',gap:8,alignItems:'center' }}><div style={{ fontSize:13,color:'#b71c1c',textAlign:'center',fontWeight:600,textShadow:'0 0 8px rgba(183,28,28,0.3)' }}>⚠ {layerLockMessage}</div></div>)}
            {isLast && showLayerCompleteBtn && (<><style>{`@keyframes insightPulse { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.7; transform: scale(1.03); } }`}</style><div style={{ marginBottom:4,fontSize:14,color:'#ffd54f',textAlign:'center',fontWeight:600,textShadow:'0 0 10px rgba(255,213,79,0.4)',animation:'insightPulse 1.5s ease-in-out infinite' }}>✨ 理解已達成 — 請點擊左側「理解達成」按鈕完成這一層</div></>)}
            <div style={{ display:'flex',gap:16,width:'100%',justifyContent:'center' }}>
              {[1,2,3,4].map(num => {
                const stressUnlocked = isLayerUnlockedByStress(num, safeStress);
                const isCompleted = completedLayers.has(num);
                const isAtOrBelowCurrent = num <= layerNum;
                const understandingMet = num > 1 ? completedLayers.has(num - 1) || (thresholdMet && num === layerNum + 1) : true;
                const canSwitch = isCompleted || isAtOrBelowCurrent || (understandingMet && num > layerNum);
                const isLocked = !stressUnlocked || !canSwitch;
                return (
                  <GlimmerButton key={num} tone={layerNum === num ? 'primary' : 'ghost'} onClick={() => {
                    if (!stressUnlocked) { setLayerLockMessage(`第${CH[num-1]}層未解鎖：需要恐懼值≤ ${getLayerStressRequirement(num)}（當前 ${safeStress}）。`); return; }
                    if (!understandingMet) { setLayerLockMessage(`需要第${CH[num-2]}層的理解深度達標才能進入第${CH[num-1]}層。`); return; }
                    if (isLocked) { setLayerLockMessage(`請先完成第${CH[completedLayers.size]}層的探索，才能進入更深層。`); return; }
                    setLayerLockMessage(null);
                    if (thresholdMet && num === layerNum + 1 && !completedLayers.has(layerNum)) { setPhase({ type:'layer_complete' }); return; }
                    setLayerNum(num as number);
                    markLayerVisited(num);
                    setPhase({ type: visitedLayers.has(num) ? 'exploring' : 'entering' });
                  }} style={{ fontSize:15,padding:'10px 32px',minHeight:44,borderRadius:10,flex:1,maxWidth:160,opacity:isLocked?0.45:1 }}>
                    第{CH[num-1]}層{isLocked?'🔒':''}
                  </GlimmerButton>
                );
              })}
            </div>
          </div>
        </main>

        {isModalOpen && <div onClick={handleCloseInsight} style={{ position:'absolute',inset:0,zIndex:3,background:'rgba(0,0,0,0.35)' }}/>}
        {(phase.type==='observing'||phase.type==='reflecting') && (<ObservingPanel phase={phase} colors={colors} onLookCloser={handleLookCloser} onStartReflection={handleStartReflection} onChooseReflection={handleChooseReflection} />)}
        {phase.type==='insight_revealed' && (<InsightPanel phase={phase} colors={colors} onClose={handleCloseInsight} />)}
      </div>
    </GuiFrame>
  );
}
