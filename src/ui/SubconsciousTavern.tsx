import { GlimmerButton, GlassPanel, GuiFrame, MeterBar } from '../components';
import type { GameSave } from '../systems/saveSystem';

type SubconsciousTavernProps = {
  save: GameSave;
  onBack: () => void;
  onEnterCity: () => void;
  onOpenReport: () => void;
};

export default function SubconsciousTavern({ save, onBack, onEnterCity, onOpenReport }: SubconsciousTavernProps) {
  const trauma = Math.min(100, save.ghosts.length * 35 + (save.npcs.bridge_artist.ending === 'failed' ? 20 : 0));

  return (
    <GuiFrame tone="tavern">
      <div style={{ position: 'relative', zIndex: 2, height: '100%', display: 'grid', gridTemplateColumns: 'minmax(320px, 520px) 1fr', gap: 28, padding: '7vh 8vw' }}>
        <GlassPanel title="潛意識酒館" subtitle="Subconscious Tavern" variant="warm" style={{ alignSelf: 'center' }}>
          <p style={{ marginTop: 0, color: '#d9c4a6', lineHeight: 1.9 }}>
            老闆擦著一只缺口杯，眼袋很深，聲音卻很輕：「在走進別人的黑暗前，先確認你還記得自己的呼吸。」
          </p>
          <div style={{ display: 'grid', gap: 14, marginTop: 20 }}>
            <MeterBar label="替代性創傷壓力" value={trauma} tone="red" />
            <MeterBar label="已掌握線索知識" value={save.player.knowledge} tone="gold" />
            <MeterBar label="天橋畫家信任" value={save.npcs.bridge_artist.trust} tone="green" />
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 24 }}>
            <GlimmerButton tone="primary" onClick={onEnterCity}>帶著提燈出門</GlimmerButton>
            <GlimmerButton onClick={onOpenReport}>查看餘波紀錄</GlimmerButton>
            <GlimmerButton tone="quiet" onClick={onBack}>返回標題</GlimmerButton>
          </div>
        </GlassPanel>

        <div style={{ alignSelf: 'center', display: 'grid', gap: 16 }}>
          {[
            ['進場前準備', '確認目標 NPC 的防備度、線索缺口與你自身的創傷負荷。'],
            ['情報交換', '酒館老闆會根據已解鎖的醫療報告，提供更感性的背後故事。'],
            ['心理緩衝', '任務結束後回到此處，讓失敗的幽靈不至於直接覆蓋下一段關係。'],
          ].map(([title, content]) => (
            <GlassPanel key={title} title={title} variant="dark" contentStyle={{ color: '#b9b0a4', lineHeight: 1.8 }}>
              {content}
            </GlassPanel>
          ))}
        </div>
      </div>
    </GuiFrame>
  );
}
