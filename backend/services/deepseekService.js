const fs = require('fs');
const path = require('path');

const promptMap = {
  bridge_artist: path.join(__dirname, '..', 'prompts', 'artist.txt'),
};

function readPrompt(npcId) {
  const promptPath = promptMap[npcId];
  if (!promptPath) {
    throw new Error(`Prompt not found for npcId: ${npcId}`);
  }

  return fs.readFileSync(promptPath, 'utf8');
}

function parseDeepSeekJson(content) {
  const cleaned = String(content || '')
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();

  try {
    const parsed = JSON.parse(cleaned);
    return {
      text: parsed.text || parsed.dialogue || cleaned,
    };
  } catch (error) {
    return { text: cleaned };
  }
}

function fallbackReply(message) {
  const input = String(message || '').toLowerCase();

  if (input.includes('你好')) {
    return { text: '……你好。\n如果你也是來問我什麼時候復出，那就別開口了。' };
  }

  if (input.includes('陪') || input.includes('慢慢') || input.includes('不說話')) {
    return { text: '……你不急著把我變回去？\n那就站遠一點吧。雨聲會比較清楚。' };
  }

  if (input.includes('雨聲')) {
    return { text: '雨聲……\n很久沒聽過了。我一直以為它也變成灰色了。' };
  }

  return { text: '他沒有立刻回答。畫筆停在半空，像一個還沒決定要不要落下的句號。' };
}

async function generateNpcReply(npcId, message) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  const model = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
  const systemPrompt = readPrompt(npcId);

  if (!apiKey || apiKey === 'YOUR_KEY') {
    return fallbackReply(message);
  }

  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: String(message || '') },
      ],
      temperature: 0.7,
      stream: false,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`DeepSeek API error ${response.status}: ${body}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';
  return parseDeepSeekJson(content);
}

module.exports = {
  generateNpcReply,
  readPrompt,
};
