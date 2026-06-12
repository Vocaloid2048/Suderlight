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

// 用於 chat(messages) 的輔助解析函數，返回純字串
function parseDeepSeekJsonText(content) {
  const cleaned = String(content || '')
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();

  try {
    const parsed = JSON.parse(cleaned);
    return parsed.text || parsed.dialogue || cleaned;
  } catch (error) {
    return cleaned;
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

/**
 * 相容舊版本呼叫方式 (以 npcId, message 進行調用)
 */
async function generateNpcReply(npcId, message) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  const model = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
  const systemPrompt = readPrompt(npcId);
  
  const ollamaUrl = process.env.OLLAMA_URL || 'http://host.docker.internal:11434';
  const ollamaModel = process.env.OLLAMA_MODEL || 'gemma4:e2b';

  // 1. 如果配置了有效的 DeepSeek API Key，則調用 DeepSeek
  if (apiKey && apiKey !== 'YOUR_KEY' && apiKey.trim() !== '') {
    try {
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

      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || '';
        return parseDeepSeekJson(content);
      } else {
        const body = await response.text();
        console.error(`DeepSeek API error ${response.status}: ${body}`);
      }
    } catch (err) {
      console.error('DeepSeek API 請求失敗，嘗試降級：', err);
    }
  }

  // 2. 如果沒有 DeepSeek 密鑰，但配置了 OLLAMA_URL，則調用 Ollama 容器
  else if (ollamaUrl) {
    try {
      const url = `${ollamaUrl.replace(/\/$/, '')}/api/chat`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: ollamaModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: String(message || '') },
          ],
          stream: false,
          options: {
            temperature: 0.7
          }
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.message?.content || '';
        return parseDeepSeekJson(content);
      } else {
        const body = await response.text();
        console.error(`Ollama API error ${response.status}: ${body}`);
      }
    } catch (err) {
      console.error('Ollama API 請求失敗，退回 fallbackReply：', err);
    }
  }

  // 3. 兜底回覆
  return fallbackReply(message);
}

/**
 * 核心：新版本呼叫方式 (以 promptBuilder 構建好的 messages 陣列進行調用)
 */
async function chat(messages) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  const model = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
  const ollamaUrl = process.env.OLLAMA_URL || 'http://host.docker.internal:11434';
  const ollamaModel = process.env.OLLAMA_MODEL || 'gemma4:e2b';

  // 1. 如果配置了有效的 DeepSeek API Key，則調用 DeepSeek
  if (apiKey && apiKey !== 'YOUR_KEY' && apiKey.trim() !== '') {
    try {
      const response = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: messages, // 直接傳入構建好的 messages 陣列
          temperature: 0.7,
          stream: false,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || '';
        return parseDeepSeekJsonText(content);
      } else {
        const body = await response.text();
        console.error(`DeepSeek API error ${response.status}: ${body}`);
      }
    } catch (err) {
      console.error('DeepSeek API 請求失敗，嘗試降級：', err);
    }
  }

  // 2. 如果沒有 DeepSeek 密鑰，但配置了 OLLAMA_URL，則調用 Ollama 容器

  else if (ollamaUrl) {
    try {
      const url = `${ollamaUrl.replace(/\/$/, '')}/api/chat`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: ollamaModel,
          messages: messages, // 直接傳入構建好的 messages 陣列
          stream: false,
          options: {
            temperature: 0.7
          }
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.message?.content || '';
        return parseDeepSeekJsonText(content);
      } else {
        const body = await response.text();
        console.error(`Ollama API error ${response.status}: ${body}`);
      }
    } catch (err) {
      console.error('Ollama API 請求失敗，退回 fallback：', err);
    }
  }

  // 3. Fallback: 從 messages 陣列中提取最後一條 user 訊息作為 Fallback 的輸入
  const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
  const userContent = lastUserMsg ? lastUserMsg.content : '';
  const fallbackObj = fallbackReply(userContent);
  return fallbackObj.text;
}

module.exports = {
  chat,
  generateNpcReply,
  readPrompt,
};
