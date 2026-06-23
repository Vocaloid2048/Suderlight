/**
 * Summary Service —— 长期对话摘要生成 (200字 + 记住重点)
 */
import deepseekChat from './deepseekService.js';

async function generateUpdatedSummary(oldSummary, dialogueSegment) {
  const formatted = dialogueSegment.map(m =>
    `${m.role === 'user' ? '玩家(修復師)' : 'NPC'}: ${m.content}`
  ).join('\n');

  const sys = `你是一位專業的心理對話分析師與文學顧問。
你的任務是根據「先前的長期情感摘要」以及「新發生的對話片斷」，提煉出更新後、最精煉的【長期情感與修復狀態摘要】，使用繁體中文回覆。

【摘要撰寫規則】
1. 字數限制：請完全控制在 200 字內（繁體中文），不說廢話、直接切入重點。
2. 滾動更新：請將新對話中發生的「最新進展」或「心防突破」融入到先前的摘要中。
3. 格式要求：你必須嚴格按照以下格式輸出，不要輸出任何 JSON、Markdown 標籤或分析性廢話：

[核心心結]：(NPC 尚未解決的痛苦)
[已建立聯繫]：(玩家做過哪些讓 NPC 感動或信任的事)
[約定事項]：(雙方達成過什麼承諾，如果沒有請寫無)`;

  const msgs = [
    { role: 'system', content: sys },
    { role: 'user', content: `【先前的長期情感摘要】：\n${oldSummary || '無'}\n\n【新發生的對話片斷】：\n${formatted}\n\n請嚴格依照指定格式，輸出更新後的繁體中文摘要：` },
  ];

  const reply = await deepseekChat(msgs);
  const cleaned = String(reply || '').replace(/```json/gi, '').replace(/```/g, '').trim();
  try { const p = JSON.parse(cleaned); return p.summary || p.text || cleaned; } catch { return cleaned; }
}

export { generateUpdatedSummary };
