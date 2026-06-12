import { GlimmerButton, GlassPanel, GuiFrame } from '../components';
import type { NpcRuntimeState } from '../systems/npcStateEngine';

type InnerWorldAbyssProps = {
  npcState: NpcRuntimeState;
  onBack: () => void;
  onResolveSuccess: () => void;
  onResolveFailure: () => void;
};

const innerWorldThemes = [
  ['奧森', '無聲交響樂', '斷裂五線譜與枯木樂器在黑白空間中靜止。'],
  ['蕾娜', '鏡面迷宮', '飛舞的假笑面具映照出鏡中流淚的臉。'],
  ['維克多', '失色溫室', '透明花朵散發刺鼻的化學冷光。'],
  ['天橋畫家', '失色畫廊', '巨大白色空間裡，灰雨沖刷每一幅名畫。'],
  ['諾亞', '靜默廣播塔', '鏽蝕高塔被電線纏繞，只剩靜電雜訊。'],
  ['達米安', '失樂園排練室', '刺眼聚光燈逼迫影子反覆謝幕。'],
  ['小葵', '混亂魔方', '公寓樓塊旋轉、坍塌，重力不再可信。'],
  ['尤里', '靜止標本室', '水晶凍住蝴蝶、心跳與所有尚未說完的愛。'],
];

export default function InnerWorldAbyss({ npcState: _npcState, onBack, onResolveSuccess, onResolveFailure }: InnerWorldAbyssProps) {
  return (
    <GuiFrame tone="inner">
      <div style={{ position: 'relative', zIndex: 2, height: '100%', display: 'grid', gridTemplateColumns: '320px minmax(460px, 760px)', gap: 24, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <GlassPanel title="裏世界索引" subtitle="Emotion Abyss" variant="dark" contentStyle={{ display: 'grid', gap: 10 }}>
          {innerWorldThemes.map(([name, title, description]) => (
            <div key={title} style={{ padding: 12, borderRadius: 12, background: name === '天橋畫家' ? 'rgba(214,163,94,0.12)' : 'rgba(255,255,255,0.05)', border: name === '天橋畫家' ? '1px solid rgba(214,163,94,0.32)' : '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ color: name === '天橋畫家' ? '#f5c16c' : '#d8d8d8', fontSize: 13 }}>{name} · {title}</div>
              <div style={{ color: '#8e949c', fontSize: 12, lineHeight: 1.6, marginTop: 5 }}>{description}</div>
            </div>
          ))}
        </GlassPanel>

        <GlassPanel title="心理世界：失色畫廊" subtitle="Inner World Conversation" variant="dark">
          <div style={{ minHeight: 260, borderRadius: 18, border: '1px solid rgba(255,255,255,0.1)', background: 'linear-gradient(145deg, rgba(245,245,245,0.88), rgba(95,98,105,0.26) 42%, rgba(18,19,24,0.88)), radial-gradient(circle at 50% 55%, rgba(255,255,255,0.24), transparent 38%)', padding: 24, color: '#f7f7f7', boxShadow: 'inset 0 0 80px rgba(0,0,0,0.4)' }}>
            <div style={{ maxWidth: 520, color: '#101217', background: 'rgba(255,255,255,0.68)', padding: 18, borderRadius: 14, lineHeight: 1.9 }}>
              這裡不是要把色彩還給他，而是讓他知道：沒有色彩的他，也仍然存在。地板像潮濕紙張般晃動，所有說教都會讓空間坍塌。
            </div>
          </div>

          <div style={{ marginTop: 20, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <GlimmerButton tone="primary" onClick={onResolveSuccess}>陪他坐下，聽雨聲</GlimmerButton>
            <GlimmerButton tone="danger" onClick={onResolveFailure}>要求他畫出春天</GlimmerButton>
            <GlimmerButton tone="quiet" onClick={onBack}>退回表世界</GlimmerButton>
          </div>
        </GlassPanel>
      </div>
    </GuiFrame>
  );
}
