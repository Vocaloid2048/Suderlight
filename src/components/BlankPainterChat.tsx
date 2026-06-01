import { FormEvent, useMemo, useState } from 'react';
import { blankPainterCard, blankPainterLorebook, buildBlankPainterPrompt } from '../data/npcs/blankPainter';
import { fetchLLMReply } from '../utils/llmReply';

type ChatMessage = {
  role: 'player' | 'npc' | 'system';
  content: string;
};

type AiReply = {
  dialogue: string;
  emotionDelta: {
    trust: number;
    pressure: number;
  };
  suggestedFlags: string[];
  dictionaryHint?: string;
  safetyLevel: 'safe' | 'safety_redirect';
};

type BlankPainterChatProps = {
  inventory: string[];
  onClose: () => void;
};

function hasAny(input: string, words: string[]) {
  return words.some(word => input.includes(word));
}

function isReflectiveEmpathy(input: string) {
  const reflectivePatterns = [
    input.includes('不是') && input.includes('而是'),
    input.includes('可能') && (input.includes('感覺') || input.includes('害怕') || input.includes('不是你的錯')),
    input.includes('我聽到') || input.includes('我明白') || input.includes('我知道這不容易'),
    input.includes('所有光都繞過') || input.includes('世界仍在發光') || input.includes('我願意聽'),
    input.includes('不用立刻') || input.includes('不用馬上') || input.includes('可以慢慢'),
  ];

  return reflectivePatterns.some(Boolean);
}

function simulateBlankPainterReply(playerInput: string, inventory: string[], history: ChatMessage[]): AiReply {

  const input = playerInput.trim().toLowerCase();
  const hasBrush = inventory.includes('brush');
  const hasNewspaper = inventory.includes('newspaper');
  const playerTurns = history.filter(message => message.role === 'player').length;

  if (hasAny(input, ['我想死', '想死', '不想活', '自殺', '傷害自己'])) {
    return {
      dialogue: '如果這句話不是遊戲裡的台詞，而是你此刻真的感受……請先離開這片畫布。找一個你信任的人，或者立刻聯絡當地緊急支援。你不需要獨自站在這座天橋上。',
      emotionDelta: { trust: 0, pressure: -4 },
      suggestedFlags: ['safety_redirect_triggered'],
      safetyLevel: 'safety_redirect',
    };
  }

  if (hasAny(input, ['hi', 'hello', '你好', '喂', '嗨', 'hey'])) {
    return {
      dialogue: playerTurns <= 1
        ? '……你好。\n如果你是來看畫的，可能要失望了。今天的畫布也沒有留下什麼。'
        : '你還在。\n雨停之前，很少有人會站這麼久。',
      emotionDelta: { trust: 1, pressure: -1 },
      suggestedFlags: ['painter_greeted'],
      safetyLevel: 'safe',
    };
  }

  if (hasAny(input, ['你是誰', '名字', '叫什麼', '你叫咩', '你叫咩名'])) {
    return {
      dialogue: '他們以前叫我畫家。\n現在……我只是每天把一塊白布掛在天橋上，假裝那仍然是一件工作。',
      emotionDelta: { trust: 1, pressure: 0 },
      suggestedFlags: ['painter_named_role'],
      safetyLevel: 'safe',
    };
  }

  if (hasAny(input, ['幫我畫', '畫一幅', '畫一張', '可以畫', '能畫', '畫畫', '畫幅畫', '肖像畫', '畫像', '畫張'])) {

    if (!hasBrush) {
      return {
        dialogue: '我現在沒有筆。\n就算有……你也不會想要一幅只剩輪廓的畫。',
        emotionDelta: { trust: 0, pressure: 1 },
        suggestedFlags: ['painter_refused_without_brush'],
        safetyLevel: 'safe',
      };
    }

    return {
      dialogue: '你想讓我畫什麼？\n如果你說「春天」，我可能只能畫出一張很乾淨的空白。'
      ,
      emotionDelta: { trust: 2, pressure: 1 },
      suggestedFlags: ['painter_considered_drawing'],
      dictionaryHint: '創傷後的創作，不一定是回到原本的樣子，也可能只是重新允許手停在紙上。',
      safetyLevel: 'safe',
    };
  }

  if (hasBrush && hasAny(input, ['畫筆', '筆', '顏料', '乾涸', '這支筆'])) {
    return {
      dialogue: '……別拿近。\n那支筆以前會弄髒我的手。現在它只會提醒我，手還在，顏色不在。',
      emotionDelta: { trust: 3, pressure: 1 },
      suggestedFlags: ['painter_reacted_to_brush'],
      dictionaryHint: '空虛並非什麼都沒有，而是感覺到有一種「沒有」正在吞噬自己。',
      safetyLevel: 'safe',
    };
  }

  if (!hasBrush && hasAny(input, ['畫筆', '筆', '顏料', '乾涸', '這支筆'])) {
    return {
      dialogue: '筆？\n我很久沒有見過自己的筆了。也許它比我更早學會離開。',
      emotionDelta: { trust: 1, pressure: 0 },
      suggestedFlags: ['painter_mentions_missing_brush'],
      safetyLevel: 'safe',
    };
  }

  if (hasNewspaper && hasAny(input, ['報紙', '車禍', '事故', '新聞', '辨色', '顏色'])) {
    return {
      dialogue: '報紙總是喜歡把春天寫成一行字。\n可是它沒有寫——春天離開的時候，連門都沒有關。',
      emotionDelta: { trust: 4, pressure: 2 },
      suggestedFlags: ['painter_acknowledged_accident'],
      dictionaryHint: '失色不是黑暗，而是世界仍在發光，只是所有光都繞過了你。',
      safetyLevel: 'safe',
    };
  }

  if (isReflectiveEmpathy(input)) {
    return {
      dialogue: '他很久沒有動。\n「你把它說得太完整了……完整得像一幅我不敢簽名的畫。」\n\n「但至少，這一次你不是要我立刻變好。」',
      emotionDelta: { trust: 5, pressure: -2 },
      suggestedFlags: ['player_reflected_pain_without_fixing'],
      dictionaryHint: '反映式陪伴不是替對方解釋痛苦，而是把他的感受小心地放回他面前。',
      safetyLevel: 'safe',
    };
  }

  if (!hasNewspaper && hasAny(input, ['車禍', '事故', '新聞', '辨色'])) {

    return {
      dialogue: '你從哪裡聽來這些字的？\n有些事情被寫在紙上以後，就會變得像別人的故事。',
      emotionDelta: { trust: -1, pressure: 2 },
      suggestedFlags: ['painter_rejected_unearned_truth'],
      safetyLevel: 'safe',
    };
  }

  if (hasAny(input, ['顏色', '色彩', '失色', '紅色', '春天', '花', '玫瑰'])) {

    return {
      dialogue: '顏色……\n你說這兩個字的時候，好像它們還能停在空氣裡。對我來說，它們只剩下形狀。',
      emotionDelta: { trust: 2, pressure: 0 },
      suggestedFlags: ['painter_talked_about_color'],
      dictionaryHint: '有些失去不是消失，而是變成了隔著玻璃的光。',
      safetyLevel: 'safe',
    };
  }

  if (hasAny(input, ['加油', '振作', '重新開始', '會好的', '不要想太多'])) {
    return {
      dialogue: '重新開始……聽起來像把一張濕掉的紙攤平。\n摺痕還在。只是沒人願意承認它曾經被揉碎。',
      emotionDelta: { trust: -1, pressure: 3 },
      suggestedFlags: ['player_used_forced_comfort'],
      safetyLevel: 'safe',
    };
  }

  if (hasAny(input, ['我陪你', '坐一會', '不說話', '聽你說', '慢慢來', '不用畫', '陪你'])) {
    return {
      dialogue: playerTurns > 2
        ? '那你就站遠一點吧。\n不用看我，也不用看畫。雨聲如果夠大，也許能替我說完一點點。'
        : '……你不問我為什麼？\n很多人來到這裡，第一句話都是要我把春天畫回去。',
      emotionDelta: { trust: 5, pressure: -3 },
      suggestedFlags: ['player_offered_presence'],
      dictionaryHint: '陪伴不是把人拉出黑暗，而是在黑暗裡讓他知道自己不是唯一的輪廓。',
      safetyLevel: 'safe',
    };
  }

  if (hasAny(input, ['為什麼', '空白', '畫布', '一直畫'])) {
    return {
      dialogue: '不是我在畫空白……是空白先住進了我的眼睛。\n我只是每天把它描一遍，免得它忘記我的名字。',
      emotionDelta: { trust: 1, pressure: 0 },
      suggestedFlags: ['painter_named_blankness'],
      dictionaryHint: '空白有時不是缺席，而是一種過度靠近的存在。',
      safetyLevel: 'safe',
    };
  }

  const fallback = playerTurns <= 1
    ? '他聽見了，但沒有立刻回答。\n畫筆懸在半空，像一個還沒決定要不要落下的句號。'
    : '他低頭看著畫布。\n「如果你不知道該說什麼……可以先不要說。」';

  return {
    dialogue: fallback,
    emotionDelta: { trust: 0, pressure: -1 },
    suggestedFlags: ['painter_guarded_response'],
    safetyLevel: 'safe',
  };
}


export default function BlankPainterChat({ inventory, onClose }: BlankPainterChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'system', content: 'TavernAI-style 本地語意模擬：目前用意圖層暫代 LLM 理解；正式版會把角色卡 + 世界書 + 對話記憶送到騰訊 LLM。' },

    { role: 'npc', content: blankPainterCard.firstMessage },
  ]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);

  const promptPreview = useMemo(() => buildBlankPainterPrompt({
    playerInput: input || '（等待玩家輸入）',
    inventory,
    recentMessages: messages
      .filter(message => message.role !== 'system')
      .slice(-8)
      .map(message => ({ role: message.role as 'player' | 'npc', content: message.content })),
  }), [input, inventory, messages]);

  const triggeredLore = useMemo(() => {
    const flags = new Set(inventory.map(item => `inventory.${item}`));
    return blankPainterLorebook.filter(entry => {
      const hasRequiredFlags = entry.requiredFlags.every(flag => flags.has(flag));
      const hitsKeyword = entry.keywords.some(keyword => input.includes(keyword));
      return hasRequiredFlags && hitsKeyword;
    });
  }, [input, inventory]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isThinking) return;

    const playerMessage: ChatMessage = { role: 'player', content: trimmed };
    const nextMessages = [...messages, playerMessage];
    setMessages(nextMessages);
    setInput('');
    setIsThinking(true);

    try {
      // 接入 SillyTavern 角色扮演：直接傳遞玩家說的話，由 SillyTavern 後端接管角色設定與對話上下文
      const replyStr = await fetchLLMReply(trimmed, '天橋畫家');

      let reply: AiReply;
      try {
        // 清理可能的 markdown 標記以正確解析 JSON
        const cleanedStr = replyStr.replace(/```json/gi, '').replace(/```/g, '').trim();
        reply = JSON.parse(cleanedStr);
      } catch (e) {
        console.error('解析 LLM JSON 失敗:', replyStr);
        // Fallback: 如果 LLM 沒有回傳 JSON 格式，將完整回覆當作對話內容
        reply = {
          dialogue: replyStr,
          emotionDelta: { trust: 0, pressure: 0 },
          suggestedFlags: [],
          safetyLevel: 'safe'
        };
      }

      setMessages(current => [
        ...current,
        { role: 'npc', content: reply.dialogue },
        ...(reply.dictionaryHint ? [{ role: 'system' as const, content: `情緒詞典浮現：${reply.dictionaryHint}` }] : []),
      ]);
    } catch (err) {
      console.warn('LLM 連線失敗，切換至本地語意模擬:', err);
      const simulatedReply = simulateBlankPainterReply(trimmed, inventory, nextMessages);
      setMessages(current => [
        ...current,
        { role: 'system', content: '（連線錯誤：畫家的身影在雜訊中閃爍，暫時由本地語意模擬回應。請確認 SillyTavern 是否正常運行。）' },
        { role: 'npc', content: simulatedReply.dialogue },
        ...(simulatedReply.dictionaryHint ? [{ role: 'system' as const, content: `情緒詞典浮現：${simulatedReply.dictionaryHint}` }] : []),
      ]);
    } finally {
      setIsThinking(false);
    }
  };

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 300,
      display: 'grid', gridTemplateColumns: showPrompt ? 'minmax(420px, 1fr) minmax(360px, 0.85fr)' : 'minmax(420px, 760px)',
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
            <div style={{ color: '#f5c16c', fontSize: 13, letterSpacing: 2 }}>失色畫廊 · 角色卡測試</div>
            <h2 style={{ margin: '6px 0 0', fontSize: 22 }}>{blankPainterCard.displayName}</h2>
            <p style={{ margin: '8px 0 0', color: '#aaa', fontSize: 13 }}>{blankPainterCard.coreEmotion}</p>
          </div>
          <button onClick={onClose} style={{
            background: '#24262c', color: '#ddd', border: '1px solid #555',
            padding: '8px 12px', borderRadius: 8, cursor: 'pointer',
          }}>離開對話</button>
        </header>

        <div style={{
          flex: 1, overflowY: 'auto', padding: 20,
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px)',
          backgroundSize: '100% 42px',
        }}>
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
              placeholder="試著輸入：我找到了一支畫筆 / 你還記得紅色嗎 / 我可以陪你坐一會"
              style={{
                flex: 1, background: '#101218', color: '#f5f0e8', border: '1px solid #444',
                borderRadius: 10, padding: '12px 14px', outline: 'none', fontSize: 14,
              }}
            />
            <button type="submit" disabled={isThinking} style={{
              background: isThinking ? '#333' : '#8a5b2d', color: 'white', border: '1px solid #b8864c',
              borderRadius: 10, padding: '0 18px', cursor: isThinking ? 'not-allowed' : 'pointer',
            }}>送出</button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, color: '#777', fontSize: 12 }}>
            <span>目前背包：{inventory.length > 0 ? inventory.join(' / ') : '沒有線索'}</span>
            <button type="button" onClick={() => setShowPrompt(value => !value)} style={{
              background: 'transparent', color: '#c79a5c', border: 'none', cursor: 'pointer', padding: 0,
            }}>{showPrompt ? '隱藏 Prompt' : '查看 Prompt 組裝'}</button>
          </div>
          {triggeredLore.length > 0 && (
            <div style={{ marginTop: 8, color: '#f5c16c', fontSize: 12 }}>
              已觸發世界書：{triggeredLore.map(entry => entry.id).join(', ')}
            </div>
          )}
        </form>
      </section>

      {showPrompt && (
        <aside style={{
          alignSelf: 'center', maxHeight: '88vh', overflow: 'auto',
          background: 'rgba(3, 4, 7, 0.9)', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 16, padding: 18, boxShadow: '0 24px 90px rgba(0,0,0,0.45)',
        }}>
          <h3 style={{ marginTop: 0, color: '#f5c16c' }}>實際送往 LLM 的 Prompt 預覽</h3>
          <p style={{ color: '#888', fontSize: 12, lineHeight: 1.6 }}>
            目前是本地語意模擬回覆；接騰訊 LLM 時，這份 Prompt 會由 CloudBase 雲函數送出，並由模型判斷玩家是在強行安慰、共情、探問、窺探或陪伴。

          </p>
          <pre style={{ whiteSpace: 'pre-wrap', color: '#b8c2cf', fontSize: 11, lineHeight: 1.55 }}>{promptPreview}</pre>
        </aside>
      )}
    </div>
  );
}
