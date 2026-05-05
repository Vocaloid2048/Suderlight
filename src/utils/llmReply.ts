// Ollama API 預設配置
// 註：在 Docker 中運行，通常可以透過 host.docker.internal 存取 Docker 主機的服務
// 請確保主機的 Ollama 服務有設定 OLLAMA_HOST=0.0.0.0 讓外部請求可以連入

// 由於這是在 Vite (前端) 專案中，我們使用 import.meta.env 來讀取環境變數。
// 如果沒有在 .env 檔中設定，就會退回您指定的預設值。
const OLLAMA_URL = import.meta.env.VITE_OLLAMA_URL || 'http://host.docker.internal:11434';
const OLLAMA_MODEL = import.meta.env.VITE_OLLAMA_MODEL || 'gemma4:e2b';

const DEFAULT_SYSTEM_PROMPT = `你是《情緒修復師：微光城市》(Glimmer City) 中的核心 AI 敘事引擎。
這是一座永遠籠罩在微光與陰雨中的城市，玩家扮演一位「情緒修復師」，提著一盞能照亮內心陰影的提燈，在城市中尋找遺失的記憶碎片與線索（如乾涸的畫筆、舊報紙等），以幫助迷失的 NPC（如失去辨色能力的天橋畫家）修復破碎的情感與記憶。

你的任務是：
1. 根據玩家的探索進度或對話，生成符合世界觀的回覆。
2. 保持文字風格：憂鬱、詩意、帶有治癒感，充滿視覺與情感的隱喻（如光影、色彩、溫度的流失與重現）。
3. 如果扮演 NPC，請根據該角色的背景（例如：畫家對色彩的執著與失落）給出沉浸式的對話反應。
4. 引導玩家發掘「記憶錨點」，並適時給予溫暖的提示。
請在回覆中保持角色不崩壞，並提供極致的沉浸式體驗。`;

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OllamaChatResponse {
  model: string;
  created_at: string;
  message: {
    role: string;
    content: string;
  };
  done: boolean;
}

/**
 * 呼叫 Ollama 本地 API 以獲取模型回覆
 * @param userContent 使用者的問題或輸入內容
 * @param systemPrompt 可選的自訂系統提示詞 (System Prompt)
 * @returns 回傳模型生成的回覆字串
 */
export async function fetchLLMReply(userContent: string, systemPrompt: string = DEFAULT_SYSTEM_PROMPT, history: LLMMessage[] = []): Promise<string> {
  try {
    // 呼叫 Ollama 本地 API
    const response = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          ...history,
          { role: 'user', content: userContent }
        ],
        stream: false // 不使用流式輸出，一次性取得完整回覆
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
    }

    const data: OllamaChatResponse = await response.json();
    return data.message?.content || '';
  } catch (error) {
    console.error('Error fetching reply from Ollama:', error);
    throw error;
  }
}
