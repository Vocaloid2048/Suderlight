import { GlimmerButton, GlassPanel, GuiFrame } from '../components';
import type { GameSave } from '../systems/saveSystem';

type SelfReconciliationPortalProps = {
  save: GameSave;
  onBack: () => void;
  onRestart: () => void;
};

export default function SelfReconciliationPortal({ save, onBack, onRestart }: SelfReconciliationPortalProps) {
  const ghostCount = save.ghosts.length;

  return (
    <GuiFrame tone="dawn">
      <div style={{ position: 'relative', zIndex: 2, height: '100%', display: 'grid', placeItems: 'center', padding: 32 }}>
        <GlassPanel
          title="終局：與無力感和解"
          subtitle="Self-Reconciliation Portal"
          variant="paper"
          style={{ maxWidth: 760 }}
          contentStyle={{ lineHeight: 1.9, fontSize: 15 }}
        >
          <p style={{ marginTop: 0 }}>
            晨光沒有把所有黑暗趕走，只是讓你終於看清：失敗不是你不夠溫柔，而是每一個靈魂都有自己能承受的距離。
          </p>
          <p>
            你攜帶了 {ghostCount} 個失敗殘影。它們不再只用來責備你，而會提醒你在下一次傾聽前，也要替自己留下一把椅子。
          </p>
          <blockquote style={{ margin: '22px 0', padding: '14px 18px', borderLeft: '4px solid rgba(138,91,45,0.65)', background: 'rgba(255,255,255,0.24)' }}>
            「我願意承認自己的有限，也仍願意在黑暗面前不立刻轉身。」
          </blockquote>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <GlimmerButton tone="primary" onClick={onBack}>回到微光城市</GlimmerButton>
            <GlimmerButton onClick={onRestart}>重新開始週目</GlimmerButton>
          </div>
        </GlassPanel>
      </div>
    </GuiFrame>
  );
}
