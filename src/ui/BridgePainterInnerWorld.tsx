import { useState, useCallback, useMemo } from 'react';
import { GuiFrame, GlassPanel, GlimmerButton } from '../components';
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
// 主組件
// ============================================================
export default function BridgePainterInnerWorld({ onReturnToSurface, onAdvanceLayer }: Props) {
  const [layerNum, setLayerNum] = useState<number>(1);
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

  const showLayerCompleteBtn = phase.type === 'exploring' && (
    thresholdMet || (isLast && insightCount >= 3)
  );
  const insightFragments = getInsightFragments(understanding);
  const insightCount = understanding.insightIds.length;
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
      <div style={{ position:'relative',zIndex:2,height:'100%',display:'grid',gridTemplateColumns:'260px 1fr',gap:20,padding:28 }}>
        {/* 左側欄 */}
        <aside style={{ display:'flex',flexDirection:'column',gap:16 }}>
          <GlassPanel title={`第${CH[layerNum-1]}層`} subtitle={layer.layerName} variant={layer.colorScheme==='void'?'paper':'warm'} contentStyle={{ display:'flex',flexDirection:'column',gap:14 }}>
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

          {insightCount > 0 && (
            <GlassPanel title="理解碎片" subtitle={`${insightCount} 個片段`} variant="paper" contentStyle={{ display:'flex',flexDirection:'column',gap:10 }}>
              {insightFragments.map((f,i) => (
                <div key={i} style={{ padding:'10px 12px',borderRadius:8,background:'rgba(214,163,94,0.1)',border:'1px solid rgba(214,163,94,0.18)',color:'#4a3620',fontSize:13,lineHeight:1.7,fontStyle:'italic' }}>「{f}」</div>
              ))}
            </GlassPanel>
          )}

          <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
            {showLayerCompleteBtn && (
              <GlimmerButton tone="primary" onClick={() => setPhase({ type:'layer_complete' })} fullWidth>深入理解 →</GlimmerButton>
            )}
            <GlimmerButton tone="quiet" onClick={handleReturn} fullWidth>返回表世界</GlimmerButton>
          </div>
        </aside>

        {/* 右側網格 */}
        <main style={{ display:'flex',alignItems:'center',justifyContent:'center',opacity:isModalOpen?0.3:1,pointerEvents:isModalOpen?'none':'auto',transition:'opacity 0.3s ease' }}>
          <div style={{ display:'grid',gridTemplateColumns:'repeat(3, 160px)',gridTemplateRows:'repeat(3, 120px)',gap:16,padding:24,borderRadius:20,background:colors.gridBg,border:`1px solid ${colors.border}` }}>
            {Array.from({length:3}).map((_,row) =>
              Array.from({length:3}).map((_,col) => {
                const obj = layer.interactables.find(o => o.row===row && o.col===col);
                const isDisc = obj ? discoveredIds.includes(obj.id) : false;
                const hasIn = obj ? hasInsight(understanding, obj.id) : false;
                if (!obj) return <div key={`${row}-${col}`} style={{ borderRadius:12,background:colors.cellEmpty,border:`1px dashed ${colors.accent}15` }}/>;
                return (
                  <button key={obj.id} onClick={() => handleClickObject(obj)} style={{ borderRadius:12,background:hasIn?colors.cellInsight:isDisc?colors.cellDisc:colors.cellNorm,border:hasIn?`1px solid ${colors.accent}66`:isDisc?`1px solid ${colors.accent}20`:`1px solid ${colors.accent}10`,cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:6,padding:12,transition:'all 0.2s ease',color:hasIn?colors.accent:isDisc?colors.text:colors.sub,zIndex:1 }}
                    onMouseEnter={e => { e.currentTarget.style.background=`${colors.accent}18`; e.currentTarget.style.borderColor=`${colors.accent}55`; e.currentTarget.style.transform='scale(1.03)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background=hasIn?colors.cellInsight:isDisc?colors.cellDisc:colors.cellNorm; e.currentTarget.style.borderColor=hasIn?`1px solid ${colors.accent}66`:isDisc?`1px solid ${colors.accent}20`:`1px solid ${colors.accent}10`; e.currentTarget.style.transform='scale(1)'; }}
                  >
                    <div style={{ fontSize:24,opacity:hasIn?1:0.55 }}>{getIcon(obj.id)}</div>
                    <div style={{ fontSize:11.5,letterSpacing:0.5,fontWeight:hasIn?600:400,textAlign:'center' }}>{obj.name}{hasIn&&<span style={{ marginLeft:4,fontSize:10 }}>✦</span>}</div>
                  </button>
                );
              })
            )}
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
