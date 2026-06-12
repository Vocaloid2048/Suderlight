import { useState, useCallback } from 'react';
import {
  GuiFrame,
  GlassPanel,
  GlimmerButton,
} from '../components';
import {
  gloryGalleryLayer,
  getAllInteractables,
  type GalleryInteractable,
  type UnderstandingReward,
} from '../data/psychologicalWorlds/bridgePainterWorld';
import {
  tryAddInsight,
  getInsightFragments,
  hasInsight,
  type UnderstandingState,
} from '../systems/understandingSystem';

// ============================================================
// Props
// ============================================================

type Props = {
  /** 返回表世界時傳出最新深度 */
  onReturnToSurface: (depth: number) => void;
};

// ---- 本地暫存（discoveredIds 不需要持久化） ----
type Layer1Save = {
  entered: boolean;
  discoveredIds: string[];
};

// ---- 視圖狀態 ----
type ViewState =
  | { phase: 'entering' }
  | { phase: 'exploring' }
  | { phase: 'observing'; target: GalleryInteractable; showDeep: boolean }
  | { phase: 'reflecting'; target: GalleryInteractable }
  | { phase: 'insight_revealed'; target: GalleryInteractable; reward: UnderstandingReward };

export default function BridgePainterInnerWorld({
  onReturnToSurface,
}: Props) {
  const [save, setSave] = useState<Layer1Save>({
    entered: false,
    discoveredIds: [],
  });
  const [understanding, setUnderstanding] = useState<UnderstandingState>(() => ({
    insightIds: [],
  }));
  const [view, setView] = useState<ViewState>({ phase: 'entering' });

  // ---- 進入 ----
  const handleEnter = useCallback(() => {
    setSave(s => ({ ...s, entered: true }));
    setView({ phase: 'exploring' });
  }, []);

  // ---- 點擊物件 → 觀察 ----
  const handleClickObject = useCallback((obj: GalleryInteractable) => {
    setSave(s => {
      if (!s.discoveredIds.includes(obj.id)) {
        // ---- narrative debug: record inner world discovery ----
        if (import.meta.env.DEV) {
          import('../store/narrativeDebugStore').then(({ useNarrativeDebugStore }) => {
            useNarrativeDebugStore.getState().recordDiscover(obj.id);
          });
        }
        return { ...s, discoveredIds: [...s.discoveredIds, obj.id] };
      }
      return s;
    });
    setView({ phase: 'observing', target: obj, showDeep: false });
  }, []);

  // ---- 仔細觀察 → 顯示深層訊息 ----
  const handleLookCloser = useCallback(() => {
    if (view.phase === 'observing') {
      setView({ phase: 'observing', target: view.target, showDeep: true });
    }
  }, [view]);

  // ---- 開始反思（顯示選項） ----
  const handleStartReflection = useCallback(() => {
    if (view.phase === 'observing') {
      setView({ phase: 'reflecting', target: view.target });
    }
  }, [view]);

  // ---- 選擇反思 ----
  const handleChooseReflection = useCallback(
    (choseInsight: boolean) => {
      if (view.phase !== 'reflecting') return;

      const { state: newUnderstanding, reward } = tryAddInsight(
        understanding,
        view.target.id,
        choseInsight,
      );

      if (!reward) {
        // 選了 insight:false → 回到探索
        setView({ phase: 'exploring' });
        return;
      }

      // 選了 insight:true → 更新後台理解度，顯示洞察
      // ---- narrative debug: record inner world insight completion ----
      if (import.meta.env.DEV) {
        import('../store/narrativeDebugStore').then(({ useNarrativeDebugStore }) => {
          useNarrativeDebugStore.getState().recordComplete(view.target.id);
        });
      }
      setUnderstanding(newUnderstanding);
      setView({ phase: 'insight_revealed', target: view.target, reward });
    },
    [view, understanding],
  );

  // ---- 關閉洞察，回到探索 ----
  const handleCloseInsight = useCallback(() => {
    setView({ phase: 'exploring' });
  }, []);

  // ---- 計算深度 (0-3) ----
  // ---- 計算深度 (0-3) ----
  const computeDepth = (count: number): number => {
    if (count === 0) return 0;
    if (count === 1) return 1;
    if (count <= 3) return 2;
    return 3;
  };

  // ---- 返回表世界 ----
  const handleReturn = useCallback(() => {
    const depth = computeDepth(understanding.insightIds.length);
    onReturnToSurface(depth);
  }, [understanding.insightIds.length, onReturnToSurface]);
  // ---- 派生資料 ----
  const insightFragments = getInsightFragments(understanding);
  const insightCount = understanding.insightIds.length;

  // ============================================================
  // Render: 進入畫面 (entering)
  // ============================================================
  if (view.phase === 'entering') {
    return (
      <GuiFrame tone="inner">
        <div
          style={{
            position: 'relative',
            zIndex: 2,
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 48,
          }}
        >
          <GlassPanel
            title="第一層"
            subtitle="榮耀美術館"
            variant="warm"
            style={{ maxWidth: 620, width: '100%', textAlign: 'center' }}
          >
            <div
              style={{
                color: '#d8c29b',
                fontSize: 15,
                lineHeight: 2.2,
                whiteSpace: 'pre-line',
                marginBottom: 28,
              }}
            >
              {gloryGalleryLayer.sceneDescription}
            </div>
            <GlimmerButton tone="primary" onClick={handleEnter}>
              踏入美術館
            </GlimmerButton>
          </GlassPanel>
        </div>
      </GuiFrame>
    );
  }

  // ============================================================
  // Render: 探索畫面 (exploring) + 所有子狀態共用
  // ============================================================
  const interactables = getAllInteractables();
  const isModalOpen = view.phase !== 'exploring';

  return (
    <GuiFrame tone="inner">
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          height: '100%',
          display: 'grid',
          gridTemplateColumns: '240px 1fr',
          gap: 20,
          padding: 28,
        }}
      >
        {/* ---- 左側欄：氛圍描述 + 理解碎片 ---- */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <GlassPanel
            title="榮耀美術館"
            subtitle="第一層 · 心理世界"
            variant="warm"
            contentStyle={{ display: 'flex', flexDirection: 'column', gap: 10 }}
          >
            <div
              style={{
                color: '#b0a58b',
                fontSize: 13,
                lineHeight: 1.9,
                whiteSpace: 'pre-line',
              }}
            >
              金色燈光照亮空蕩的大廳。
              所有的榮耀都像被保鮮膜包著——
              完美，但無法觸碰。
            </div>


          </GlassPanel>

          {/* 理解碎片 */}
          {insightCount > 0 && (
            <GlassPanel
              title="理解碎片"
              subtitle="理解片段"
              variant="paper"
              contentStyle={{ display: 'flex', flexDirection: 'column', gap: 10 }}
            >
              {insightFragments.map((fragment, i) => (
                <div
                  key={i}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 8,
                    background: 'rgba(214,163,94,0.1)',
                    border: '1px solid rgba(214,163,94,0.18)',
                    color: '#4a3620',
                    fontSize: 13,
                    lineHeight: 1.7,
                    fontStyle: 'italic',
                  }}
                >
                  「{fragment}」
                </div>
              ))}
            </GlassPanel>
          )}

          {/* 返回按鈕 */}
          <GlimmerButton tone="quiet" onClick={handleReturn} fullWidth>
            返回表世界
          </GlimmerButton>
        </aside>

        {/* ---- 右側主區域：3×3 網格美術館 ---- */}
        <main
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: isModalOpen ? 0.3 : 1,
            pointerEvents: isModalOpen ? 'none' : 'auto',
            transition: 'opacity 0.3s ease',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 160px)',
              gridTemplateRows: 'repeat(3, 120px)',
              gap: 16,
              padding: 24,
              borderRadius: 20,
              background:
                'radial-gradient(ellipse at center, rgba(45,36,22,0.5), rgba(18,14,10,0.85))',
              border: '1px solid rgba(214,163,94,0.12)',
            }}
          >
            {/* 渲染 3×3 網格 */}
            {Array.from({ length: 3 }).map((_, row) =>
              Array.from({ length: 3 }).map((_, col) => {
                const obj = interactables.find(o => o.row === row && o.col === col);
                const isDiscovered = obj ? save.discoveredIds.includes(obj.id) : false;
                const objHasInsight = obj ? hasInsight(understanding, obj.id) : false;

                if (!obj) {
                  // 空地板
                  return (
                    <div
                      key={`${row}-${col}`}
                      style={{
                        borderRadius: 12,
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px dashed rgba(255,255,255,0.05)',
                      }}
                    />
                  );
                }

                return (
                  <button
                    key={obj.id}
                    onClick={() => handleClickObject(obj)}
                    style={{
                      borderRadius: 12,
                      background: objHasInsight
                        ? 'linear-gradient(135deg, rgba(214,163,94,0.16), rgba(138,91,45,0.1))'
                        : isDiscovered
                          ? 'rgba(255,255,255,0.06)'
                          : 'rgba(255,255,255,0.04)',
                      border: objHasInsight
                        ? '1px solid rgba(214,163,94,0.4)'
                        : isDiscovered
                          ? '1px solid rgba(255,255,255,0.12)'
                          : '1px solid rgba(255,255,255,0.06)',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      padding: 12,
                      transition: 'all 0.2s ease',
                      color: objHasInsight ? '#f5c16c' : isDiscovered ? '#c0b89a' : '#6b6352',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = objHasInsight
                        ? 'linear-gradient(135deg, rgba(214,163,94,0.24), rgba(138,91,45,0.16))'
                        : 'rgba(255,255,255,0.08)';
                      e.currentTarget.style.borderColor = 'rgba(214,163,94,0.35)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = objHasInsight
                        ? 'linear-gradient(135deg, rgba(214,163,94,0.16), rgba(138,91,45,0.1))'
                        : isDiscovered
                          ? 'rgba(255,255,255,0.06)'
                          : 'rgba(255,255,255,0.04)';
                      e.currentTarget.style.borderColor = objHasInsight
                        ? 'rgba(214,163,94,0.4)'
                        : isDiscovered
                          ? '1px solid rgba(255,255,255,0.12)'
                          : '1px solid rgba(255,255,255,0.06)';
                    }}
                  >
                    <div style={{ fontSize: 24, opacity: objHasInsight ? 1 : 0.6 }}>
                      {getIconForObject(obj.id)}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        letterSpacing: 0.5,
                        fontWeight: objHasInsight ? 600 : 400,
                      }}
                    >
                      {obj.name}
                      {objHasInsight && (
                        <span style={{ marginLeft: 4, fontSize: 10 }}>✦</span>
                      )}
                    </div>
                  </button>
                );
              }),
            )}
          </div>
        </main>

        {/* ---- 模態層：觀察 / 反思 / 洞察 ---- */}
        {isModalOpen && <ModalOverlay view={view} onClose={handleCloseInsight} />}

        {/* 觀察層：在模態之外，當 observing 時顯示 */}
        {(view.phase === 'observing' || view.phase === 'reflecting') && (
          <ObservingPanel
            view={view}
            onLookCloser={handleLookCloser}
            onStartReflection={handleStartReflection}
            onChooseReflection={handleChooseReflection}
            onClose={handleCloseInsight}
          />
        )}

        {/* 洞察揭示層 */}
        {view.phase === 'insight_revealed' && (
          <InsightPanel view={view} onClose={handleCloseInsight} />
        )}
      </div>
    </GuiFrame>
  );
}

// ============================================================
// 輔助子組件
// ============================================================

/** 物件對應圖示 */
function getIconForObject(id: string): string {
  const map: Record<string, string> = {
    champion_painting: '🎨',
    award_trophy: '🏆',
    media_interview: '📰',
    audience_wall: '💬',
    signature_display: '✍️',
  };
  return map[id] ?? '📦';
}

/** 半透明背景遮罩 */
function ModalOverlay({
  onClose,
}: {
  view: ViewState;
  onClose: () => void;
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 3,
        background: 'rgba(0,0,0,0.35)',
      }}
    />
  );
}

/** 觀察面板（surfaceInfo → deepMessage → 反思選項） */
function ObservingPanel({
  view,
  onLookCloser,
  onStartReflection,
  onChooseReflection,
}: {
  view: ViewState & { phase: 'observing' | 'reflecting' };
  onLookCloser: () => void;
  onStartReflection: () => void;
  onChooseReflection: (choseInsight: boolean) => void;
  onClose: () => void;
}) {
  const { target, showDeep } =
    view.phase === 'reflecting'
      ? { target: view.target, showDeep: true }
      : { target: view.target, showDeep: view.showDeep };

  return (
    <GlassPanel
      title={target.name}
      subtitle={
        view.phase === 'reflecting' ? '你的想法是…' : '觀察'
      }
      variant="warm"
      style={{
        position: 'absolute',
        right: 48,
        top: '50%',
        transform: 'translateY(-50%)',
        zIndex: 4,
        width: 380,
        maxHeight: '80vh',
        overflowY: 'auto',
      }}
    >
      {/* 表面資訊 */}
      <div
        style={{
          color: '#d8c29b',
          fontSize: 14,
          lineHeight: 1.9,
          whiteSpace: 'pre-line',
          marginBottom: 16,
        }}
      >
        {target.surfaceInfo}
      </div>

      {/* 深層訊息 */}
      {showDeep && (
        <div
          style={{
            marginTop: 0,
            marginBottom: 16,
            padding: '14px 16px',
            borderRadius: 10,
            background: 'rgba(0,0,0,0.35)',
            border: '1px solid rgba(214,163,94,0.15)',
            color: '#c8bca0',
            fontSize: 13.5,
            lineHeight: 2,
            whiteSpace: 'pre-line',
          }}
        >
          {target.deepMessage}
        </div>
      )}

      {/* 按鈕列 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {!showDeep && (
          <GlimmerButton tone="primary" onClick={onLookCloser} fullWidth>
            仔細觀察
          </GlimmerButton>
        )}

        {showDeep && view.phase === 'observing' && (
          <GlimmerButton tone="primary" onClick={onStartReflection} fullWidth>
            思考一下…
          </GlimmerButton>
        )}

        {view.phase === 'reflecting' && (
          <>
            {/* 反思選項 A：表層（insight: false） */}
            <GlimmerButton
              tone="ghost"
              onClick={() => onChooseReflection(false)}
              fullWidth
            >
              {target.reflectionChoices[0]?.text ?? '…'}
            </GlimmerButton>

            {/* 反思選項 B：真正理解（insight: true） */}
            <GlimmerButton
              tone="primary"
              onClick={() => onChooseReflection(true)}
              fullWidth
            >
              {target.reflectionChoices[1]?.text ?? '…'}
            </GlimmerButton>
          </>
        )}
      </div>
    </GlassPanel>
  );
}

/** 洞察揭示面板 */
function InsightPanel({
  view,
  onClose,
}: {
  view: ViewState & { phase: 'insight_revealed' };
  onClose: () => void;
}) {
  const { target, reward } = view;

  return (
    <GlassPanel
      title="理解片段"
      subtitle={target.name}
      variant="paper"
      style={{
        position: 'absolute',
        right: 48,
        top: '50%',
        transform: 'translateY(-50%)',
        zIndex: 4,
        width: 380,
      }}
    >
      <div
        style={{
          padding: '16px 0',
          color: '#3a2a14',
          fontSize: 15,
          lineHeight: 2,
          fontStyle: 'italic',
          textAlign: 'center',
        }}
      >
        「{reward.reason}」
      </div>

      <div
        style={{
          marginTop: 8,
          padding: '10px 14px',
          borderRadius: 8,
          background: 'rgba(214,163,94,0.15)',
          border: '1px solid rgba(214,163,94,0.2)',
          color: '#5a4328',
          fontSize: 12.5,
          lineHeight: 1.7,
        }}
      >
        {target.insight}
      </div>

      <div style={{ marginTop: 18 }}>
        <GlimmerButton tone="primary" onClick={onClose} fullWidth>
          繼續探索
        </GlimmerButton>
      </div>
    </GlassPanel>
  );
}
