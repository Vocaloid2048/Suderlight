import { FormEvent, useMemo, useState, useEffect, useRef } from 'react';
import { GlimmerButton, GlassPanel, GuiFrame } from '../components';
import MeterBar from '../components/MeterBar';
import { getNpcDefinition } from '../data/npcs/registry';
import { evaluateRepairTip } from '../data/npcs/types';
import { bridgeArtistClues } from '../data/clues/bridgeArtistClues';
import type { NpcId } from '../data/verticalSlice';
import type { NpcRuntimeState } from '../systems/npcStateEngine';
import { simulateNpcReply } from '../systems/dialogueSimulator';
import { fetchLLMReply, type BackendNpcState } from '../utils/llmReply';
import { getPlayerAuthHeaders, getPlayerId } from '../lib/playerId';
import { loadDialogueHistory, appendDialogueExchange, clearDialogueHistory, saveInitialExchange, appendProgressOpening } from '../lib/dialogueStore';

// 线索 ID → 中文描述映射（支持所有已知 NPC 線索）
const CLUE_LABELS: Record<string, string> = {};
for (const c of Object.values(bridgeArtistClues)) {
  CLUE_LABELS[c.id] = c.shortLabel;
}

type ChatMessage = {
  role: 'player' | 'npc' | 'system';
  content: string;
};

type SystemJudgement = {
  stateLabel: string;
  trustDelta: number;
  stressDelta: number;
  knowledgeDelta?: number;
  trust?: number;
  stress?: number;
  knowledge?: number;
};

type HistoryEntry = {
  role: 'user' | 'assistant';
  content: string;
  systemJudgement?: SystemJudgement;
};

type BackendPsychology = {
  trustDelta: number;
  stressDelta: number;
  knowledgeDelta?: number;
  stateLabel: string;
  inputType?: string;
};

type AiReply = {
  dialogue: string;
  emotionDelta?: { trust: number; pressure: number };
  suggestedFlags?: string[];
  dictionaryHint?: string;
  safetyLevel?: 'safe' | 'safety_redirect';
  backendPsychology?: BackendPsychology;
  backendNpcState?: BackendNpcState;
  backendRoundCount?: number;
  backendSummary?: string;
  backendSummaryError?: string;
};

function formatSystemJudgement(systemJudgement: SystemJudgement) {
  const parts = [
    `對TA的認識 ${(systemJudgement.knowledgeDelta || 0) >= 0 ? '+' : ''}${systemJudgement.knowledgeDelta || '0'}`,
    `恐懼值 ${(systemJudgement.stressDelta || 0) >= 0 ? '+' : ''}${systemJudgement.stressDelta || '0'}`,
    `信任度 ${(systemJudgement.trustDelta || 0) >= 0 ? '+' : ''}${systemJudgement.trustDelta || '0'}`,
  ];
  return `系統判定：${systemJudgement.stateLabel || '未知'}（${parts.join(' / ')}）`;
}

type OuterWorldConversationProps = {
  inventory: string[];
  /** 心理世界探索深度：0=未進入, 1=理解不足, 2=理解中等, 3=理解很深 */
  innerWorldDepth?: number;
  npcState: NpcRuntimeState;
  onClose: () => void;
  onBackendNpcStateApplied: (state: BackendNpcState) => void;
  onEnterInnerWorld: () => void;
  onEndingTriggered: () => void;
  /** NPC ID，預設從 npcState.id 讀取 */
  npcId?: NpcId;
};

export default function OuterWorldConversation({
  inventory,
  innerWorldDepth = 0,
  npcState,
  onClose,
  onBackendNpcStateApplied,
  onEnterInnerWorld,
  onEndingTriggered,
  npcId: npcIdProp,
}: OuterWorldConversationProps) {
  const npcId: NpcId = npcIdProp ?? npcState.id;
  const npcDef = getNpcDefinition(npcId);
  const npcCard = npcDef.characterCard;

  // 線索標籤映射（從對應 NPC 的線索讀取，目前只有 bridge_artist）
  const clueLabels = useMemo(() => {
    const map: Record<string, string> = { ...CLUE_LABELS };
    return map;
  }, []);

  // 計算開場白（與 depth 對應）
  const layers = npcState.innerWorld?.layers;
  const allLayersComplete = !!(layers && [1, 2, 3, 4].every(l => layers[l]?.completed));
  const effectiveDepth = allLayersComplete ? 4 : innerWorldDepth;

  const { initialSystemMessage, initialNpcMessage } = useMemo(() => {
    if (allLayersComplete) {
      const entry = npcDef.openingsByDepth.find(o => o.depth === 'arc_complete');
      if (entry) return { initialSystemMessage: entry.systemMessage, initialNpcMessage: entry.npcMessage };
    }
    const entry = npcDef.openingsByDepth.find(o => o.depth === innerWorldDepth);
    if (entry) return { initialSystemMessage: entry.systemMessage, initialNpcMessage: entry.npcMessage };
    // fallback
    const fallback = npcDef.openingsByDepth.find(o => o.depth === 0);
    return {
      initialSystemMessage: fallback?.systemMessage ?? '',
      initialNpcMessage: npcCard.firstMessage,
    };
  }, [allLayersComplete, innerWorldDepth, npcDef, npcCard]);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isInitializing, setIsInitializing] = useState(true);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [conversationEndedLocally, setConversationEndedLocally] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ block: 'end' });
  }, [messages]);

  useEffect(() => {
    async function loadHistory() {
      try {
        const playerId = getPlayerId();
        const localHistory = loadDialogueHistory(npcId, playerId);
        if (localHistory && localHistory.fullHistory.length > 0) {
          const rebuiltHistory: ChatMessage[] = [];
          localHistory.fullHistory.forEach((msg: any) => {
            if (msg.role === 'system') { rebuiltHistory.push({ role: 'system', content: msg.content }); return; }
            if (msg.role === 'assistant') { rebuiltHistory.push({ role: 'npc', content: msg.content }); if (msg.systemJudgement) { rebuiltHistory.push({ role: 'system', content: formatSystemJudgement(msg.systemJudgement) }); } return; }
            if (msg.role === 'user') { rebuiltHistory.push({ role: 'player', content: msg.content }); return; }
          });
          const appended = appendProgressOpening(npcId, playerId, initialSystemMessage, initialNpcMessage, effectiveDepth);
          if (appended) {
            rebuiltHistory.push({ role: 'system', content: initialSystemMessage });
            rebuiltHistory.push({ role: 'npc', content: initialNpcMessage });
          }
          setMessages(rebuiltHistory);
          setIsInitializing(false);
          return;
        }

        const authHeaders = await getPlayerAuthHeaders(playerId);
        const response = await fetch(`/api/chat/history/${npcId}`, { headers: authHeaders });
        if (!response.ok) throw new Error('Failed to load history');
        const data = await response.json();

        if (Array.isArray(data.history) && data.history.length > 0) {
          const rebuiltHistory: ChatMessage[] = [];
          data.history.forEach((msg: HistoryEntry) => {
            if (msg.role === 'user') { rebuiltHistory.push({ role: 'player', content: msg.content }); return; }
            if (msg.role === 'assistant') { rebuiltHistory.push({ role: 'npc', content: msg.content }); if (msg.systemJudgement) { rebuiltHistory.push({ role: 'system', content: formatSystemJudgement(msg.systemJudgement) }); } }
          });
          setMessages(rebuiltHistory);
          setIsInitializing(false);
          return;
        }

        const initMessages: ChatMessage[] = [
          { role: 'system', content: initialSystemMessage },
          { role: 'npc', content: initialNpcMessage },
        ];
        setMessages(initMessages);
        saveInitialExchange(npcId, playerId, initialSystemMessage, initialNpcMessage, effectiveDepth);
      } catch (error) {
        console.error('Failed to load chat history:', error);
        setMessages([{ role: 'system', content: initialSystemMessage }, { role: 'npc', content: initialNpcMessage }]);
      } finally {
        setIsInitializing(false);
      }
    }
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const triggeredLore = useMemo(() => {
    const flags = new Set(inventory.map(item => `inventory.${item}`));
    return npcDef.lorebook.filter(entry => {
      const hasRequiredFlags = entry.requiredFlags.every(flag => flags.has(flag));
      const hitsKeyword = entry.keywords.some(keyword => input.includes(keyword));
      return hasRequiredFlags && hitsKeyword;
    });
  }, [input, inventory, npcDef.lorebook]);

  const appendReplyAndSystemResult = (reply: AiReply, _trimmed: string) => {
    const systemMessages: ChatMessage[] = [];
    let localFailed = false;

    if (reply.backendNpcState) {
      let appliedState = reply.backendNpcState;
      if (reply.backendNpcState.stress >= 100 && reply.backendNpcState.ending !== 'failed') {
        appliedState = { ...reply.backendNpcState, ending: 'failed' as const };
        localFailed = true;
      }
      onBackendNpcStateApplied(appliedState);

      if (reply.backendPsychology) {
        systemMessages.push({
          role: 'system',
          content: formatSystemJudgement({ stateLabel: reply.backendPsychology.stateLabel, trustDelta: reply.backendPsychology.trustDelta, stressDelta: reply.backendPsychology.stressDelta, knowledgeDelta: reply.backendPsychology.knowledgeDelta, knowledge: appliedState.knowledge, trust: appliedState.trust, stress: appliedState.stress }),
        });
      }

      if (localFailed) {
        systemMessages.push({
          role: 'system',
          content: '畫家最後看了你一眼。\n他收起畫布，在雨夜中離開天橋。\n\n畫家徹底放棄與現實的連結，\n將名字留在被水沖淡的報紙裡。\n城市的一部分繼續黯淡無光。\n\n（畫家已離開，請點擊「離開對話」回到天橋）',
        });
      }
    } else {
      systemMessages.push({ role: 'system', content: '系統提示：後端未返回 npcState，本輪不套用本地狀態計算。' });
    }

    const nextMessages: ChatMessage[] = [
      { role: 'npc', content: reply.dialogue },
      ...(reply.dictionaryHint ? [{ role: 'system' as const, content: `情緒詞典浮現：${reply.dictionaryHint}` }] : []),
      ...systemMessages,
    ];

    setMessages(current => [...current, ...nextMessages]);
    if (localFailed) setConversationEndedLocally(true);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isThinking || isEnded) return;

    const playerMessage: ChatMessage = { role: 'player', content: trimmed };
    const nextMessages = [...messages, playerMessage];
    setMessages(nextMessages);
    setInput('');
    setIsThinking(true);

    try {
      const replyStr = await fetchLLMReply(trimmed, npcId, inventory.length, {
        trust: npcState.trust,
        stress: npcState.stress,
        knowledge: npcState.knowledge,
        innerWorldDepth: npcState.innerWorldDepth,
      });
      let reply: AiReply;
      try {
        const cleanedStr = replyStr.replace(/```json/gi, '').replace(/```/g, '').trim();
        reply = JSON.parse(cleanedStr) as AiReply;
        if (reply.dialogue === undefined) { reply.dialogue = replyStr; }
        else if (reply.dialogue.trim() === '') { reply.dialogue = '（他沈默著，沒有說話。）'; }
      } catch (error) {
        console.error('解析 LLM JSON 失敗:', error, replyStr);
        reply = { dialogue: replyStr, safetyLevel: 'safe' };
      }

      appendReplyAndSystemResult(reply, trimmed);

      const playerId = getPlayerId();
      appendDialogueExchange(npcId, playerId, trimmed, reply.dialogue,
        reply.backendPsychology ? { stateLabel: reply.backendPsychology.stateLabel, trustDelta: reply.backendPsychology.trustDelta, stressDelta: reply.backendPsychology.stressDelta, knowledgeDelta: reply.backendPsychology.knowledgeDelta, knowledge: reply.backendNpcState?.knowledge, trust: reply.backendNpcState?.trust, stress: reply.backendNpcState?.stress } : undefined,
        reply.backendSummary, reply.backendRoundCount,
      );
    } catch (error) {
      console.warn('LLM 連線失敗，切換至本地語意模擬:', error instanceof Error ? error.message : String(error));
      const simulatedReply = simulateNpcReply(npcId, trimmed, inventory, nextMessages, innerWorldDepth);
      appendReplyAndSystemResult({ dialogue: simulatedReply.dialogue, dictionaryHint: simulatedReply.dictionaryHint, safetyLevel: simulatedReply.safetyLevel }, trimmed);
    } finally {
      setIsThinking(false);
    }
  };

  const isEnded = npcState.ending !== 'none' || conversationEndedLocally;

  // 計算修復指引
  const repairTip = evaluateRepairTip(npcDef, {
    trust: npcState.trust,
    stress: npcState.stress,
    knowledge: npcState.knowledge,
    innerWorldUnlocked: npcState.innerWorldUnlocked,
    innerWorldDepth,
  });

  return (
    <GuiFrame tone="inner">
      <div style={{ position: 'relative', zIndex: 2, height: '100%', display: 'grid', gridTemplateColumns: 'minmax(420px, 760px) 260px', justifyContent: 'center', gap: 16, padding: 24 }}>
        <GlassPanel title={npcCard.displayName} variant="dark" style={{ alignSelf: 'center', maxHeight: '88vh', minHeight: 560, display: 'flex', flexDirection: 'column' }} contentStyle={{ padding: 0, display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
          <div style={{ padding: '6px 20px 14px', color: '#9ba2ad', fontSize: 13, lineHeight: 1.6, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            {npcCard.coreEmotion}
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: 20, backgroundImage: 'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px)', backgroundSize: '100% 42px' }}>
            {isInitializing ? (
              <div style={{ color: '#888', fontSize: 13, textAlign: 'center', marginTop: 20 }}>正在同步記憶...</div>
            ) : (
              <>
                {isEnded && (
                  <div style={{ marginBottom: 16, padding: 12, borderRadius: 10, color: npcState.ending === 'success' ? '#b8ffd6' : '#ffd0d0', border: `1px solid ${npcState.ending === 'success' ? 'rgba(120,255,180,0.28)' : 'rgba(255,120,120,0.28)'}`, background: npcState.ending === 'success' ? 'rgba(80,180,120,0.08)' : 'rgba(180,60,60,0.1)', fontSize: 13 }}>
                    {npcState.ending === 'success' ? npcDef.ending.success : npcDef.ending.failed}
                  </div>
                )}
                {messages.map((message, index) => (
                  <div key={`${message.role}-${index}`} style={{ marginBottom: 14, display: 'flex', justifyContent: message.role === 'player' ? 'flex-end' : 'flex-start' }}>
                    <div style={{ maxWidth: message.role === 'system' ? '100%' : '78%', padding: message.role === 'system' ? '8px 12px' : '12px 14px', borderRadius: message.role === 'player' ? '14px 14px 4px 14px' : '14px 14px 14px 4px', background: message.role === 'player' ? 'rgba(86, 116, 148, 0.42)' : message.role === 'system' ? 'rgba(245, 193, 108, 0.08)' : 'rgba(255,255,255,0.07)', border: message.role === 'system' ? '1px solid rgba(245,193,108,0.16)' : '1px solid rgba(255,255,255,0.08)', color: message.role === 'system' ? '#d7b77a' : '#eee', lineHeight: 1.75, whiteSpace: 'pre-line', fontSize: message.role === 'system' ? 13 : 15 }}>
                      {message.content}
                    </div>
                  </div>
                ))}
                {isThinking && <div style={{ color: '#888', fontSize: 13 }}>畫家沉默了一下，像是在等待雨聲替他組織句子……</div>}
                <div ref={chatEndRef} />
              </>
            )}
          </div>

          <form onSubmit={handleSubmit} style={{ padding: 16, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ display: 'flex', gap: 10 }}>
              <input
                value={input}
                onChange={event => setInput(event.target.value)}
                disabled={isEnded}
                placeholder={isEnded ? '畫家已經離開了天橋...' : '試著輸入：你的畫筆還在嗎 / 創作對你來說是什麼 / 我可以陪你坐一會 / 不畫畫也沒關係'}
                style={{ flex: 1, background: isEnded ? '#0a0c12' : '#101218', color: isEnded ? '#555' : '#f5f0e8', border: '1px solid #444', borderRadius: 10, padding: '12px 14px', outline: 'none', fontSize: 14 }}
              />
              <GlimmerButton type="submit" tone="primary" disabled={isThinking || isEnded}>送出</GlimmerButton>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, color: '#777', fontSize: 12 }}>
              <span>目前線索：{inventory.length > 0 ? inventory.map(id => clueLabels[id] || id).join(' / ') : '沒有線索'}</span>
              {triggeredLore.length > 0 && <span style={{ color: '#f5c16c' }}>記憶被線索牽動</span>}
            </div>
          </form>
        </GlassPanel>

        <div style={{ alignSelf: 'center', display: 'grid', gap: 10 }}>
          {npcState.innerWorldUnlocked && npcState.ending === 'none' && (
            <GlimmerButton tone="primary" onClick={onEnterInnerWorld}>進入心理世界</GlimmerButton>
          )}
          <GlimmerButton onClick={onClose}>離開對話</GlimmerButton>

          <GlassPanel title="修復指引" variant="dark" contentStyle={{ display: 'grid', gap: 12 }}>
            <MeterBar label="對TA的認識" value={npcState.knowledge} max={100} tone="blue" />
            <MeterBar label="恐懼值" value={npcState.stress} max={100} tone="red" />
            <MeterBar label="信任度" value={npcState.trust} max={100} tone="gold" />
            <div style={{ color: '#9ba2ad', fontSize: 12, lineHeight: 1.6, padding: '8px 0', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              {repairTip}
            </div>
          </GlassPanel>
        </div>
      </div>
    </GuiFrame>
  );
}
