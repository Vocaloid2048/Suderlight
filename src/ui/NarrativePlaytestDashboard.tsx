// ============================================================
// Narrative QA / Playtest Dashboard
// 顯示所有內部數值、AI 解讀與敘事事件 — 評審用
// ============================================================

import { useMemo, useState, useEffect, useCallback } from 'react';
import { useGameStore } from '../store/gameStore';
import {
  useNarrativePlaytestStore,
  CHAPTERS,
} from '../store/narrativePlaytestStore';
import { bridgeArtistClues } from '../data/verticalSlice';
import type { ClueId } from '../data/verticalSlice';
import type { NpcRuntimeState } from '../systems/npcStateEngine';

// ---- Style Tokens ----
const PANEL: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  right: 0,
  width: 440,
  maxHeight: '100vh',
  overflowY: 'auto',
  zIndex: 99990,
  background: 'rgba(10,12,18,0.95)',
  borderLeft: '1px solid rgba(120,200,255,0.15)',
  boxShadow: '-4px 0 40px rgba(0,0,0,0.7)',
  fontFamily: "'JetBrains Mono', 'Cascadia Code', 'Consolas', monospace",
  fontSize: 11,
  color: '#c8d6e5',
  padding: '14px 16px 20px',
  boxSizing: 'border-box',
  backdropFilter: 'blur(8px)',
};

const HEADER_ROW: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 10,
  paddingBottom: 8,
  borderBottom: '1px solid rgba(255,255,255,0.08)',
};

const SECTION: React.CSSProperties = {
  marginBottom: 12,
  padding: '10px 12px',
  borderRadius: 8,
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.06)',
};

const SEC_TITLE: React.CSSProperties = {
  color: '#7ec8ff',
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: 1,
  textTransform: 'uppercase' as const,
  marginBottom: 8,
};

const ROW: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '2px 0',
  lineHeight: 1.6,
};

const LBL: React.CSSProperties = { color: '#8899aa', flexShrink: 0 };
const VAL: React.CSSProperties = { color: '#dde4ef', fontWeight: 500, textAlign: 'right' };

const btnStyle: React.CSSProperties = {
  width: 22,
  height: 22,
  borderRadius: 4,
  border: '1px solid rgba(255,255,255,0.15)',
  background: 'rgba(255,255,255,0.06)',
  color: '#c8d6e5',
  cursor: 'pointer',
  fontSize: 13,
  lineHeight: '20px',
  textAlign: 'center',
  padding: 0,
  fontFamily: 'inherit',
  flexShrink: 0,
  userSelect: 'none',
};

// ---- Helpers ----
function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, justifyContent: 'flex-end' }}>
      <div style={{ width: 72, height: 7, borderRadius: 4, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', borderRadius: 4, background: color, transition: 'width 0.3s ease' }} />
      </div>
      <span style={{ ...VAL, minWidth: 24, fontSize: 10.5 }}>{value}</span>
    </div>
  );
}

function emotionalLabel(npc: NpcRuntimeState): string {
  if (npc.ending === 'success') return '修復完成 ✨';
  if (npc.ending === 'failed') return '對話崩潰 💀';
  if (npc.stress >= 90) return '崩潰邊緣';
  if (npc.stress >= 70) return '痛苦';
  if (npc.stress >= 50) return '緊繃';
  if (npc.stress >= 30) return '警覺';
  return '平靜';
}

function opennessLabel(npc: NpcRuntimeState): string {
  if (npc.innerWorldUnlocked) return '已敞開 🔓';
  if (npc.trust >= 50) return '試探性開放';
  if (npc.trust >= 30) return '防備';
  return '封閉';
}

function flagName(flag: string): string {
  const map: Record<string, string> = {
    safety_redirect_triggered: '🛡 危機攔截',
    player_used_hostile_language: '💢 敵意語言',
    player_used_dismissive_reply: '🥱 敷衍回應',
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

function logTypeIcon(type: string): string {
  const map: Record<string, string> = {
    dialogue: '💬',
    clue: '📦',
    inner_world: '🔮',
    state_change: '📊',
    force_unlock: '⚡',
    demo: '🎬',
  };
  return map[type] ?? '●';
}

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h`;
}

// ---- Branch Analysis ----
type Branch = {
  label: string;
  trigger: string;
  available: boolean;
  requirement: string;
};

function computeBranches(clues: ClueId[]): { unlocked: Branch[]; locked: Branch[] } {
  const all: Branch[] = [
    { label: '安全攔截', trigger: '危機詞', available: true, requirement: '永遠可用' },
    { label: '敵意/侮辱', trigger: '廢物/去死…', available: true, requirement: '永遠可用' },
    { label: '敷衍回應', trigger: '隨便/算了…', available: true, requirement: '永遠可用' },
    { label: '強制安慰', trigger: '加油/振作…', available: true, requirement: '永遠可用' },
    { label: '天才消費', trigger: '天才/大師…', available: true, requirement: '永遠可用' },
    { label: '陪伴接納', trigger: '陪伴/慢慢來…', available: true, requirement: '永遠可用' },
    { label: '感官接地', trigger: '雨聲/風…', available: true, requirement: '永遠可用' },
    { label: '畫筆反應', trigger: '畫筆', available: clues.includes('brush'), requirement: '需收集：畫筆' },
    { label: '真相對話', trigger: '車禍/報紙…', available: clues.includes('newspaper') || clues.includes('accident_report'), requirement: '需收集：報紙 or 車禍報導' },
    { label: '素描理解', trigger: '素描/春天…', available: clues.includes('sketchbook'), requirement: '需收集：素描本' },
  ];
  return {
    unlocked: all.filter((b) => b.available),
    locked: all.filter((b) => !b.available),
  };
}

// ---- Component ----
type Props = { currentScreen: string };

export default function NarrativePlaytestDashboard({ currentScreen }: Props) {
  const save = useGameStore((s) => s.save);
  const setNpcStat = useGameStore((s) => s.setNpcStat);
  const lastEval = useNarrativePlaytestStore((s) => s.lastEvaluation);
  const innerWorldEvents = useNarrativePlaytestStore((s) => s.innerWorldEvents);
  const eventLog = useNarrativePlaytestStore((s) => s.eventLog);
  const demoMode = useNarrativePlaytestStore((s) => s.demoMode);
  const toggle = useNarrativePlaytestStore((s) => s.toggle);

  const npc = save.npcs.bridge_artist;
  const allClueIds: ClueId[] = ['brush', 'newspaper', 'sketchbook', 'accident_report'];
  const branches = useMemo(() => computeBranches(save.collectedClues), [save.collectedClues]);
  const completedCount = innerWorldEvents.filter((e) => e.completed).length;

  // ---- Free Stat Control ----
  const [localTrust, setLocalTrust] = useState(npc.trust);
  const [localStress, setLocalStress] = useState(npc.stress);
  const [localKnowledge, setLocalKnowledge] = useState(npc.knowledge);
  const [autoSave, setAutoSave] = useState(true);

  // 外部數值變化時同步本地狀態
  useEffect(() => { setLocalTrust(npc.trust); }, [npc.trust]);
  useEffect(() => { setLocalStress(npc.stress); }, [npc.stress]);
  useEffect(() => { setLocalKnowledge(npc.knowledge); }, [npc.knowledge]);

  const applyStat = useCallback((stat: 'trust' | 'stress' | 'knowledge', value: number) => {
    setNpcStat('bridge_artist', stat, value);
  }, [setNpcStat]);

  const adjustStat = useCallback((stat: 'trust' | 'stress' | 'knowledge', delta: number) => {
    const current = stat === 'trust' ? localTrust : stat === 'stress' ? localStress : localKnowledge;
    const next = Math.max(0, Math.min(100, Math.round(current + delta)));
    if (stat === 'trust') setLocalTrust(next);
    if (stat === 'stress') setLocalStress(next);
    if (stat === 'knowledge') setLocalKnowledge(next);
    if (autoSave) applyStat(stat, next);
  }, [localTrust, localStress, localKnowledge, autoSave, applyStat]);

  const handleManualApply = useCallback(() => {
    applyStat('trust', localTrust);
    applyStat('stress', localStress);
    applyStat('knowledge', localKnowledge);
  }, [localTrust, localStress, localKnowledge, applyStat]);

  // ---- Chapter progress ----
  const chapterProgress = CHAPTERS.map((ch) => ({
    ...ch,
    unlocked: npc.trust >= ch.requiredTrust && npc.knowledge >= ch.requiredKnowledge,
  }));

  return (
    <div style={PANEL}>
      {/* ============================================================ */}
      {/* HEADER                                                       */}
      {/* ============================================================ */}
      <div style={HEADER_ROW}>
        <div>
          <span style={{ color: '#7ec8ff', fontWeight: 700, letterSpacing: 1, fontSize: 12 }}>
            PLAYTEST QA
          </span>
          {demoMode && (
            <span style={{
              marginLeft: 8,
              padding: '1px 6px',
              borderRadius: 3,
              background: 'rgba(255,152,0,0.2)',
              color: '#ff9800',
              fontSize: 9,
              fontWeight: 700,
            }}>
              DEMO
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ color: '#556', fontSize: 9.5 }}>F8</span>
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
          >✕</button>
        </div>
      </div>

      <div style={{ color: '#556', fontSize: 9.5, marginBottom: 10 }}>
        screen: {currentScreen} {demoMode ? '| 🎬 Demo Mode' : ''}
      </div>

      {/* ============================================================ */}
      {/* HOTKEYS                                                      */}
      {/* ============================================================ */}
      <div style={{ ...SECTION, padding: '6px 10px', marginBottom: 10 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', fontSize: 9.5, color: '#667' }}>
          <span><b style={{color:'#7ec8ff'}}>F7</b> 強制解鎖</span>
          <span><b style={{color:'#7ec8ff'}}>F8</b> 切換面板</span>
          <span><b style={{color:'#7ec8ff'}}>F9</b> 進入內心世界</span>
          <span><b style={{color:'#7ec8ff'}}>S+F9</b> 選章節</span>
          <span><b style={{color:'#ff9800'}}>F10</b> Demo模式</span>
        </div>
      </div>

      {/* ============================================================ */}
      {/* NPC Internal State                                           */}
      {/* ============================================================ */}
      <div style={SECTION}>
        <div style={SEC_TITLE}>1. NPC Internal State — {npc.name}</div>
        <div style={ROW}><span style={LBL}>Emotion</span><span style={{ ...VAL, color: emotionColor(npc) }}>{emotionalLabel(npc)}</span></div>
        <div style={ROW}><span style={LBL}>Trust</span><Bar value={npc.trust} max={100} color={npc.trust >= 50 ? '#4caf50' : npc.trust >= 30 ? '#ff9800' : '#f44336'} /></div>
        <div style={ROW}><span style={LBL}>Stress</span><Bar value={npc.stress} max={100} color={npc.stress <= 30 ? '#4caf50' : npc.stress <= 60 ? '#ff9800' : '#f44336'} /></div>
        <div style={ROW}><span style={LBL}>Openness</span><span style={VAL}>{opennessLabel(npc)}</span></div>
        <div style={ROW}><span style={LBL}>Ending</span><span style={{ ...VAL, color: npc.ending === 'success' ? '#4caf50' : npc.ending === 'failed' ? '#f44336' : '#889' }}>{npc.ending === 'none' ? 'ongoing' : npc.ending}</span></div>
        <div style={ROW}><span style={LBL}>Depth</span><span style={VAL}>{npc.innerWorldDepth} / 3</span></div>
        <div style={ROW}><span style={LBL}>Knowledge Req</span><span style={VAL}>{npc.knowledge}/{npc.knowledgeRequired}</span></div>
        {npc.flags.length > 0 && (
          <div style={{ marginTop: 6, borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 6 }}>
            <div style={{ ...LBL, marginBottom: 4 }}>Flags</div>
            {npc.flags.map((f, i) => (
              <div key={i} style={{ color: '#aab', fontSize: 10, padding: '1px 0' }}>  {flagName(f)}</div>
            ))}
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* Free Stat Control (Playtest)                                  */}
      {/* ============================================================ */}
      <div style={{ ...SECTION, borderColor: 'rgba(255,180,60,0.25)' }}>
        <div style={{ ...SEC_TITLE, color: '#ffb74d' }}>1.5 Free Stat Control</div>

        {/* ---- Trust ---- */}
        <div style={{ ...ROW, marginBottom: 4 }}>
          <span style={{ ...LBL, minWidth: 52 }}>Trust</span>
          <button onClick={() => adjustStat('trust', -5)} style={btnStyle}>−</button>
          <div style={{ flex: 1, margin: '0 6px' }}>
            <div style={{ width: '100%', height: 7, borderRadius: 4, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
              <div style={{ width: `${localTrust}%`, height: '100%', borderRadius: 4, background: localTrust >= 50 ? '#4caf50' : localTrust >= 30 ? '#ff9800' : '#f44336', transition: 'width 0.15s ease' }} />
            </div>
          </div>
          <span style={{ ...VAL, minWidth: 26, textAlign: 'center' }}>{localTrust}</span>
          <button onClick={() => adjustStat('trust', 5)} style={btnStyle}>+</button>
        </div>

        {/* ---- Stress ---- */}
        <div style={{ ...ROW, marginBottom: 4 }}>
          <span style={{ ...LBL, minWidth: 52 }}>Stress</span>
          <button onClick={() => adjustStat('stress', -5)} style={btnStyle}>−</button>
          <div style={{ flex: 1, margin: '0 6px' }}>
            <div style={{ width: '100%', height: 7, borderRadius: 4, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
              <div style={{ width: `${localStress}%`, height: '100%', borderRadius: 4, background: localStress <= 30 ? '#4caf50' : localStress <= 60 ? '#ff9800' : '#f44336', transition: 'width 0.15s ease' }} />
            </div>
          </div>
          <span style={{ ...VAL, minWidth: 26, textAlign: 'center' }}>{localStress}</span>
          <button onClick={() => adjustStat('stress', 5)} style={btnStyle}>+</button>
        </div>

        {/* ---- Knowledge ---- */}
        <div style={{ ...ROW, marginBottom: 6 }}>
          <span style={{ ...LBL, minWidth: 52 }}>Knowl.</span>
          <button onClick={() => adjustStat('knowledge', -5)} style={btnStyle}>−</button>
          <div style={{ flex: 1, margin: '0 6px' }}>
            <div style={{ width: '100%', height: 7, borderRadius: 4, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
              <div style={{ width: `${localKnowledge}%`, height: '100%', borderRadius: 4, background: '#2196f3', transition: 'width 0.15s ease' }} />
            </div>
          </div>
          <span style={{ ...VAL, minWidth: 26, textAlign: 'center' }}>{localKnowledge}</span>
          <button onClick={() => adjustStat('knowledge', 5)} style={btnStyle}>+</button>
        </div>

        {/* ---- Bottom row: auto-save checkbox + manual apply button ---- */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 4, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: 10, color: '#889' }}>
            <input
              type="checkbox"
              checked={autoSave}
              onChange={(e) => setAutoSave(e.target.checked)}
              style={{ cursor: 'pointer', accentColor: '#7ec8ff' }}
            />
            自動儲存
          </label>
          {!autoSave && (
            <button
              onClick={handleManualApply}
              style={{
                background: 'rgba(126,200,255,0.15)',
                border: '1px solid rgba(126,200,255,0.3)',
                color: '#7ec8ff',
                borderRadius: 4,
                cursor: 'pointer',
                padding: '3px 12px',
                fontSize: 10,
                fontFamily: 'inherit',
                fontWeight: 600,
              }}
            >
              套用
            </button>
          )}
        </div>
      </div>

      {/* ============================================================ */}
      {/* AI Interpretation + State Changes                            */}
      {/* ============================================================ */}
      <div style={{ ...SECTION, borderColor: 'rgba(100,180,255,0.15)' }}>
        <div style={SEC_TITLE}>2. AI Interpretation & State Changes</div>

        {!lastEval ? (
          <div style={{ color: '#556', fontSize: 10 }}>尚未發生對話評估。</div>
        ) : (
          <>
            {/* Triggers */}
            <div style={{ marginBottom: 8 }}>
              <div style={{ color: '#64b5f6', fontSize: 9.5, letterSpacing: 0.5, marginBottom: 3 }}>▸ 觸發標記</div>
              {lastEval.flags.length === 0 && <div style={{ color: '#556', fontSize: 10 }}>  (無)</div>}
              {lastEval.flags.map((f, i) => (
                <div key={i} style={{ fontSize: 10, color: '#adf', padding: '1px 0' }}>{flagName(f)}</div>
              ))}
            </div>

            {/* State Changes */}
            <div style={{ marginBottom: 8 }}>
              <div style={{ color: '#64b5f6', fontSize: 9.5, letterSpacing: 0.5, marginBottom: 3 }}>▸ 數值變化</div>
              <div style={ROW}>
                <span style={LBL}>信任</span>
                <span style={{ color: lastEval.trustDelta >= 0 ? '#4caf50' : '#f44336', fontWeight: 600 }}>
                  {lastEval.trustDelta >= 0 ? '+' : ''}{lastEval.trustDelta}
                </span>
              </div>
              <div style={ROW}>
                <span style={LBL}>壓力</span>
                <span style={{ color: lastEval.stressDelta <= 0 ? '#4caf50' : '#f44336', fontWeight: 600 }}>
                  {lastEval.stressDelta >= 0 ? '+' : ''}{lastEval.stressDelta}
                </span>
              </div>
              {lastEval.safetyRedirect && (
                <div style={{ color: '#ff9800', fontSize: 10, marginTop: 2 }}>⚠ 安全重導向</div>
              )}
            </div>

            {/* Reason */}
            <div>
              <div style={{ color: '#64b5f6', fontSize: 9.5, letterSpacing: 0.5, marginBottom: 3 }}>▸ AI 判定理由</div>
              <div style={{ fontSize: 10, color: '#cde', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                {lastEval.reason}
              </div>
              {lastEval.innerWorldUnlocked && (
                <div style={{ marginTop: 4, color: '#ab47bc', fontSize: 10, fontWeight: 600 }}>🔓 內心世界已解鎖</div>
              )}
              {lastEval.ending === 'failed' && (
                <div style={{ marginTop: 4, color: '#f44336', fontSize: 10, fontWeight: 600 }}>💀 NPC 已達失敗狀態</div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ============================================================ */}
      {/* Inner World Progress + Chapter Status                        */}
      {/* ============================================================ */}
      <div style={SECTION}>
        <div style={SEC_TITLE}>3. Inner World Progress</div>

        {/* Chapter status */}
        {chapterProgress.map((ch) => (
          <div key={ch.depth} style={{
            ...ROW,
            flexDirection: 'column',
            alignItems: 'flex-start',
            padding: '4px 0',
            marginBottom: 4,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
              <span style={{
                color: ch.unlocked ? '#adf' : '#445',
                fontWeight: ch.unlocked ? 600 : 400,
                fontSize: 10.5,
              }}>
                {ch.unlocked ? '●' : '○'} Ch.{ch.depth} {ch.title.split('·')[1]?.trim() ?? ch.title}
              </span>
              <span style={{ color: '#556', fontSize: 9 }}>
                {npc.innerWorldDepth >= ch.depth ? '✓ cleared' : ch.unlocked ? 'unlocked' : 'locked'}
              </span>
            </div>
            {!ch.unlocked && (
              <div style={{ color: '#544', fontSize: 9, marginTop: 1 }}>
                需求：信任≥{ch.requiredTrust}, 知識≥{ch.requiredKnowledge}
              </div>
            )}
          </div>
        ))}

        {/* Interactable events */}
        <div style={{ marginTop: 6, borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 6 }}>
          <div style={{ color: '#ab47bc', fontSize: 9.5, letterSpacing: 0.5, marginBottom: 3 }}>
            ▸ 探索事件 ({completedCount}/{innerWorldEvents.length} insight)
          </div>
          {innerWorldEvents.map((ev) => (
            <div key={ev.id} style={{
              fontSize: 10, padding: '1px 0', display: 'flex', justifyContent: 'space-between',
              color: ev.completed ? '#c9a' : ev.discovered ? '#887' : '#556',
            }}>
              <span>  {ev.completed ? '✦' : ev.discovered ? '○' : '·'} {ev.name}</span>
              <span style={{ fontSize: 9, color: ev.completed ? '#a6c' : '#556' }}>
                {ev.completed ? 'insight' : ev.discovered ? 'found' : 'hidden'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ============================================================ */}
      {/* Dialogue Branches                                            */}
      {/* ============================================================ */}
      <div style={SECTION}>
        <div style={SEC_TITLE}>4. Dialogue Branches</div>
        <div style={{ color: '#4caf50', fontSize: 9.5, letterSpacing: 0.5, marginBottom: 3 }}>
          ▸ 已解鎖 ({branches.unlocked.length})
        </div>
        {branches.unlocked.map((b, i) => (
          <div key={i} style={{ fontSize: 10, color: '#8a9', padding: '1px 0', display: 'flex', justifyContent: 'space-between' }}>
            <span>  {b.label}</span>
            <span style={{ color: '#556', fontSize: 9 }}>{b.trigger}</span>
          </div>
        ))}
        {branches.locked.length > 0 && (
          <>
            <div style={{ color: '#f44336', fontSize: 9.5, marginTop: 6, marginBottom: 3, letterSpacing: 0.5 }}>▸ 鎖定 ({branches.locked.length})</div>
            {branches.locked.map((b, i) => (
              <div key={i} style={{ fontSize: 10, color: '#877', padding: '1px 0' }}>
                <span>  {b.label}</span>
                <span style={{ color: '#544', fontSize: 9, marginLeft: 6 }}>— {b.requirement}</span>
              </div>
            ))}
          </>
        )}
      </div>

      {/* ============================================================ */}
      {/* Narrative Event Log                                          */}
      {/* ============================================================ */}
      <div style={{ ...SECTION, borderColor: 'rgba(171,71,188,0.15)' }}>
        <div style={SEC_TITLE}>5. Narrative Event Log ({eventLog.length})</div>
        {eventLog.length === 0 ? (
          <div style={{ color: '#556', fontSize: 10 }}>尚無事件紀錄。</div>
        ) : (
          <div style={{ maxHeight: 200, overflowY: 'auto' }}>
            {eventLog.map((entry, i) => (
              <div key={i} style={{
                padding: '3px 0',
                borderBottom: i < eventLog.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none',
                fontSize: 10,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 1 }}>
                  <span style={{ color: '#adf' }}>{logTypeIcon(entry.type)} {entry.message}</span>
                  <span style={{ color: '#556', fontSize: 9 }}>{timeAgo(entry.timestamp)}</span>
                </div>
                {entry.detail && (
                  <div style={{ color: '#667', fontSize: 9, paddingLeft: 12 }}>{entry.detail}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* Player Knowledge State                                       */}
      {/* ============================================================ */}
      <div style={SECTION}>
        <div style={SEC_TITLE}>6. Player Knowledge</div>
        <div style={ROW}><span style={LBL}>Knowledge</span><Bar value={npc.knowledge} max={100} color="#2196f3" /></div>
        <div style={ROW}><span style={LBL}>Location</span><span style={VAL}>{save.currentLocation}</span></div>
        <div style={{ marginTop: 6 }}>
          <div style={{ color: '#4caf50', fontSize: 9.5, marginBottom: 3, letterSpacing: 0.5 }}>▸ 已收集 ({save.collectedClues.length})</div>
          {save.collectedClues.length === 0 && <div style={{ color: '#556', fontSize: 10 }}>  (無)</div>}
          {save.collectedClues.map((cid) => {
            const clue = bridgeArtistClues[cid];
            return (
              <div key={cid} style={{ fontSize: 10, color: '#8c9', padding: '1px 0', display: 'flex', justifyContent: 'space-between' }}>
                <span>  {clue?.icon ?? '📦'} {clue?.shortLabel ?? cid}</span>
                <span style={{ color: '#556' }}>+{clue?.knowledge ?? 0}k</span>
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: 4 }}>
          <div style={{ color: '#ff9800', fontSize: 9.5, marginBottom: 3, letterSpacing: 0.5 }}>▸ 未收集</div>
          {allClueIds.filter((c) => !save.collectedClues.includes(c)).map((cid) => {
            const clue = bridgeArtistClues[cid];
            return (
              <div key={cid} style={{ fontSize: 10, color: '#876', padding: '1px 0' }}>
                <span>  {clue?.icon ?? '?'} {clue?.shortLabel ?? cid}</span>
                <span style={{ color: '#443', fontSize: 9, marginLeft: 6 }}>— {clue?.locationId}</span>
              </div>
            );
          })}
          {allClueIds.every((c) => save.collectedClues.includes(c)) && (
            <div style={{ color: '#4caf50', fontSize: 10 }}>  ✓ 全部收集！</div>
          )}
        </div>
      </div>

      {/* ---- Footer ---- */}
      <div style={{ color: '#334', fontSize: 9, textAlign: 'center', marginTop: 6 }}>
        Playtest Dashboard · F8 toggle · {demoMode ? 'Demo Mode ON' : ''}
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
