// ============================================================
// Chapter Selector Modal — Shift+F9 in Playtest Mode
// ============================================================

import {
  CHAPTERS,
  useNarrativePlaytestStore,
  type ChapterInfo,
} from '../store/narrativePlaytestStore';
import { useGameStore } from '../store/gameStore';

// ---- Style Tokens ----
const OVERLAY: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 100000,
  background: 'rgba(0,0,0,0.75)',
  backdropFilter: 'blur(4px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const MODAL: React.CSSProperties = {
  background: '#141820',
  border: '1px solid rgba(120,200,255,0.2)',
  borderRadius: 12,
  padding: '24px 28px',
  minWidth: 460,
  maxWidth: 520,
  color: '#c8d6e5',
  fontFamily: "'JetBrains Mono', 'Cascadia Code', monospace",
  fontSize: 12,
};

const HEADER: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 16,
  paddingBottom: 10,
  borderBottom: '1px solid rgba(255,255,255,0.08)',
};

const CARD: React.CSSProperties = {
  padding: '12px 14px',
  marginBottom: 8,
  borderRadius: 8,
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.06)',
  cursor: 'pointer',
  transition: 'all 0.15s ease',
};

const CARD_AVAILABLE: React.CSSProperties = {
  ...CARD,
  borderColor: 'rgba(120,200,255,0.18)',
};

const CARD_LOCKED: React.CSSProperties = {
  ...CARD,
  opacity: 0.45,
  cursor: 'not-allowed',
};

type Props = {
  onSelectChapter: (depth: number) => void;
};

export default function ChapterSelectorModal({ onSelectChapter }: Props) {
  const close = useNarrativePlaytestStore((s) => s.closeChapterSelector);
  const save = useGameStore((s) => s.save);
  const bridgeArtist = save.npcs.bridge_artist;
  const { knowledge } = bridgeArtist;
  const { trust } = bridgeArtist;

  const isUnlocked = (ch: ChapterInfo) =>
    trust >= ch.requiredTrust && knowledge >= ch.requiredKnowledge;

  return (
    <div style={OVERLAY} onClick={close}>
      <div style={MODAL} onClick={(e) => e.stopPropagation()}>
        <div style={HEADER}>
          <span style={{ color: '#7ec8ff', fontWeight: 700, letterSpacing: 1, fontSize: 13 }}>
            ▸ 選擇內心世界章節
          </span>
          <button
            onClick={close}
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: '#889',
              borderRadius: 4,
              cursor: 'pointer',
              padding: '2px 8px',
              fontSize: 12,
              fontFamily: 'inherit',
            }}
          >
            ✕
          </button>
        </div>

        {CHAPTERS.map((ch) => {
          const unlocked = isUnlocked(ch);
          const style = unlocked ? CARD_AVAILABLE : CARD_LOCKED;

          return (
            <div
              key={ch.depth}
              style={style}
              onClick={() => { if (unlocked) { close(); onSelectChapter(ch.depth); } }}
              title={unlocked ? `進入 ${ch.title}` : `需求：信任≥${ch.requiredTrust} + 知識≥${ch.requiredKnowledge}`}
            >
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 4,
              }}>
                <span style={{
                  color: unlocked ? '#adf' : '#556',
                  fontWeight: 700,
                  fontSize: 12,
                }}>
                  {unlocked ? '●' : '○'} {ch.title}
                </span>
                {!unlocked && (
                  <span style={{ color: '#544', fontSize: 10 }}>
                    信任≥{ch.requiredTrust} 知識≥{ch.requiredKnowledge}
                  </span>
                )}
              </div>
              <div style={{ color: unlocked ? '#889' : '#445', fontSize: 11, lineHeight: 1.5 }}>
                {ch.description}
              </div>
            </div>
          );
        })}

        <div style={{
          marginTop: 12,
          paddingTop: 8,
          borderTop: '1px solid rgba(255,255,255,0.06)',
          color: '#556',
          fontSize: 10,
          textAlign: 'right',
        }}>
          點擊空白處關閉 · 使用 F7 強制解鎖章節條件
        </div>
      </div>
    </div>
  );
}
