const deepseekService = require('./deepseekService');

/**
 * 根據舊摘要與新的對話片斷，生成更新後的長期摘要記憶
 * @param {string} oldSummary 舊的長期摘要（可為空或 '無'）
 * @param {Array} dialogueSegment 需要被摘要的新對話片斷（陣列，包含 role 和 content）
 * @returns {Promise<string>} 生成的更新長期摘要
 */
async function generateUpdatedSummary(oldSummary, dialogueSegment) {
  const formattedDialogue = dialogueSegment
    .map(msg => `${msg.role === 'user' ? '玩家(修復師)' : 'NPC'}: ${msg.content}`)
    .join('\n');

  const systemPrompt = `
你是一位專業的心理對話分析師與文學顧問。
你的任務是根據「先前的長期情感摘要」以及「新發生的對話片斷」，提煉出更新後、最精煉的【長期情感與修復狀態摘要】。

【摘要撰寫規則】
1. 字數限制：請完全控制在 250 字內（繁體中文），不說廢話、直接切入重點。
2. 滾動更新：請將新對話中發生的「最新進展」或「心防突破」融入到先前的摘要中。
3. 格式要求：你必須嚴格按照以下格式輸出，不要輸出任何 JSON、Markdown 標籤或分析性廢話：

[核心心結]：(NPC 尚未解決的痛苦)
[已建立聯繫]：(玩家做過哪些讓 NPC 感動或信任的事)
[約定事項]：(雙方達成過什麼承諾，如果沒有請寫無)
`;

  const userPrompt = `
【先前的長期情感摘要】：
${oldSummary || '無'}

【新發生的對話片斷】：
${formattedDialogue}

請嚴格依照指定格式，輸出更新後的繁體中文摘要：
`;

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ];

  try {
    const responseText = await deepseekService.chat(messages);
    return String(responseText || '').trim();
  } catch (error) {
    console.error('Failed to generate dialogue summary:', error);
    // 如果失敗了，回傳舊的摘要保底
    return '無';
  }
}

module.exports = {
  generateUpdatedSummary
};
