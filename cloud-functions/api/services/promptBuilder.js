/**
 * Prompt Builder —— 构建 NPC 对话 system prompt (Cloud Functions 版本)
 * 使用内联 CHARACTER_CARDS 数据模块
 */
import CHARACTER_CARDS from '../data/character-cards.js';
import worldbookService from './worldbookService.js';
import memoryService from './memoryService.js';

function formatWorldbookEntries(entries) {
  return entries.map(e => `【${e.comment || e.id}】\n${e.content}`).join('\n\n');
}

function buildPrompt(npcId, playerMessage, recentInputTypes = [], playerId = null) {
  const card = CHARACTER_CARDS[npcId] || {};

  // 世界书
  const triggered = worldbookService.getTriggeredEntries(npcId, playerMessage, playerId);
  const worldbookText = formatWorldbookEntries(triggered);

  // 长期摘要
  const summary = playerId ? memoryService.getSummary(npcId, playerId) : '';

  // 近期历史
  const history = playerId ? memoryService.getRecentDialogue(npcId, 20, playerId) : [];

  const name = card.name || npcId;
  const desc = card.description || '';
  const personality = card.personality || '';
  const scenario = card.scenario || '';
  const firstMsg = card.first_mes || '';
  const examples = card.mes_example || '';
  const sysPrompt = card.system_prompt || '';
  const notes = card.creator_notes || '';

  const systemContent = `你正在《情緒修復師：微光城市》中扮演 NPC。

【當前場景感知】
${worldbookText || '無特殊感知'}

【角色名稱】${name}
【角色描述】${desc}
【個性與心理狀態】${personality}
【長期記憶與進度摘要】
${summary || '這是你們的初次交談。'}

【場景】${scenario}
【第一句台詞參考】${firstMsg}
【對話範例】${examples}
【角色系統規則】
${sysPrompt}
【創作者補充】${notes}

【最近玩家輸入類型】${recentInputTypes.length > 0 ? recentInputTypes.join(' → ') : '首次對話'}

【演出要求 — 非常重要】
- 請以 NPC 身份回覆，融入自然的肢體動作與場景細節（例如：「他停頓了一下，手指在斷裂的欄杆上輕輕敲了兩下」）
- 對話要有文學感與沉浸感，不要只回一句就結束
- 不要變成心理醫生，不要分析自己或玩家
- 不要一次說太多，但要有足夠的情感厚度
- 參考前情提要中的記憶摘要，保持情感連貫
- 不要判定通關，不要宣告心理世界是否解鎖
- 只輸出 NPC 的台詞與動作描寫
- 使用繁體中文回覆，不要繁簡混雜，不要突然自己開始使用簡體中文
- 如果用戶以其他語言回覆，則使用對應語言回覆`;

  return [
    { role: 'system', content: systemContent.trim() },
    ...history,
    { role: 'user', content: playerMessage },
  ];
}

export { buildPrompt, formatWorldbookEntries };
