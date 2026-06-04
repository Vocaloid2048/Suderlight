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
1. 字數限制：請完全控制在 150 - 200 字內（繁體中文），不說廢話、直接切入重點。
2. 聚焦核心：
   - NPC 目前的情緒與修復進展（防備、鬆動、平靜或緊繃）。
   - NPC 提到的關鍵過去或心結事件（如失去了什麼、為什麼痛苦）。
   - 玩家（修復師）給予的關鍵承諾、開導切入點或對話突破。
3. 滾動更新：請將新對話中發生的「最新進展」或「心防突破」融入到先前的摘要中。如果新對話沒有實質進展，則保持或精簡舊摘要。
4. 格式要求：只輸出這一段繁體中文摘要，不要輸出任何 JSON、Markdown 標籤或分析性廢話。
`;

  const userPrompt = `
【先前的長期情感摘要】：
${oldSummary || '無'}

【新發生的對話片斷】：
${formattedDialogue}

請輸出更新後的 150-200 字繁體中文摘要：
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
    return oldSummary || '無';
  }
}

module.exports = {
  generateUpdatedSummary
};
