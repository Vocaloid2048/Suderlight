// ============================================================
// Narrative Debug Overlay (DEV ONLY — tree-shaken in production)
//
// Displays:
//   1. NPC Internal State
//   2. Dialogue State
//   3. Player Knowledge State
//   4. AI Reasoning Summary (NO chain-of-thought)
// ============================================================

import { useMemo } from 'react';
import { useGameStore } from '../store/gameStore';
import { useNarrativeDebugStore } from '../store/narrativeDebugStore';
import { bridgeArtistClues } from '../data/verticalSlice';
import type { ClueId } from '../data/verticalSlice';
import type { NpcRuntimeState } from '../systems/npcStateEngine';

// ---- style tokens ----
const PANEL: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  right: 0,
  width: 420,
  maxHeight: '100vh',
  overflowY: 'auto',
  zIndex: 99990,
  background: 'rgba(10,12,18,0.94)',
  borderLeft: '1px solid rgba(120,200,255,0.15)',
  boxShadow: '-4px 0 32px rgba(0,0,0,0.6)',
  fontFamily: "'JetBrains Mono', 'Cascadia Code', 'Consolas', monospace",
  fontSize: 11.5,
  color: '#c8d6e5',
  padding: '14px 16px 24px',
  boxSizing: 'border-box',
  backdropFilter: 'blur(8px)',
};

const HEADER: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 12,
  paddingBottom: 8,
  borderBottom: '1px solid rgba(255,255,255,0.08)',
};

const SECTION: React.CSSProperties = {
  marginBottom: 14,
  padding: '10px 12px',
  borderRadius: 8,
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.06)',
};

const SECTION_TITLE: React.CSSProperties = {
  color: '#7ec8ff',
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 1,
  textTransform: 'uppercase' as const,
  marginBottom: 8,
};

const ROW: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '3px 0',
  lineHeight: 1.6,
};

const LABEL: React.CSSProperties = { color: '#8899aa', flexShrink: 0 };
const VALUE: React.CSSProperties = { color: '#dde4ef', fontWeight: 500, textAlign: 'right' };

// ---- helpers ----

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, justifyContent: 'flex-end' }}>
      <div style={{ width: 80, height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', borderRadius: 4, background: color, transition: 'width 0.3s ease' }} />
      </div>
      <span style={{ ...VALUE, minWidth: 28, fontSize: 11 }}>{value}</span>
    </div>
  );
}

function emotionalLabel(npc: NpcRuntimeState): string {
  if (npc.ending === 'success') return '修復完成';
  if (npc.ending === 'failed') return '對話崩潰';
  if (npc.stress >= 90) return '崩潰邊緣';
  if (npc.stress >= 70) return '痛苦';
  if (npc.stress >= 50) return '緊繃';
  if (npc.stress >= 30) return '警覺';
  return '平靜';
}

function opennessLabel(npc: NpcRuntimeState): string {
  if (npc.innerWorldUnlocked) return '已敞開';
  if (npc.trust >= 50) return '試探性開放';
  if (npc.trust >= 30) return '防備';
  return '封閉';
}

function defensivenessLabel(npc: NpcRuntimeState): string {
  if (npc.ending === 'failed') return '已崩潰';
  if (npc.stress > 70) return '高度防衛';
  if (npc.stress > 40) return '中度防衛';
  return '低防衛';
}

function flagName(flag: string): string {
  const map: Record<string, string> = {
    safety_redirect_triggered: '🛡 危機攔截',
    player_used_forced_comfort: '❌ 強制安慰',
    player_consumed_genius_identity: '❌ 天才消費',
    player_offered_presence: '✅ 陪伴接納',
    player_grounded_in_present_sense: '✅ 感官接地',
    player_pressed_unearned_truth: '❌ 未獲真相',
    painter_reacted_to_brush: '🖌 畫筆反應',
    painter_acknowledged_accident: '📰 真相接近',
    painter_sketchbook_understood: '📓 素描理解',
    inner_world_unlocked: '🔓 內心解鎖',
    bridge_artist_failed: '💀 失敗',
    bridge_artist_repaired: '✨ 修復',
  };
  return map[flag] ?? flag;
}

// ---- branch analysis ----

type Branch = {
  label: string;
  trigger: string;
  available: boolean;
  requirement: string;
};

function computeBranches(clues: ClueId[]): { unlocked: Branch[]; locked: Branch[] } {
  const all: Branch[] = [
    { label: '安全攔截', trigger: '危機詞', available: true, requirement: '永遠可用' },
    { label: '強制安慰', trigger: '加油/振作/…', available: true, requirement: '永遠可用' },
    { label: '天才消費', trigger: '天才/大師/…', available: true, requirement: '永遠可用' },
    { label: '陪伴接納', trigger: '陪伴/慢慢來/…', available: true, requirement: '永遠可用' },
    { label: '感官接地', trigger: '雨聲/風/…', available: true, requirement: '永遠可用' },
    { label: '畫筆反應', trigger: '畫筆', available: clues.includes('brush'), requirement: '需收集：畫筆' },
    { label: '真相對話', trigger: '車禍/報紙/…', available: clues.includes('newspaper') || clues.includes('accident_report'), requirement: '需收集：報紙 or 車禍報導' },
    { label: '素描理解', trigger: '素描/春天/…', available: clues.includes('sketchbook'), requirement: '需收集：素描本' },
  ];
  return {
    unlocked: all.filter((b) => b.available),
    locked: all.filter((b) => !b.available),
  };
}

// ============================================================
type Props = { currentScreen: string };

export default function NarrativeDebugOverlay({ currentScreen }: Props) {
  const save = useGameStore((s) => s.save);
  const lastEval = useNarrativeDebugStore((s) => s.lastEvaluation);
  const innerWorldEvents = useNarrativeDebugStore((s) => s.innerWorldEvents);
  const toggle = useNarrativeDebugStore((s) => s.toggle);

  const npc = save.npcs.bridge_artist;
  const allClueIds: ClueId[] = ['brush', 'newspaper', 'sketchbook', 'accident_report'];
  const branches = useMemo(() => computeBranches(save.collectedClues), [save.collectedClues]);
  const completedCount = innerWorldEvents.filter((e) => e.completed).length;

  return (
    <div style={PANEL}>
      {/* ---- header ---- */}
      <div style={HEADER}>
        <span style={{ color: '#7ec8ff', fontWeight: 700, letterSpacing: 1 }}>
          NARRATIVE DEBUG
        </span>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ color: '#556', fontSize: 10 }}>F8 / Ctrl+Shift+D</span>
          <button
            onClick={toggle}
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: '#889',
              borderRadius: 4,
              cursor: 'pointer',
              padding: '2px 8px',
              fontSize: 11,
              fontFamily: 'inherit',
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* ---- screen indicator ---- */}
      <div style={{ color: '#556', fontSize: 10, marginBottom: 10 }}>
        screen: {currentScreen}
      </div>

      {/* ================================================================ */}
      {/* 1. NPC Internal State                                             */}
      {/* ================================================================ */}
      <div style={SECTION}>
        <div style={SECTION_TITLE}>1. NPC Internal State — {npc.name}</div>
        <div style={ROW}><span style={LABEL}>Emotional State</span><span style={{ ...VALUE, color: emotionColor(npc) }}>{emotionalLabel(npc)}</span></div>
        <div style={ROW}><span style={LABEL}>Trust</span><Bar value={npc.trust} max={100} color={npc.trust >= 50 ? '#4caf50' : npc.trust >= 30 ? '#ff9800' : '#f44336'} /></div>
        <div style={ROW}><span style={LABEL}>Stress</span><Bar value={npc.stress} max={100} color={npc.stress <= 30 ? '#4caf50' : npc.stress <= 60 ? '#ff9800' : '#f44336'} /></div>
        <div style={ROW}><span style={LABEL}>Openness</span><span style={VALUE}>{opennessLabel(npc)}</span></div>
        <div style={ROW}><span style={LABEL}>Defensiveness</span><span style={VALUE}>{defensivenessLabel(npc)}</span></div>
        <div style={ROW}><span style={LABEL}>Ending</span><span style={{ ...VALUE, color: npc.ending === 'success' ? '#4caf50' : npc.ending === 'failed' ? '#f44336' : '#889' }}>{npc.ending === 'none' ? 'ongoing' : npc.ending}</span></div>
        <div style={ROW}><span style={LABEL}>Inner Depth</span><span style={VALUE}>{npc.innerWorldDepth} / 3</span></div>
        <div style={ROW}><span style={LABEL}>Knowledge Req</span><span style={VALUE}>{save.player.knowledge}/{npc.knowledgeRequired}</span></div>
        {npc.flags.length > 0 && (
          <div style={{ marginTop: 6, borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 6 }}>
            <div style={{ ...LABEL, marginBottom: 4 }}>Flags</div>
            {npc.flags.map((f, i) => (
              <div key={i} style={{ color: '#aab', fontSize: 10.5, padding: '1px 0' }}>  {flagName(f)}</div>
            ))}
          </div>
        )}
      </div>

      {/* ================================================================ */}
      {/* 2. Dialogue State                                                */}
      {/* ================================================================ */}
      <div style={SECTION}>
        <div style={SECTION_TITLE}>2. Dialogue State</div>
        <div style={ROW}><span style={LABEL}>Dialogue Depth</span><span style={VALUE}>Lv.{npc.innerWorldDepth}</span></div>

        <div style={{ marginTop: 8 }}>
          <div style={{ color: '#4caf50', fontSize: 10, letterSpacing: 0.5, marginBottom: 4 }}>
            ▸ UNLOCKED ({branches.unlocked.length})
          </div>
          {branches.unlocked.map((b, i) => (
            <div key={i} style={{ fontSize: 10.5, color: '#8a9', padding: '1px 0', display: 'flex', justifyContent: 'space-between' }}>
              <span>  {b.label}</span>
              <span style={{ color: '#556', fontSize: 10 }}>{b.trigger}</span>
            </div>
          ))}
        </div>

        {branches.locked.length > 0 && (
          <div style={{ marginTop: 6 }}>
            <div style={{ color: '#f44336', fontSize: 10, letterSpacing: 0.5, marginBottom: 4 }}>
              ▸ LOCKED ({branches.locked.length})
            </div>
            {branches.locked.map((b, i) => (
              <div key={i} style={{ fontSize: 10.5, color: '#877', padding: '1px 0' }}>
                <span>  {b.label}</span>
                <span style={{ color: '#544', fontSize: 10, marginLeft: 8 }}>— {b.requirement}</span>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: 6, borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 4 }}>
          <div style={{ ...LABEL, fontSize: 10 }}>Unlock Threshold</div>
          <div style={{ fontSize: 10.5, color: '#aab' }}>
            trust≥{npc.trustRequired} + knowledge≥{npc.knowledgeRequired}
          </div>
        </div>
      </div>

      {/* ================================================================ */}
      {/* 3. Player Knowledge State                                        */}
      {/* ================================================================ */}
      <div style={SECTION}>
        <div style={SECTION_TITLE}>3. Player Knowledge State</div>
        <div style={ROW}><span style={LABEL}>Knowledge</span><Bar value={save.player.knowledge} max={100} color="#2196f3" /></div>
        <div style={ROW}><span style={LABEL}>Location</span><span style={VALUE}>{save.currentLocation}</span></div>

        {/* discovered memories (collected clues) */}
        <div style={{ marginTop: 8 }}>
          <div style={{ color: '#4caf50', fontSize: 10, letterSpacing: 0.5, marginBottom: 4 }}>
            ▸ Discovered Memories ({save.collectedClues.length})
          </div>
          {save.collectedClues.length === 0 && <div style={{ color: '#556', fontSize: 10.5 }}>  (none yet)</div>}
          {save.collectedClues.map((cid) => {
            const clue = bridgeArtistClues[cid];
            return (
              <div key={cid} style={{ fontSize: 10.5, color: '#8c9', padding: '1px 0', display: 'flex', justifyContent: 'space-between' }}>
                <span>  {clue?.icon ?? '📦'} {clue?.shortLabel ?? cid}</span>
                <span style={{ color: '#556' }}>+{clue?.knowledge ?? 0}k</span>
              </div>
            );
          })}
        </div>

        {/* missed memories */}
        <div style={{ marginTop: 6 }}>
          <div style={{ color: '#ff9800', fontSize: 10, letterSpacing: 0.5, marginBottom: 4 }}>
            ▸ Missed Memories
          </div>
          {allClueIds.filter((c) => !save.collectedClues.includes(c)).map((cid) => {
            const clue = bridgeArtistClues[cid];
            return (
              <div key={cid} style={{ fontSize: 10.5, color: '#876', padding: '1px 0' }}>
                <span>  {clue?.icon ?? '?'} {clue?.shortLabel ?? cid}</span>
                <span style={{ color: '#443', fontSize: 10, marginLeft: 6 }}>— {clue?.locationId}</span>
              </div>
            );
          })}
          {allClueIds.every((c) => save.collectedClues.includes(c)) && (
            <div style={{ color: '#556', fontSize: 10.5 }}>  (all collected!)</div>
          )}
        </div>

        {/* inner world events */}
        <div style={{ marginTop: 8, borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 6 }}>
          <div style={{ color: '#ab47bc', fontSize: 10, letterSpacing: 0.5, marginBottom: 4 }}>
            ▸ Inner World Events ({completedCount}/{innerWorldEvents.length} insight)
          </div>
          {innerWorldEvents.map((ev) => (
            <div key={ev.id} style={{ fontSize: 10.5, padding: '1px 0', display: 'flex', justifyContent: 'space-between', color: ev.completed ? '#c9a' : ev.discovered ? '#887' : '#556' }}>
              <span>  {ev.completed ? '✦' : ev.discovered ? '○' : '·'} {ev.name}</span>
              <span style={{ fontSize: 10, color: ev.completed ? '#a6c' : '#556' }}>
                {ev.completed ? 'insight' : ev.discovered ? 'found' : 'hidden'}
              </span>
            </div>
          ))}
        </div>

        {/* ghost records */}
        {save.ghosts.length > 0 && (
          <div style={{ marginTop: 6, borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 6 }}>
            <div style={{ color: '#f44336', fontSize: 10, letterSpacing: 0.5 }}>▸ Ghosts ({save.ghosts.length})</div>
            {save.ghosts.map((g, i) => (
              <div key={i} style={{ fontSize: 10, color: '#a55', padding: '1px 0' }}>
                {g.npc} — {g.memoryText}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ================================================================ */}
      {/* 4. AI Reasoning Summary (NO chain-of-thought)                    */}
      {/* ================================================================ */}
      <div style={{ ...SECTION, borderColor: 'rgba(100,180,255,0.15)' }}>
        <div style={SECTION_TITLE}>4. AI Reasoning Summary</div>

        {!lastEval ? (
          <div style={{ color: '#556', fontSize: 10.5 }}>No dialogue evaluation yet.</div>
        ) : (
          <>
            {/* relevant triggers */}
            <div style={{ marginBottom: 8 }}>
              <div style={{ color: '#64b5f6', fontSize: 10, letterSpacing: 0.5, marginBottom: 4 }}>
                ▸ Relevant Triggers
              </div>
              {lastEval.flags.length === 0 && <div style={{ color: '#556', fontSize: 10.5 }}>  (no specific triggers)</div>}
              {lastEval.flags.map((f, i) => (
                <div key={i} style={{ fontSize: 10.5, color: '#adf', padding: '1px 0' }}>
                  {flagName(f)}
                </div>
              ))}
            </div>

            {/* state changes */}
            <div style={{ marginBottom: 8 }}>
              <div style={{ color: '#64b5f6', fontSize: 10, letterSpacing: 0.5, marginBottom: 4 }}>
                ▸ State Changes
              </div>
              <div style={ROW}>
                <span style={LABEL}>Trust Δ</span>
                <span style={{ color: lastEval.trustDelta >= 0 ? '#4caf50' : '#f44336', fontWeight: 600 }}>
                  {lastEval.trustDelta >= 0 ? '+' : ''}{lastEval.trustDelta}
                </span>
              </div>
              <div style={ROW}>
                <span style={LABEL}>Stress Δ</span>
                <span style={{ color: lastEval.stressDelta <= 0 ? '#4caf50' : '#f44336', fontWeight: 600 }}>
                  {lastEval.stressDelta >= 0 ? '+' : ''}{lastEval.stressDelta}
                </span>
              </div>
              {lastEval.safetyRedirect && (
                <div style={{ color: '#ff9800', fontSize: 10.5, marginTop: 2 }}>⚠ Safety Redirect</div>
              )}
            </div>

            {/* dialogue unlock reasons */}
            <div>
              <div style={{ color: '#64b5f6', fontSize: 10, letterSpacing: 0.5, marginBottom: 4 }}>
                ▸ Dialogue Unlock Reason
              </div>
              <div style={{ fontSize: 10.5, color: '#cde', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                {lastEval.reason}
              </div>
              {lastEval.innerWorldUnlocked && (
                <div style={{ marginTop: 4, color: '#ab47bc', fontSize: 10.5, fontWeight: 600 }}>
                  🔓 Inner World unlocked
                </div>
              )}
              {lastEval.ending === 'failed' && (
                <div style={{ marginTop: 4, color: '#f44336', fontSize: 10.5, fontWeight: 600 }}>
                  💀 NPC reached failure state
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ---- footer ---- */}
      <div style={{ color: '#334', fontSize: 9.5, textAlign: 'center', marginTop: 8 }}>
        Narrative Debug · DEV ONLY · F8 to toggle
      </div>
    </div>
  );
}

function emotionColor(npc: NpcRuntimeState): string {
  if (npc.ending === 'success') return '#4caf50';
  if (npc.ending === 'failed') return '#f44336';
  if (npc.stress >= 70) return '#f44336';
  if (npc.stress >= 50) return '#ff9800';
  return '#4caf50';
}
