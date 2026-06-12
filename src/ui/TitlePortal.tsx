import { GlimmerButton, GlassPanel, GuiFrame } from '../components';

type TitlePortalProps = {
  onStart: () => void;
  onOpenTavern: () => void;
  onOpenDictionary: () => void;
  onOpenReport: () => void;
};

export default function TitlePortal({ onStart, onOpenTavern, onOpenDictionary, onOpenReport }: TitlePortalProps) {
  return (
    <GuiFrame tone="city">
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(120deg, rgba(255,255,255,0.03), transparent 35%, rgba(214,163,94,0.08) 100%)' }} />
        {Array.from({ length: 34 }).map((_, index) => (
          <span
            key={index}
            style={{
              position: 'absolute',
              left: `${(index * 37) % 100}%`,
              top: -80,
              width: 1,
              height: 140 + ((index * 23) % 120),
              background: 'linear-gradient(180deg, rgba(255,255,255,0), rgba(190,210,230,0.18), rgba(255,255,255,0))',
              transform: `rotate(${8 + (index % 4)}deg)`,
              opacity: 0.7,
            }}
          />
        ))}
      </div>

      <section style={{ position: 'relative', zIndex: 2, height: '100%', display: 'grid', gridTemplateColumns: '1fr 360px', alignItems: 'center', gap: 48, padding: '8vh 9vw' }}>
        <div>
          <div style={{ color: '#d6a35e', letterSpacing: 6, fontSize: 13, marginBottom: 18 }}>GLIMMER CITY</div>
          <h1 style={{ margin: 0, fontSize: 'clamp(44px, 7vw, 88px)', lineHeight: 1.02, fontWeight: 700, letterSpacing: 2, textShadow: '0 0 42px rgba(214,163,94,0.18)' }}>
            情緒修復師<br />微光城市
          </h1>
          <p style={{ margin: '26px 0 0', maxWidth: 620, color: '#b7bdc6', fontSize: 16, lineHeight: 1.9 }}>
            負面情緒不是敵人。你將帶著一盞微弱的燈，穿過表世界的雨夜與裏世界的心理迷宮，學習傾聽那些不急著被修復的人。
          </p>
        </div>

        <GlassPanel title="存檔入口" subtitle="Title & Save Portal" variant="dark">
          <div style={{ display: 'grid', gap: 10 }}>
            <GlimmerButton tone="primary" fullWidth onClick={onStart}>進入微光城市</GlimmerButton>
            <GlimmerButton fullWidth onClick={onOpenTavern}>前往潛意識酒館</GlimmerButton>
            <GlimmerButton fullWidth onClick={onOpenDictionary}>查看情緒詞典</GlimmerButton>
            <GlimmerButton fullWidth onClick={onOpenReport}>預覽心靈餘波匯報</GlimmerButton>
          </div>
          <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.1)', color: '#8e949c', fontSize: 12, lineHeight: 1.7 }}>
            公益提示：本作是心理健康教育與共情訓練，不替代專業心理或醫療協助。
          </div>
        </GlassPanel>
      </section>
    </GuiFrame>
  );
}
