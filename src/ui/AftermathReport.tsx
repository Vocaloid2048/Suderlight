import { GlimmerButton, GlassPanel, GuiFrame } from '../components';
import type { GameSave } from '../systems/saveSystem';
import type { NpcId } from '../data/verticalSlice';
import { getNpcDefinition } from '../data/npcs/registry';
import { bridgeArtistAftermath } from '../data/npcs/bridgePainter';

type AftermathReportProps = {
  save: GameSave;
  onBack: () => void;
  onOpenReconciliation: () => void;
  /** NPC ID，預設 bridge_artist */
  npcId?: NpcId;
};

function getAftermathContent(npcId: NpcId) {
  // 向後相容：依 npcId 回傳對應文案
  if (npcId === 'bridge_artist') return bridgeArtistAftermath;
  const def = getNpcDefinition(npcId);
  return {
    title: `靈魂軌跡：${def.characterCard.displayName}`,
    labels: {
      cliffHand: '懸崖邊伸出的手',
      backTurned: '轉身離開的背影',
      lastSmile: '雨中的最後微笑',
    },
    conclusion: '這是一場關於理解的練習。',
  };
}

export default function AftermathReport({ save, onBack, onOpenReconciliation, npcId = 'bridge_artist' }: AftermathReportProps) {
  const npc = save.npcs[npcId];
  if (!npc) {
    return (
      <GuiFrame tone="paper">
        <div style={{ position: 'relative', zIndex: 2, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48 }}>
          <GlassPanel title="尚無紀錄" variant="dark">
            <GlimmerButton tone="primary" onClick={onBack}>回到城市</GlimmerButton>
          </GlassPanel>
        </div>
      </GuiFrame>
    );
  }

  const aftermath = getAftermathContent(npcId);

  return (
    <GuiFrame tone="paper">
      <div style={{ position: 'relative', zIndex: 2, height: '100%', overflowY: 'auto', padding: '6vh 8vw' }}>
        <GlassPanel title="心靈餘波匯報" subtitle="Aftermath Report" variant="paper" style={{ maxWidth: 980, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 24 }}>
            <section>
              <h3 style={{ marginTop: 0 }}>{aftermath.title}</h3>
              <p style={{ lineHeight: 1.9, color: '#463525' }}>
                {npc.ending === 'success' && (
                  <>
                    你進入了他的內心世界。
                    {npc.innerWorldDepth >= 3
                      ? '你看見了獎盃的重量、簽名的變化、以及那幅沒畫完的畫。你讓他自己說出最不敢說的話。'
                      : npc.innerWorldDepth >= 2
                        ? '你看見了簽名的逃跑、被讚美淹沒的孤獨。你選擇了理解而非消費他的痛苦。'
                        : '因為你選擇了傾聽而非強行填色，他在現實中仍看不見色彩，卻第一次允許自己只是坐著聽雨。'}
                  </>
                )}
                {npc.ending === 'failed' && '你在最後一刻做出了錯誤的選擇。他收起行囊，走進雨夜最暗的地方。空白沒有被理解，只是被再次關上。'}
                {npc.ending === 'none' && '他的故事尚未抵達結局。雨水仍在天橋欄杆上緩慢匯聚，空白畫布等待一種不急著填滿的注視。'}
              </p>
              {npc.innerWorldDepth > 0 && (
                <p style={{ lineHeight: 1.9, color: '#463525', marginTop: 16 }}>
                  你走進了他的內心世界。{npc.innerWorldDepth >= 3 ? '你觸及了那幅沒畫完的畫——他主動提起，因為他知道你本來就懂。' : npc.innerWorldDepth >= 2 ? '你看見了簽名在逃跑。他感覺到了——不是每個進去過的人，都能看到簽名。' : '你只看見了獎盃的亮光。他把你歸類為和所有人一樣——這比沒去過更糟。'}
                </p>
              )}
            </section>

            <aside style={{ display: 'grid', gap: 12 }}>
              {[
                [aftermath.labels.cliffHand, npc.trust >= 50 ? '你沒有急著拉扯。' : '你仍在尋找合適的距離。'],
                [aftermath.labels.backTurned, npc.ending === 'failed' ? '他被留在了那場雨裡。' : '背影尚未完全凝固。'],
                [aftermath.labels.lastSmile, npc.ending === 'success' ? '他聽見了雨聲。' : '尚未顯影。'],
              ].map(([title, content]) => (
                <div key={title} style={{ minHeight: 118, borderRadius: 14, padding: 16, background: 'linear-gradient(145deg, rgba(42,36,30,0.92), rgba(12,10,8,0.96))', color: '#d9c8ad', boxShadow: 'inset 0 0 40px rgba(0,0,0,0.48)' }}>
                  <div style={{ color: '#d6a35e', fontSize: 13 }}>{title}</div>
                  <div style={{ marginTop: 10, fontSize: 12, lineHeight: 1.7 }}>{content}</div>
                </div>
              ))}
            </aside>
          </div>

          <div style={{ marginTop: 26, padding: '16px 18px', borderRadius: 14, background: 'rgba(255,255,255,0.24)', color: '#3a2c20', lineHeight: 1.8 }}>
            {aftermath.conclusion}
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 20 }}>
            <GlimmerButton tone="primary" onClick={onBack}>回到城市</GlimmerButton>
            {(npc.ending === 'success' || npc.ending === 'failed') && (
              <GlimmerButton onClick={onOpenReconciliation}>進入自我和解</GlimmerButton>
            )}
            {npc.ending === 'none' && (
              <div style={{ color: '#5a4a2a', fontSize: 12, fontStyle: 'italic', alignSelf: 'center' }}>
                尚在進行中。完成修復後才能進入自我和解。
              </div>
            )}
          </div>
        </GlassPanel>
      </div>
    </GuiFrame>
  );
}
