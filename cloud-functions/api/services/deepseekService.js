/**
 * DeepSeek Service —— LLM 对话调用
 */
import config from '../config.js';
import logger from '../middleware/logger.js';

async function deepseekChat(messages) {
  const { apiKey, model } = config.deepseek;
  if (apiKey && apiKey !== 'YOUR_KEY' && apiKey.trim() !== '') {
    try {
      const resp = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model, messages, temperature: 0.8, stream: false }),
      });
      if (resp.ok) {
        const data = await resp.json();
        const content = data.choices?.[0]?.message?.content || '';
        const cleaned = String(content).replace(/```json/gi, '').replace(/```/g, '').trim();
        try { const p = JSON.parse(cleaned); return p.text || p.dialogue || cleaned; }
        catch { return cleaned; }
      }
    } catch (err) { logger.error('DeepSeek API error:', err.message); }
  }
  // Fallback
  const last = [...messages].reverse().find(m => m.role === 'user');
  const msg = String(last?.content || '').toLowerCase();
  if (msg.includes('你好')) return '……你好。\n如果你也是來問我什麼時候復出，那就別開口了。';
  if (msg.includes('陪') || msg.includes('慢慢') || msg.includes('不說話')) return '……你不急著把我變回去？\n那就站遠一點吧。雨聲會比較清楚。';
  if (msg.includes('雨聲')) return '雨聲……\n很久沒聽過了。我一直以為它也變成灰色了。';
  return '他沒有立刻回答。畫筆停在半空，像一個還沒決定要不要落下的句號。';
}

export default deepseekChat;
