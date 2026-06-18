const fs = require('fs');
const path = require('path');
const worldbookService = require('./worldbookService');
const memoryService = require('./memoryService');

const characterCardsDir = path.join(__dirname, '..', 'data', 'characterCards');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function getCardData(card) {
  return card.data || card;
}

function formatWorldbookEntries(entries) {
  return entries
    .map(entry => `【${entry.comment || entry.id}】\n${entry.content}`)
    .join('\n\n');
}

function loadCharacterCard(npcId) {
  const characterPath = path.join(characterCardsDir, `${npcId}.json`);
  return readJson(characterPath);
}

function buildPrompt(npcId, playerMessage, recentInputTypes = [], playerId = null) {
  const card = loadCharacterCard(npcId);
  const npc = getCardData(card);
  
  // 1. 世界書選擇性檢索與過濾（按球员隔离）
  const triggeredEntries = worldbookService.getTriggeredEntries(npcId, playerMessage, playerId);
  const worldbookText = formatWorldbookEntries(triggeredEntries);

  // 2. 獲取長期情感與修復摘要（按球员隔离）
  const longTermSummary = playerId ? memoryService.getSummary(npcId, playerId) : '';

  // 3. 獲取最近 20 條對話歷史 (即 10 輪)（按球员隔离）
  const recentHistory = playerId ? memoryService.getRecentDialogue(npcId, 20, playerId) : [];

  const name = npc.name || card.name || npcId;
  const description = npc.description || card.description || '';
  const personality = npc.personality || card.personality || '';
  const scenario = npc.scenario || card.scenario || '';
  const firstMessage = npc.first_mes || card.first_mes || '';
  const examples = npc.mes_example || card.mes_example || '';
  const systemPrompt = npc.system_prompt || '';
  const creatorNotes = npc.creator_notes || card.creatorcomment || '';

  const systemMessageContent = `
你正在《情緒修復師：微光城市》中扮演 NPC。

【世界書（當前感知與解鎖進度）】
${worldbookText || '無特殊場景感知'}

【角色名稱】
${name}

【角色描述】
${description}

【角色個性與心理狀態】
${personality}

【前情提要：長期記憶與情感進度摘要】
（請基於此摘要中的心結、聯繫與承諾進行回覆，保持情感連貫性）
${longTermSummary || '無先前記憶，這是你們的初次交談。'}

【場景】
${scenario}

【第一句台詞參考】
${firstMessage}

【對話範例】
${examples}

【角色系統規則】
${systemPrompt}

【創作者補充】
${creatorNotes}

【最近玩家輸入類型】
${recentInputTypes.length > 0 ? recentInputTypes.join(', ') : '無'}

【輸出規則】
- 請完全以角色身份回覆，並參考前情提要中的記憶摘要。
- 不要變成心理醫生。
- 不要分析自己。
- 不要一次說太多。
- 保持沉浸感。
- 不要判定通關。
- 不要計算 Trust、Stress、Knowledge。
- 不要宣告心理世界是否解鎖。
- 只輸出 NPC 對玩家說的話，不要輸出 JSON、Markdown 或解釋。
`;

  // 組裝完整的 messages 陣列
  // System Prompt -> 最近 10 輪歷史 (避免 token 燃燒) -> 當前 User
  return [
    {
      role: 'system',
      content: systemMessageContent.trim()
    },
    ...recentHistory,
    {
      role: 'user',
      content: playerMessage
    }
  ];
}

module.exports = {
  buildPrompt,
  loadCharacterCard,
  loadWorldbook: worldbookService.readWorldbook // 保持向後相容
};
