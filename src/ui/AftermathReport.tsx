import { GlimmerButton, GlassPanel, GuiFrame } from '../components';
import type { GameSave } from '../systems/saveSystem';

type AftermathReportProps = {
  save: GameSave;
  onBack: () => void;
  onOpenReconciliation: () => void;
};

export default function AftermathReport({ save, onBack, onOpenReconciliation }: AftermathReportProps) {
  const painter = save.npcs.bridge_artist;

  return (
    <GuiFrame tone="paper">
      <div style={{ position: 'relative', zIndex: 2, height: '100%', overflowY: 'auto', padding: '6vh 8vw' }}>
        <GlassPanel title="心靈餘波匯報" subtitle="Aftermath Report" variant="paper" style={{ maxWidth: 980, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 24 }}>
            <section>
              <h3 style={{ marginTop: 0 }}>靈魂軌跡：天橋畫家</h3>
              <p style={{ lineHeight: 1.9, color: '#463525' }}>
                {painter.ending === 'success' && (
                  <>
                    你進入了他的「榮耀美術館」。
                    {painter.innerWorldDepth >= 3
                      ? '你看見了獎盃的重量、簽名的變化、以及那幅沒畫完的畫。你讓他自己說出最不敢說的話——「我怕畫完之後，就再也沒有理由站在這座橋上了。」'
                      : painter.innerWorldDepth >= 2
                        ? '你看見了簽名的逃跑、被讚美淹沒的孤獨。你選擇了理解而非消費他的痛苦。'
                        : '因為你選擇了傾聽而非強行填色，他在現實中仍看不見色彩，卻第一次允許自己只是坐著聽雨。'}
                  </>
                )}
                {painter.ending === 'failed' && '你在最後一秒要求他重新畫出春天。他收起畫布，走進天橋最暗的雨裡。空白沒有被理解，只是被再次關上。'}
                {painter.ending === 'none' && '他的故事尚未抵達結局。雨水仍在天橋欄杆上緩慢匯聚，空白畫布等待一種不急著填滿的注視。'}
              </p>
              {painter.innerWorldDepth > 0 && (
                <p style={{ lineHeight: 1.9, color: '#463525', marginTop: 16 }}>
                  你走進了他的內心世界。{painter.innerWorldDepth >= 3 ? '你觸及了那幅沒畫完的畫——他主動提起，因為他知道你本來就懂。' : painter.innerWorldDepth >= 2 ? '你看見了簽名在逃跑。他感覺到了——不是每個進去過的人，都能看到簽名。' : '你只看見了獎盃的亮光。他把你歸類為和所有人一樣——這比沒去過更糟。'}
                </p>
              )}
            </section>

            <aside style={{ display: 'grid', gap: 12 }}>
              {[
                ['懸崖邊伸出的手', painter.trust >= 50 ? '你沒有急著拉扯。' : '你仍在尋找合適的距離。'],
                ['轉身離開的背影', painter.ending === 'failed' ? '他被留在了那場雨裡。' : '背影尚未完全凝固。'],
                ['雨中的最後微笑', painter.ending === 'success' ? '他聽見了雨聲。' : '尚未顯影。'],
              ].map(([title, content]) => (
                <div key={title} style={{ minHeight: 118, borderRadius: 14, padding: 16, background: 'linear-gradient(145deg, rgba(42,36,30,0.92), rgba(12,10,8,0.96))', color: '#d9c8ad', boxShadow: 'inset 0 0 40px rgba(0,0,0,0.48)' }}>
                  <div style={{ color: '#d6a35e', fontSize: 13 }}>{title}</div>
                  <div style={{ marginTop: 10, fontSize: 12, lineHeight: 1.7 }}>{content}</div>
                </div>
              ))}
            </aside>
          </div>

          <div style={{ marginTop: 26, padding: '16px 18px', borderRadius: 14, background: 'rgba(255,255,255,0.24)', color: '#3a2c20', lineHeight: 1.8 }}>
            這是一場關於理解的練習。雖然遊戲中的週目可以重來，但現實中的每一次傾聽，都是唯一的。感謝你，沒有在黑暗面前立刻轉身。
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 20 }}>
            <GlimmerButton tone="primary" onClick={onBack}>回到城市</GlimmerButton>
            <GlimmerButton onClick={onOpenReconciliation}>進入自我和解</GlimmerButton>
          </div>
        </GlassPanel>
      </div>
    </GuiFrame>
  );
}
