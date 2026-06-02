const fs = require('fs');
const path = require('path');

const characterCardsDir = path.join(__dirname, '..', 'data', 'characterCards');
const worldbookPath = path.join(__dirname, '..', 'data', 'worldbook.json');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function getCardData(card) {
  return card.data || card;
}

function formatWorldbook(worldbook) {
  const entries = Array.isArray(worldbook.entries) ? worldbook.entries : [];
  return entries
    .filter(entry => entry.enabled !== false && entry.disable !== true)
    .sort((a, b) => (b.priority || 0) - (a.priority || 0))
    .map(entry => `【${entry.comment || entry.id}】\n${entry.content}`)
    .join('\n\n');
}

function loadCharacterCard(npcId) {
  const characterPath = path.join(characterCardsDir, `${npcId}.json`);
  return readJson(characterPath);
}

function loadWorldbook() {
  return readJson(worldbookPath);
}

function buildPrompt(npcId, playerMessage, recentInputTypes = []) {
  const card = loadCharacterCard(npcId);
  const npc = getCardData(card);
  const worldbook = loadWorldbook();


  const name = npc.name || card.name || npcId;
  const description = npc.description || card.description || '';
  const personality = npc.personality || card.personality || '';
  const scenario = npc.scenario || card.scenario || '';
  const firstMessage = npc.first_mes || card.first_mes || '';
  const examples = npc.mes_example || card.mes_example || '';
  const systemPrompt = npc.system_prompt || '';
  const creatorNotes = npc.creator_notes || card.creatorcomment || '';
  const worldbookText = formatWorldbook(worldbook);

  return [
    {
      role: 'system',
      content: `
你正在《情緒修復師：微光城市》中扮演 NPC。

【世界書】
${worldbookText}

【角色名稱】
${name}

【角色描述】
${description}

【角色個性與心理狀態】
${personality}

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
- 請完全以角色身份回覆。
- 不要變成心理醫生。
- 不要分析自己。
- 不要一次說太多。
- 保持沉浸感。
- 不要判定通關。
- 不要計算 Trust、Stress、Knowledge。
- 不要宣告心理世界是否解鎖。
- 只輸出 NPC 對玩家說的話，不要輸出 JSON、Markdown 或解釋。
`
    },
    {
      role: 'user',
      content: playerMessage
    }
  ];
}

module.exports = {
  buildPrompt,
  loadCharacterCard,
  loadWorldbook
};
