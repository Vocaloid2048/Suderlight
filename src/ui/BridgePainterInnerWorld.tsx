import { useState, useCallback, useMemo, useEffect } from 'react';
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
      const top = 12 + (idx * 13) + Math.random() * 6;
      const left = 5 + (idx * 14) + Math.random() * 8;
      const duration = 12 + Math.random() * 6;
      const delay = idx * 2.2;
      const fontSize = 13 + Math.random() * 3;
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

function AccidentVideoPlaceholder() {
  return (
    <div style={{
      width: '100%',
      height: 280,
      borderRadius: 16,
      background: 'rgba(0,0,0,0.6)',
      border: '1px solid rgba(107, 158, 196, 0.3)',
      boxShadow: '0 0 20px rgba(107, 158, 196, 0.1)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      position: 'relative',
      overflow: 'hidden'
    }}>
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#6b9ec4" strokeWidth="1.5" style={{ opacity: 0.7, marginBottom: 16 }}>
        <path d="M23 7l-7 5 7 5V7z" />
        <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
      </svg>
      
      <div style={{ color: '#b0c8dd', fontSize: 15, fontWeight: 'bold', marginBottom: 8, textAlign: 'center', letterSpacing: 1.5 }}>
        【記憶影像預留 · 車禍重現】
      </div>
      <div style={{ color: '#7a8fa0', fontSize: 13, lineHeight: 1.6, textAlign: 'center', maxWidth: 360 }}>
        「原本敏銳感知世間萬彩的他，在卡車撞擊的刺耳剎那，視野瞬間崩解，從此被囚禁於寂靜的灰階世界。」
      </div>
      <div style={{ marginTop: 16, fontSize: 11, color: '#6b9ec4', background: 'rgba(107,158,196,0.1)', padding: '4px 10px', borderRadius: 20, border: '1px solid rgba(107,158,196,0.2)' }}>
        （已預留影片框架，後續由 AI 影片替換）
      </div>
      
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'linear-gradient(rgba(18,16,16,0) 50%, rgba(0,0,0,0.15) 50%), linear-gradient(90deg, rgba(255,0,0,0.03), rgba(0,255,0,0.01), rgba(0,0,255,0.03))', backgroundSize: '100% 4px, 6px 100%' }} />
    </div>
  );
}

function WhiteCanvasVisual() {
  return (
    <div style={{
      width: '100%',
      height: 280,
      borderRadius: 16,
      background: 'radial-gradient(circle at center, rgba(38,34,28,0.6), rgba(16,14,12,0.95))',
      border: '1px solid rgba(168, 152, 128, 0.25)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      padding: 16
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', width: '100%', height: '100%', justifyContent: 'center' }}>
        {/* Easel Leg */}
        <div style={{ width: 6, height: 180, background: 'linear-gradient(to bottom, #5c4033, #3d2b1f)', position: 'absolute', top: 20, transform: 'rotate(-5deg)', zIndex: 1 }} />
        {/* Easel Shelf */}
        <div style={{ width: 140, height: 8, background: '#3d2b1f', borderRadius: 4, position: 'absolute', top: 160, zIndex: 3, boxShadow: '0 4px 6px rgba(0,0,0,0.4)' }} />
        
        {/* Canvas */}
        <div style={{
          width: 120,
          height: 100,
          background: '#fcfcfc',
          border: '3px solid #8d6e63',
          borderRadius: 2,
          boxShadow: '0 8px 16px rgba(0,0,0,0.5)',
          zIndex: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'absolute',
          top: 55,
          transform: 'rotate(-1deg)'
        }}>
          <div style={{ width: '100%', height: '100%', border: '1px solid rgba(0,0,0,0.05)', background: 'linear-gradient(135deg, #ffffff, #f5f5f5)' }} />
        </div>
        
        {/* Silhouette */}
        <div style={{
          width: 44,
          height: 60,
          background: 'linear-gradient(to top, rgba(0,0,0,0.85), rgba(40,35,30,0.4))',
          borderRadius: '50% 50% 12px 12px',
          position: 'absolute',
          top: 130,
          left: '30%',
          zIndex: 4,
          filter: 'blur(1px)',
          transform: 'rotate(-8deg)'
        }} title="坐在畫架前的畫家" />
      </div>
      
      <div style={{ position: 'absolute', bottom: 12, left: 16, right: 16, color: '#c8bca0', fontSize: 11.5, textAlign: 'center', background: 'rgba(0,0,0,0.6)', padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(168,152,128,0.15)', zIndex: 5 }}>
        出院後的乾枯坐在畫架前，盯著那張毫無瑕疵、卻也毫無色彩的白色畫紙。
      </div>
    </div>
  );
}

function GlowingCanvasVisual() {
  const [isColored, setIsColored] = useState(false);
  useEffect(() => {
    const interval = setInterval(() => {
      setIsColored(true);
      setTimeout(() => {
        setIsColored(false);
      }, 2200);
    }, 5500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{
      width: '100%',
      height: 280,
      borderRadius: 16,
      background: 'radial-gradient(circle at center, rgba(30,25,35,0.6), rgba(8,6,12,0.95))',
      border: '1px solid rgba(184, 169, 201, 0.25)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      padding: 16
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', width: '100%', height: '100%', justifyContent: 'center' }}>
        {/* Easel Stand */}
        <div style={{ width: 8, height: 190, background: 'linear-gradient(to bottom, #422a1d, #251811)', position: 'absolute', top: 15, transform: 'rotate(-3deg)', zIndex: 1 }} />
        {/* Easel Shelf */}
        <div style={{ width: 160, height: 10, background: '#251811', borderRadius: 5, position: 'absolute', top: 155, zIndex: 3, boxShadow: '0 4px 8px rgba(0,0,0,0.6)' }} />
        
        {/* Canvas */}
        <div style={{
          width: 130,
          height: 105,
          background: isColored ? 'linear-gradient(135deg, #1e88e5, #1565c0)' : '#555555',
          border: '4px solid #8d6e63',
          borderRadius: 4,
          boxShadow: isColored 
            ? '0 0 35px rgba(30, 136, 229, 0.85), 0 8px 24px rgba(0,0,0,0.6)' 
            : '0 8px 16px rgba(0,0,0,0.5)',
          zIndex: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'absolute',
          top: 45,
          transform: 'rotate(1deg)',
          transition: 'background 1.5s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 1.5s ease',
        }}>
          <div style={{
            width: '100%',
            height: '100%',
            opacity: 0.12,
            backgroundImage: 'repeating-linear-gradient(0deg, #000, #000 1px, transparent 1px, transparent 4px), repeating-linear-gradient(90deg, #000, #000 1px, transparent 1px, transparent 4px)',
            position: 'absolute',
            inset: 0
          }} />
          
          <div style={{
            position: 'absolute',
            color: isColored ? '#ffffff' : '#aaaaaa',
            fontSize: 10.5,
            fontWeight: 'bold',
            letterSpacing: 2,
            textShadow: isColored ? '0 0 8px rgba(255,255,255,0.7)' : 'none',
            transition: 'color 1s ease',
            userSelect: 'none',
            pointerEvents: 'none'
          }}>
            {isColored ? '【靈魂的蔚藍】' : '【安靜的灰色】'}
          </div>
        </div>
        
        {/* Silhouette */}
        <div style={{
          width: 44,
          height: 60,
          background: 'linear-gradient(to top, rgba(0,0,0,0.9), rgba(20,15,30,0.6))',
          borderRadius: '50% 50% 12px 12px',
          position: 'absolute',
          top: 130,
          left: '32%',
          zIndex: 4,
          filter: 'blur(1px)',
          transform: 'rotate(-4deg)',
        }} title="在畫架前的畫家" />
      </div>
      
      <div style={{ position: 'absolute', bottom: 12, left: 16, right: 16, color: '#b8a9c9', fontSize: 11.5, textAlign: 'center', background: 'rgba(0,0,0,0.6)', padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(184,169,201,0.15)', zIndex: 5 }}>
        巨大的空白畫框前，乾枯靜默端坐。灰色是他的畫筆，卻在蔚藍湧現的剎那，綻放出生命的救贖。
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
      {/* 飄浮心聲背景效果 */}
      <FloatingComments layerNum={layerNum} />

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

        {/* 右側主區域（兩欄式：左網格、右視覺與快速切換） */}
        <main style={{
          display: 'grid',
          gridTemplateColumns: '1fr 340px',
          alignItems: 'center',
          gap: 24,
          opacity: isModalOpen ? 0.3 : 1,
          pointerEvents: isModalOpen ? 'none' : 'auto',
          transition: 'opacity 0.3s ease',
          height: '100%',
          overflow: 'hidden'
        }}>
          {/* 網格與切換按鈕 */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 140px)', gridTemplateRows: 'repeat(3, 105px)', gap: 14, padding: 18, borderRadius: 20, background: colors.gridBg, border: `1px solid ${colors.border}` }}>
              {Array.from({length:3}).map((_,row) =>
                Array.from({length:3}).map((_,col) => {
                  const obj = layer.interactables.find(o => o.row===row && o.col===col);
                  const isDisc = obj ? discoveredIds.includes(obj.id) : false;
                  const hasIn = obj ? hasInsight(understanding, obj.id) : false;
                  if (!obj) return <div key={`${row}-${col}`} style={{ borderRadius:12,background:colors.cellEmpty,border:`1px dashed ${colors.accent}15` }}/>;
                  return (
                    <button key={obj.id} onClick={() => handleClickObject(obj)} style={{ borderRadius:12,background:hasIn?colors.cellInsight:isDisc?colors.cellDisc:colors.cellNorm,border:hasIn?`1px solid ${colors.accent}66`:isDisc?`1px solid ${colors.accent}20`:`1px solid ${colors.accent}10`,cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:4,padding:8,transition:'all 0.2s ease',color:hasIn?colors.accent:isDisc?colors.text:colors.sub,zIndex:2 }}
                      onMouseEnter={e => { e.currentTarget.style.background=`${colors.accent}18`; e.currentTarget.style.borderColor=`${colors.accent}55`; e.currentTarget.style.transform='scale(1.03)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background=hasIn?colors.cellInsight:isDisc?colors.cellDisc:colors.cellNorm; e.currentTarget.style.borderColor=hasIn?`1px solid ${colors.accent}66`:isDisc?`1px solid ${colors.accent}20`:`1px solid ${colors.accent}10`; e.currentTarget.style.transform='scale(1)'; }}
                    >
                      <div style={{ fontSize:22,opacity:hasIn?1:0.55 }}>{getIcon(obj.id)}</div>
                      <div style={{ fontSize:10.5,letterSpacing:0.5,fontWeight:hasIn?600:400,textAlign:'center',lineHeight:1.2 }}>{obj.name}{hasIn&&<span style={{ marginLeft:2,fontSize:9 }}>✦</span>}</div>
                    </button>
                  );
                })
              )}
            </div>
            
            {/* 快速層級切換（當心防抗拒值降低到一定數值後解鎖全部心理世界） */}
            {isAllLayersUnlocked && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center', width: '100%', maxWidth: 440, padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
                <span style={{ fontSize: 11, color: '#f5c16c', fontWeight: 'bold', letterSpacing: 1 }}>心防徹底解鎖：自由切換層級</span>
                <div style={{ display: 'flex', gap: 8 }}>
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
                      style={{ fontSize: 10, padding: '4px 12px', minHeight: 24, borderRadius: 6 }}
                    >
                      第{CH[num-1]}層
                    </GlimmerButton>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 視覺展示區域 */}
          <div style={{ width: '100%', zIndex: 2 }}>
            {layerNum === 1 && (
              <div style={{
                width: '100%',
                height: 280,
                borderRadius: 16,
                background: 'radial-gradient(circle at center, rgba(45,36,22,0.6), rgba(18,14,10,0.95))',
                border: '1px solid rgba(214,163,94,0.25)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 24,
                textAlign: 'center',
                boxShadow: '0 0 20px rgba(214,163,94,0.1)',
                position: 'relative'
              }}>
                <span style={{ fontSize: 40, marginBottom: 12 }}>🖼️</span>
                <div style={{ color: '#d4a35e', fontSize: 15, fontWeight: 'bold', marginBottom: 8, letterSpacing: 1 }}>【展覽廳 · 昔日榮耀】</div>
                <div style={{ color: '#d8c29b', fontSize: 12, lineHeight: 1.7, maxWidth: 280 }}>
                  這曾是他站在聚光燈下的舞台。無數的讚美、不息的掌聲，以及那些精雕細琢卻缺乏溫度的完美畫作，共同組成了他對「自我」的全部定義。
                </div>
              </div>
            )}
            {layerNum === 2 && <AccidentVideoPlaceholder />}
            {layerNum === 3 && <WhiteCanvasVisual />}
            {layerNum === 4 && <GlowingCanvasVisual />}
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
