import { FormEvent, useMemo, useState, useEffect } from 'react';
import { blankPainterCard, blankPainterLorebook } from '../data/npcs/blankPainter';
import type { NpcRuntimeState } from '../systems/npcStateEngine';
import { fetchLLMReply, type BackendNpcState } from '../utils/llmReply';
import { getPlayerId } from '../lib/playerId';
import { loadDialogueHistory, appendDialogueExchange } from '../lib/dialogueStore';

type ChatMessage = {
  role: 'player' | 'npc' | 'system';
  content: string;
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
};

type BlankPainterChatProps = {
  inventory: string[];
  knowledge: number;
  npcState: NpcRuntimeState;
  onClose: () => void;
  onEnterInnerWorld: () => void;
  onEndingTriggered: (ending: 'failed') => void;
};

function hasAny(input: string, words: string[]) {
  return words.some(word => input.includes(word));
}

function simulateBlankPainterReply(playerInput: string, inventory: string[], history: ChatMessage[]): AiReply {
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
    return {
      dialogue: '雨聲……\n很久沒聽過了。\n我一直以為它也變成灰色了。',
      dictionaryHint: '把注意力帶回當下感官，有時比勸說更能降低防衛。',
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



export default function BlankPainterChat({
  inventory,
  knowledge,
  npcState,
  onClose,
  onEnterInnerWorld,
  onEndingTriggered,
}: BlankPainterChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'system', content: '雨水沿著天橋欄杆滴落。提燈的光很低，只照見空白畫布的一角。' },
    { role: 'npc', content: blankPainterCard.firstMessage },
  ]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);

  // 从本地 localStorage 加载历史对话
  useEffect(() => {
    const playerId = getPlayerId();
    const local = loadDialogueHistory('bridge_artist', playerId);
    if (local && local.fullHistory.length > 0) {
      const rebuilt: ChatMessage[] = [
        { role: 'system', content: '雨水沿著天橋欄杆滴落。提燈的光很低，只照見空白畫布的一角。' },
        { role: 'npc', content: blankPainterCard.firstMessage },
      ];
      local.fullHistory.forEach((msg: any) => {
        if (msg.role === 'user') {
          rebuilt.push({ role: 'player', content: msg.content });
        } else if (msg.role === 'assistant') {
          rebuilt.push({ role: 'npc', content: msg.content });
          if (msg.systemJudgement) {
            rebuilt.push({
              role: 'system',
              content: `系統判定：${msg.systemJudgement.stateLabel}（Trust ${msg.systemJudgement.trustDelta >= 0 ? '+' : ''}${msg.systemJudgement.trustDelta} / Stress ${msg.systemJudgement.stressDelta >= 0 ? '+' : ''}${msg.systemJudgement.stressDelta}）`,
            });
          }
        }
      });
      setMessages(rebuilt);
    }
  }, []);


  const triggeredLore = useMemo(() => {
    const flags = new Set(inventory.map(item => `inventory.${item}`));
    return blankPainterLorebook.filter(entry => {
      const hasRequiredFlags = entry.requiredFlags.every(flag => flags.has(flag));
      const hitsKeyword = entry.keywords.some(keyword => input.includes(keyword));
      return hasRequiredFlags && hitsKeyword;
    });
  }, [input, inventory]);

  const appendReplyAndSystemResult = (reply: AiReply) => {
    const nextMessages: ChatMessage[] = [
      { role: 'npc', content: reply.dialogue },
      ...(reply.dictionaryHint ? [{ role: 'system' as const, content: `情緒詞典浮現：${reply.dictionaryHint}` }] : []),
      ...(reply.backendPsychology
        ? [{
            role: 'system' as const,
            content: `系統判定：${reply.backendPsychology.stateLabel}（Trust ${reply.backendPsychology.trustDelta >= 0 ? '+' : ''}${reply.backendPsychology.trustDelta} / Stress ${reply.backendPsychology.stressDelta >= 0 ? '+' : ''}${reply.backendPsychology.stressDelta}）`,
          }]
        : []),
    ];

    setMessages(current => [...current, ...nextMessages]);

    if (reply.backendNpcState?.ending === 'failed') {
      window.setTimeout(() => onEndingTriggered('failed'), 300);
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

      appendReplyAndSystemResult(reply);

      // 存储对话到本地 localStorage
      appendDialogueExchange(
        'bridge_artist',
        getPlayerId(),
        trimmed,
        reply.dialogue,
        reply.backendPsychology ? {
          stateLabel: reply.backendPsychology.stateLabel,
          trustDelta: reply.backendPsychology.trustDelta,
          stressDelta: reply.backendPsychology.stressDelta,
        } : undefined,
      );
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.warn('LLM 連線失敗，切換至本地語意模擬:', errMsg);
      const simulatedReply = simulateBlankPainterReply(trimmed, inventory, nextMessages);
      setMessages(current => [
        ...current,
        { role: 'system', content: `（連線錯誤：${errMsg}）` },
      ]);
      appendReplyAndSystemResult(simulatedReply);
    } finally {
      setIsThinking(false);
    }
  };

  const isEnded = npcState.ending !== 'none';

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 300,
      display: 'grid', gridTemplateColumns: 'minmax(420px, 760px)',
      justifyContent: 'center', gap: 16,
      padding: 24, boxSizing: 'border-box',
      background: 'radial-gradient(circle at 50% 30%, rgba(42, 45, 52, 0.92), rgba(4, 5, 8, 0.97) 72%)',
      color: '#f5f0e8',
    }}>
      <section style={{
        alignSelf: 'center', maxHeight: '88vh', minHeight: 560,
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        background: 'rgba(10, 11, 14, 0.88)', border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 16, boxShadow: '0 24px 90px rgba(0,0,0,0.6)',
      }}>
        <header style={{
          padding: '18px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)',
          display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start',
        }}>
          <div>
            <div style={{ color: '#f5c16c', fontSize: 13, letterSpacing: 2 }}>Vertical Slice · 天橋畫家</div>
            <h2 style={{ margin: '6px 0 0', fontSize: 22 }}>{blankPainterCard.displayName}</h2>
            <p style={{ margin: '8px 0 0', color: '#aaa', fontSize: 13 }}>{blankPainterCard.coreEmotion}</p>
            <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 12 }}>
              <span style={{ color: '#d7b77a' }}>Knowledge {knowledge}/100</span>
              <span style={{ color: '#9bd6ff' }}>Trust {npcState.trust}/100</span>
              <span style={{ color: '#ffaaa0' }}>Stress {npcState.stress}/100</span>
              <span style={{ color: npcState.innerWorldUnlocked ? '#9cffc7' : '#888' }}>
                InnerWorld {npcState.innerWorldUnlocked ? 'Unlocked' : 'Locked'}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {npcState.innerWorldUnlocked && npcState.ending === 'none' && (
              <button onClick={onEnterInnerWorld} style={{
                background: '#7a5130', color: '#fff', border: '1px solid #d6a35e',
                padding: '8px 12px', borderRadius: 8, cursor: 'pointer',
              }}>進入心理世界</button>
            )}
            <button onClick={onClose} style={{
              background: '#24262c', color: '#ddd', border: '1px solid #555',
              padding: '8px 12px', borderRadius: 8, cursor: 'pointer',
            }}>離開對話</button>
          </div>
        </header>

        <div style={{
          flex: 1, overflowY: 'auto', padding: 20,
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px)',
          backgroundSize: '100% 42px',
        }}>
          {isEnded && (
            <div style={{
              marginBottom: 16, padding: 12, borderRadius: 10,
              color: npcState.ending === 'success' ? '#b8ffd6' : '#ffd0d0',
              border: `1px solid ${npcState.ending === 'success' ? 'rgba(120,255,180,0.28)' : 'rgba(255,120,120,0.28)'}`,
              background: npcState.ending === 'success' ? 'rgba(80,180,120,0.08)' : 'rgba(180,60,60,0.1)',
              fontSize: 13,
            }}>
              {npcState.ending === 'success' ? '修復完成：他沒有痊癒，但願意暫時放下畫筆，聽見雨聲。' : '失敗結局：他關上了最後的空白，Ghost System 已留下殘影。'}
            </div>
          )}

          {messages.map((message, index) => (
            <div key={index} style={{
              marginBottom: 14,
              display: 'flex',
              justifyContent: message.role === 'player' ? 'flex-end' : 'flex-start',
            }}>
              <div style={{
                maxWidth: message.role === 'system' ? '100%' : '78%',
                padding: message.role === 'system' ? '8px 12px' : '12px 14px',
                borderRadius: message.role === 'player' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                background: message.role === 'player'
                  ? 'rgba(86, 116, 148, 0.42)'
                  : message.role === 'system'
                    ? 'rgba(245, 193, 108, 0.08)'
                    : 'rgba(255,255,255,0.07)',
                border: message.role === 'system' ? '1px solid rgba(245,193,108,0.16)' : '1px solid rgba(255,255,255,0.08)',
                color: message.role === 'system' ? '#d7b77a' : '#eee',
                lineHeight: 1.75,
                whiteSpace: 'pre-line',
                fontSize: message.role === 'system' ? 13 : 15,
              }}>
                {message.content}
              </div>
            </div>
          ))}
          {isThinking && <div style={{ color: '#888', fontSize: 13 }}>畫家沉默了一下，像是在等待雨聲替他組織句子……</div>}
        </div>

        <form onSubmit={handleSubmit} style={{ padding: 16, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <input
              value={input}
              onChange={event => setInput(event.target.value)}
              placeholder={isEnded ? '這段對話已結束' : '試著輸入：我可以陪你坐一會 / 不畫畫也沒關係 / 你還能聽見雨聲'}
              disabled={isEnded}
              style={{
                flex: 1, background: '#101218', color: '#f5f0e8', border: '1px solid #444',
                borderRadius: 10, padding: '12px 14px', outline: 'none', fontSize: 14,
                opacity: isEnded ? 0.55 : 1,
              }}
            />
            <button type="submit" disabled={isThinking || isEnded} style={{
              background: isThinking || isEnded ? '#333' : '#8a5b2d', color: 'white', border: '1px solid #b8864c',
              borderRadius: 10, padding: '0 18px', cursor: isThinking || isEnded ? 'not-allowed' : 'pointer',
            }}>送出</button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, color: '#777', fontSize: 12 }}>
            <span>目前線索：{inventory.length > 0 ? inventory.join(' / ') : '沒有線索'}</span>
          </div>
          {triggeredLore.length > 0 && (
            <div style={{ marginTop: 8, color: '#f5c16c', fontSize: 12 }}>
              畫家的記憶被某個線索輕輕牽動了。
            </div>
          )}
        </form>
      </section>


    </div>
  );
}
