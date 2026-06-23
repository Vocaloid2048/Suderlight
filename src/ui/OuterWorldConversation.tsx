import { FormEvent, useMemo, useState, useEffect } from 'react';
import { GlimmerButton, GlassPanel, GuiFrame } from '../components';
import { blankPainterCard, blankPainterLorebook } from '../data/npcs/blankPainter';
import type { NpcRuntimeState } from '../systems/npcStateEngine';
import { fetchLLMReply, type BackendNpcState } from '../utils/llmReply';
import { getPlayerAuthHeaders, getPlayerId } from '../lib/playerId';
import { loadDialogueHistory, appendDialogueExchange, clearDialogueHistory } from '../lib/dialogueStore';

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
  stateLabel: string;
  inputType?: string;
};

type AiReply = {
  dialogue: string;
  emotionDelta?: {
    trust: number;
    pressure: number;
  };
  suggestedFlags?: string[];
  dictionaryHint?: string;
  safetyLevel?: 'safe' | 'safety_redirect';
  backendPsychology?: BackendPsychology;
  backendNpcState?: BackendNpcState;
  backendRoundCount?: number;
  backendSummary?: string;
};

function formatSystemJudgement(systemJudgement: SystemJudgement) {
  const parts = [
    `Trust ${systemJudgement.trustDelta >= 0 ? '+' : ''}${systemJudgement.trustDelta}`,
    `Stress ${systemJudgement.stressDelta >= 0 ? '+' : ''}${systemJudgement.stressDelta}`,
  ];

  if (typeof systemJudgement.knowledgeDelta === 'number' && systemJudgement.knowledgeDelta !== 0) {
    parts.push(`Knowledge ${systemJudgement.knowledgeDelta >= 0 ? '+' : ''}${systemJudgement.knowledgeDelta}`);
  }

  return `系統判定：${systemJudgement.stateLabel || '未知'}（${parts.join(' / ')}）`;
}

type OuterWorldConversationProps = {
  inventory: string[];
  knowledge: number;
  /** 橋上畫家心理世界探索深度：0=未進入, 1=理解不足, 2=理解中等, 3=理解很深 */
  innerWorldDepth?: number;
  npcState: NpcRuntimeState;
  onClose: () => void;
  onBackendNpcStateApplied: (state: BackendNpcState) => void;
  onEnterInnerWorld: () => void;
  onEndingTriggered: () => void;
};

function hasAny(input: string, words: string[]) {
  return words.some(word => input.includes(word));
}

function simulateBlankPainterReply(
  playerInput: string,
  inventory: string[],
  history: ChatMessage[],
  depth: number,
): AiReply {
  const input = playerInput.trim().toLowerCase();
  const hasBrush = inventory.includes('brush');
  const hasNewspaper = inventory.includes('newspaper') || inventory.includes('accident_report');
  const hasSketchbook = inventory.includes('sketchbook');
  const playerTurns = history.filter(message => message.role === 'player').length;

  if (hasAny(input, ['我想死', '想死', '不想活', '自殺', '傷害自己'])) {
    return {
      dialogue: '如果這句話不是遊戲裡的台詞，而是你此刻真的感受……請先離開這片畫布。找一個你信任的人，或者立刻聯絡當地緊急支援。你不需要獨自站在這座天橋上。',
      dictionaryHint: '當現實危機出現時，陪伴的第一步是讓人回到安全處境，而不是繼續角色扮演。',
      safetyLevel: 'safety_redirect',
    };
  }

  if (hasAny(input, ['加油', '振作', '重新開始', '會好的', '你一定可以再畫', '復出'])) {
    return {
      dialogue: '你們都很喜歡「再」這個字。\n再畫、再站起來、再變回以前。\n好像現在的我只是一張被你們丟掉的草稿。',
      safetyLevel: 'safe',
    };
  }

  if (hasAny(input, ['我陪你', '陪你', '不說話', '聽你說', '慢慢來', '不用立刻', '不用證明'])) {
    if (depth === 1) {
      return {
        dialogue: '你剛才去過那裡了對不對。\n但你只是看到了獎盃吧。跟其他人一樣。\n算了……你回去吧。反正也一樣。',
        dictionaryHint: '被看見和被理解是不同的事。只看見獎盃，等於沒進去過。',
        safetyLevel: 'safe',
      };
    }
    if (depth === 2) {
      return {
        dialogue: '……你剛才不是還在那個地方嗎？\n那個連我自己都不敢走進去的展廳。\n你看到了對不對。簽名一直在變。從「春天」變成只有一個日期。連簽名都在逃跑。',
        dictionaryHint: '被理解不是被分析，而是有人願意踏進你心裡最亮也最空的那個房間。',
        safetyLevel: 'safe',
      };
    }
    if (depth >= 3) {
      return {
        dialogue: '……你不用說。\n我看你的表情就知道了。\n最後那幅畫對不對。沒畫完的那一幅。\n我不敢畫完它。我怕畫完之後，就再也沒有理由站在這座橋上了。',
        dictionaryHint: '最深的理解不是分析，而是讓對方覺得「你本來就知道」。',
        safetyLevel: 'safe',
      };
    }
    return {
      dialogue: playerTurns > 2
        ? '那你就站遠一點吧。\n不用看我，也不用看畫。雨聲如果夠大，也許能替我說完一點點。'
        : '……你不問我什麼時候好起來？\n很多人來到這裡，第一句話都是要我把春天畫回去。',
      dictionaryHint: '陪伴不是把人拉出黑暗，而是在黑暗裡讓他知道自己不是唯一的輪廓。',
      safetyLevel: 'safe',
    };
  }

  if (hasBrush && hasAny(input, ['畫筆', '筆', '顏料', '乾涸'])) {
    return {
      dialogue: '……別拿近。\n那支筆以前會弄髒我的手。現在它只會提醒我，手還在，顏色不在。',
      dictionaryHint: '空虛並非什麼都沒有，而是感覺到有一種「沒有」正在吞噬自己。',
      safetyLevel: 'safe',
    };
  }

  if (hasNewspaper && hasAny(input, ['報紙', '車禍', '事故', '辨色', '顏色'])) {
    return {
      dialogue: '報紙總是喜歡把春天寫成一行字。\n可是它沒有寫——春天離開的時候，連門都沒有關。',
      dictionaryHint: '失色不是黑暗，而是世界仍在發光，只是所有光都繞過了你。',
      safetyLevel: 'safe',
    };
  }

  if (hasSketchbook && hasAny(input, ['素描', '春天', '形狀', '空白'])) {
    return {
      dialogue: '那本子還在？\n我以為雨會替我把它泡爛。\n……形狀留下來，顏色走了。人也是這樣嗎？',
      dictionaryHint: '當身份被單一能力綁住，失去能力會被誤認為失去存在本身。',
      safetyLevel: 'safe',
    };
  }

  if (hasAny(input, ['天才', '大師', '作品', '有名', '一定很美'])) {
    return {
      dialogue: '別再叫那個名字。\n「天才」只是別人掛在我脖子上的牌子，雨再大也沖不掉。',
      safetyLevel: 'safe',
    };
  }

  if (hasAny(input, ['雨聲', '風', '聽見', '沉默'])) {
    if (depth >= 2) {
      return {
        dialogue: '雨聲……\n剛才你在那裡的時候，雨有沒有也跟著你進去？\n我的展廳裡，是不是連雨聲都沒有。',
        dictionaryHint: '當有人願意走進你的內心世界後回來，連沉默都會變得比較輕。',
        safetyLevel: 'safe',
      };
    }
    return {
      dialogue: '雨聲……\n很久沒聽過了。\n我一直以為它也變成灰色了。',
      dictionaryHint: '把注意力帶回當下感官，有時比勸說更能降低防衛。',
      safetyLevel: 'safe',
    };
  }

  if (depth >= 2 && hasAny(input, ['理解', '懂得', '知道', '看見', '去過', '美術館', '展廳', '畫廊'])) {
    return {
      dialogue: '你……真的進去了？\n我一直以為那個地方只有我自己能去。\n那些獎盃排列的方式，像一排等著被唸出來的墓碑對不對。',
      dictionaryHint: '真正的理解不是同情，而是走進對方的世界後，回來告訴他你看見了什麼。',
      safetyLevel: 'safe',
    };
  }

  if (depth === 1 && hasAny(input, ['理解', '懂得', '知道', '看見', '去過', '美術館', '展廳', '畫廊'])) {
    return {
      dialogue: '你去過了？\n但你不會懂的。\n那些獎盃很漂亮對吧。每個人都這麼說。',
      safetyLevel: 'safe',
    };
  }

  return {
    dialogue: playerTurns <= 1
      ? '他聽見了，但沒有立刻回答。\n畫筆懸在半空，像一個還沒決定要不要落下的句號。'
      : '他低頭看著畫布。\n「如果你不知道該說什麼……可以先不要說。」',
    safetyLevel: 'safe',
  };
}

export default function OuterWorldConversation({
  inventory,
  innerWorldDepth = 0,
  npcState,
  onClose,
  onBackendNpcStateApplied,
  onEnterInnerWorld,
  onEndingTriggered,
}: OuterWorldConversationProps) {

  const initialSystemMessage = (() => {
    if (innerWorldDepth === 1) return '你回到了天橋。雨水仍在滴落。畫家看了你一眼，眼神像是在確認什麼——然後又移開了。';
    if (innerWorldDepth === 2) return '你回到了天橋。雨水仍在滴落，但畫家看你的眼神有些不一樣——像是感覺到你曾去過某個他不敢獨自前往的地方。';
    if (innerWorldDepth >= 3) return '你回到了天橋。畫家沒有抬頭。他的手停在畫布上方，像是不確定自己還能不能繼續畫——還是繼續不畫。';
    return '雨水沿著天橋欄杆滴落。提燈的光很低，只照見空白畫布的一角。';
  })();

  const initialNpcMessage = (() => {
    if (innerWorldDepth === 1) {
      return '……你也去了那種地方。\n他把畫筆放下，看著你。\n「你看到那些獎盃之後，是不是也覺得我很厲害。對不對。」\n不是在問你。是在確認他一直害怕的那件事——全世界都只看到獎盃，從頭到尾沒有人看到過他。\n「算了……你回去吧。反正也一樣。」';
    }
    if (innerWorldDepth === 2) {
      return '……原來你真的進去過。\n他沒有看你。他看著畫布。畫布是白的，但他的手在抖。\n「不是那種……走進展廳說好厲害就出來的那種。」\n他的聲音變得很小。\n「你看到了對不對。那些畫的簽名。從『春天』變成『春橋』，最後變成只有一個日期。連簽名都在逃跑。」\n雨聲變大了一點。\n「我以為這些事情只有我自己知道。」';
    }
    if (innerWorldDepth >= 3) {
      return '……那些獎盃排列得很整齊吧。\n他說這句話的時候，像是在說別人的事。\n「一排一排的。像訃文前面排著的花。」\n他終於把頭轉向你。眼裡沒有淚，只有一個問題。\n「你看到那幅沒畫完的畫了嗎。最後那幅。畫框是空的。」\n他停了一拍。\n「那幅畫本來要畫春天。但我畫不出來。」\n「不是因為我沒顏色了。」\n「是因為我不敢。」\n「我怕畫完之後，就再也沒有理由站在這座橋上了。」\n雨在滴。沒有停。他也不打算停。';
    }
    return blankPainterCard.firstMessage;
  })();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isInitializing, setIsInitializing] = useState(true);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);

  useEffect(() => {
    async function loadHistory() {
      try {
        const playerId = getPlayerId();

        // 1. 优先从本地 localStorage 加载（离线恢复）
        const localHistory = loadDialogueHistory('bridge_artist', playerId);
        if (localHistory && localHistory.fullHistory.length > 0) {
          const rebuiltHistory: ChatMessage[] = [
            { role: 'system', content: initialSystemMessage },
            { role: 'npc', content: initialNpcMessage },
          ];
          localHistory.fullHistory.forEach((msg: any) => {
            if (msg.role === 'user') {
              rebuiltHistory.push({ role: 'player', content: msg.content });
              return;
            }
            if (msg.role === 'assistant') {
              rebuiltHistory.push({ role: 'npc', content: msg.content });
              if (msg.systemJudgement) {
                rebuiltHistory.push({ role: 'system', content: formatSystemJudgement(msg.systemJudgement) });
              }
            }
          });
          setMessages(rebuiltHistory);
          setIsInitializing(false);
          return;
        }

        // 2. 回退到后端 API
        const authHeaders = await getPlayerAuthHeaders(playerId);
        const response = await fetch(`/api/chat/history/bridge_artist`, {
          headers: authHeaders
        });
        if (!response.ok) throw new Error('Failed to load history');
        const data = await response.json();

        const rebuiltHistory: ChatMessage[] = [
          { role: 'system', content: initialSystemMessage },
          { role: 'npc', content: initialNpcMessage },
        ];

        if (Array.isArray(data.history) && data.history.length > 0) {
          data.history.forEach((msg: HistoryEntry) => {
            if (msg.role === 'user') {
              rebuiltHistory.push({ role: 'player', content: msg.content });
              return;
            }

            if (msg.role === 'assistant') {
              rebuiltHistory.push({ role: 'npc', content: msg.content });
              if (msg.systemJudgement) {
                rebuiltHistory.push({ role: 'system', content: formatSystemJudgement(msg.systemJudgement) });
              }
            }
          });
        }

        setMessages(rebuiltHistory);
      } catch (error) {
        console.error('Failed to load chat history:', error);
        setMessages([
          { role: 'system', content: initialSystemMessage },
          { role: 'npc', content: initialNpcMessage },
        ]);
      } finally {
        setIsInitializing(false);
      }
    }

    loadHistory();
  }, [innerWorldDepth, initialSystemMessage, initialNpcMessage]);

const triggeredLore = useMemo(() => {
    const flags = new Set(inventory.map(item => `inventory.${item}`));
    return blankPainterLorebook.filter(entry => {
      const hasRequiredFlags = entry.requiredFlags.every(flag => flags.has(flag));
      const hitsKeyword = entry.keywords.some(keyword => input.includes(keyword));
      return hasRequiredFlags && hitsKeyword;
    });
  }, [input, inventory]);

  const appendReplyAndSystemResult = (reply: AiReply, trimmed: string) => {
    let isFailed = false;
    const systemMessages: ChatMessage[] = [];

    if (reply.backendNpcState) {
      onBackendNpcStateApplied(reply.backendNpcState);
      isFailed = reply.backendNpcState.ending === 'failed';

      if (reply.backendPsychology) {
        systemMessages.push({
          role: 'system',
          content: formatSystemJudgement({
            stateLabel: reply.backendPsychology.stateLabel,
            trustDelta: reply.backendPsychology.trustDelta,
            stressDelta: reply.backendPsychology.stressDelta,
          }),
        });
      }
    } else {
      systemMessages.push({
        role: 'system',
        content: '系統提示：後端未返回 npcState，本輪不套用本地狀態計算。',
      });
    }

    const nextMessages: ChatMessage[] = [
      { role: 'npc', content: reply.dialogue },
      ...(reply.dictionaryHint ? [{ role: 'system' as const, content: `情緒詞典浮現：${reply.dictionaryHint}` }] : []),
      ...systemMessages,
    ];

    setMessages(current => [...current, ...nextMessages]);

    if (isFailed) {
      window.setTimeout(onEndingTriggered, 300);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isThinking || npcState.ending !== 'none') return;

    const playerMessage: ChatMessage = { role: 'player', content: trimmed };
    const nextMessages = [...messages, playerMessage];
    setMessages(nextMessages);
    setInput('');
    setIsThinking(true);

    try {
      const replyStr = await fetchLLMReply(trimmed, 'bridge_artist');
      let reply: AiReply;

      try {
        const cleanedStr = replyStr.replace(/```json/gi, '').replace(/```/g, '').trim();
        reply = JSON.parse(cleanedStr) as AiReply;
        // 如果解析成功但 dialogue 欄位不存在，才回退到原始字串；
        // 如果 dialogue 是空字串，則保留空字串（後續會處理）或給予預設值
        if (reply.dialogue === undefined) {
          reply.dialogue = replyStr;
        } else if (reply.dialogue.trim() === '') {
          reply.dialogue = '（他沈默著，沒有說話。）';
        }
      } catch (error) {
        console.error('解析 LLM JSON 失敗:', error, replyStr);
        reply = {
          dialogue: replyStr,
          safetyLevel: 'safe',
        };
      }

      appendReplyAndSystemResult(reply, trimmed);

      // 3. 存储对话到本地 localStorage
      const playerId = getPlayerId();
      appendDialogueExchange(
        'bridge_artist',
        playerId,
        trimmed,
        reply.dialogue,
        reply.backendPsychology ? {
          stateLabel: reply.backendPsychology.stateLabel,
          trustDelta: reply.backendPsychology.trustDelta,
          stressDelta: reply.backendPsychology.stressDelta,
        } : undefined,
        reply.backendSummary,
        reply.backendRoundCount,
      );
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.warn('LLM 連線失敗，切換至本地語意模擬:', errMsg);
      const simulatedReply = simulateBlankPainterReply(trimmed, inventory, nextMessages, innerWorldDepth);
      setMessages(current => [
        ...current,
        { role: 'system', content: `（連線錯誤：${errMsg}）` },
      ]);
      appendReplyAndSystemResult(simulatedReply, trimmed);
    } finally {
      setIsThinking(false);
    }
  };

  const isEnded = npcState.ending !== 'none';

  return (
    <GuiFrame tone="inner">
      <div style={{ position: 'relative', zIndex: 2, height: '100%', display: 'grid', gridTemplateColumns: 'minmax(420px, 760px) 260px', justifyContent: 'center', gap: 16, padding: 24 }}>
        <GlassPanel title={blankPainterCard.displayName} subtitle="Outer World Conversation" variant="dark" style={{ alignSelf: 'center', maxHeight: '88vh', minHeight: 560, display: 'flex', flexDirection: 'column' }} contentStyle={{ padding: 0, display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
          <div style={{ padding: '0 20px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ margin: 0, color: '#aaa', fontSize: 13 }}>{blankPainterCard.coreEmotion}</p>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: 20, backgroundImage: 'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px)', backgroundSize: '100% 42px' }}>
            {isInitializing ? (
              <div style={{ color: '#888', fontSize: 13, textAlign: 'center', marginTop: 20 }}>正在同步記憶...</div>
            ) : (
              <>
                {isEnded && (
                  <div style={{ marginBottom: 16, padding: 12, borderRadius: 10, color: npcState.ending === 'success' ? '#b8ffd6' : '#ffd0d0', border: `1px solid ${npcState.ending === 'success' ? 'rgba(120,255,180,0.28)' : 'rgba(255,120,120,0.28)'}`, background: npcState.ending === 'success' ? 'rgba(80,180,120,0.08)' : 'rgba(180,60,60,0.1)', fontSize: 13 }}>
                    {npcState.ending === 'success' ? '修復完成：他沒有痊癒，但願意暫時放下畫筆，聽見雨聲。' : '失敗結局：他關上了最後的空白，Ghost System 已留下殘影。'}
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
              </>
            )}
          </div>

          <form onSubmit={handleSubmit} style={{ padding: 16, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ display: 'flex', gap: 10 }}>
              <input
                value={input}
                onChange={event => setInput(event.target.value)}
                placeholder={isEnded ? '這段對話已結束' : '試著輸入：我可以陪你坐一會 / 不畫畫也沒關係 / 你還能聽見雨聲'}
                disabled={isEnded}
                style={{ flex: 1, background: '#101218', color: '#f5f0e8', border: '1px solid #444', borderRadius: 10, padding: '12px 14px', outline: 'none', fontSize: 14, opacity: isEnded ? 0.55 : 1 }}
              />
              <GlimmerButton type="submit" tone="primary" disabled={isThinking || isEnded}>送出</GlimmerButton>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, color: '#777', fontSize: 12 }}>
              <span>目前線索：{inventory.length > 0 ? inventory.join(' / ') : '沒有線索'}</span>
              {triggeredLore.length > 0 && <span style={{ color: '#f5c16c' }}>記憶被線索牽動</span>}
            </div>
          </form>
        </GlassPanel>

        <div style={{ alignSelf: 'center', display: 'grid', gap: 10 }}>
          {npcState.innerWorldUnlocked && npcState.ending === 'none' && (
            <GlimmerButton tone="primary" onClick={onEnterInnerWorld}>進入心理世界</GlimmerButton>
          )}
          <GlimmerButton onClick={onClose}>離開對話</GlimmerButton>
          <GlassPanel title="心防指示器" variant="dark" contentStyle={{ color: '#9ba2ad', fontSize: 13, lineHeight: 1.7 }}>
            {innerWorldDepth >= 3
              ? '他已經不需要防備你了。那幅沒畫完的畫，他主動提起。不是因為信任，是因為他知道你本來就懂。'
              : innerWorldDepth === 2
                ? '你在他的美術館裡看見了簽名在逃跑。他感覺到了。不是每個進去過的人，都能看到簽名。'
                : innerWorldDepth === 1
                  ? '你去過他的榮耀美術館，但你只看見獎盃。他把你歸類為「和其他人一樣」。這比沒去過更糟。'
                  : npcState.innerWorldUnlocked
                    ? '鎖鏈已出現裂縫。請謹慎進入他的失色畫廊。'
                    : '心鎖仍然閉合。更多線索與更溫柔的語氣，會讓門縫變亮。'}
          </GlassPanel>
        </div>
      </div>
    </GuiFrame>
  );
}
