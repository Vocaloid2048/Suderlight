import { getPlayerAuthHeaders } from '../lib/playerId';

export type BackendNpcState = {
  trust: number;
  stress: number;
  knowledge: number;
  innerWorldUnlocked: boolean;
  ending: 'none' | 'success' | 'failed' | null;
};

export type BackendChatResponse = {
  text: string;
  psychology?: {
    trustDelta: number;
    stressDelta: number;
    stateLabel: string;
    inputType?: string;
  };
  npcState?: BackendNpcState;
};

/**
 * 載入並切換角色的相容 Stub (後端 Express 直接控制 NPC，故此處僅作為佔位)
 * 保留此方法以防止其他模組因 import 遺失而導致編譯錯誤
 */
export async function switchCharacter(name: string): Promise<void> {
  console.log(`[Backend API] 佔位切換角色為: ${name} (已由後端 Express 直接控制)`);
}

/**
 * 發送對話並獲取其回覆的相容 Stub (直接呼叫後端 Express /api/chat)
 * 保留此方法以防止其他模組因 import 遺失而導致編譯錯誤
 */
export async function sendMessage(text: string): Promise<{ reply: string; emotion?: string }> {
  try {
    const authHeaders = await getPlayerAuthHeaders();
    const res = await fetch(`/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({ npcId: 'bridge_artist', message: text })
    });
    if (!res.ok) {
      throw new Error(`Express backend sendMessage error: ${res.status} ${res.statusText}`);
    }
    const result = await res.json();
    return {
      reply: result.text || '',
      emotion: result.psychology?.stateLabel || 'default'
    };
  } catch (error) {
    console.error('發送對話至後端 Express 失敗:', error);
    throw error;
  }
}

/**
 * 呼叫 Express 後端服務獲取模型回覆，並格式化為前端期待的 JSON 字串。
 * 完美融合 llm-docker 與 main 分支：
 * 1. 支援 main 分支的參數簽名與 type 定義，返回 backendPsychology 與 backendNpcState；
 * 2. 智慧映射傳入的 npcId/characterName，若傳入非 'bridge_artist' 亦會安全轉換，避免 API 404；
 * 3. 同時輸出 emotionDelta 以相容舊版前端解析邏輯，確保在任何電腦或分支下皆能正確運行。
 * @param playerMessage 使用者的問題或輸入內容
 * @param npcIdOrName 當前對談的角色名稱或角色 ID (預設為 'bridge_artist')
 * @returns 格式化後的 JSON 字串
 */
export async function fetchLLMReply(playerMessage: string, npcIdOrName = 'bridge_artist'): Promise<string> {
  try {
    // 智慧轉換角色名稱：若傳入的是大字串或中文名，自動對應回後端識別的 'bridge_artist'
    let finalNpcId = 'bridge_artist';
    if (npcIdOrName !== 'bridge_artist' && (npcIdOrName.includes('天橋畫家') || npcIdOrName.includes('artist'))) {
      finalNpcId = 'bridge_artist';
    } else if (npcIdOrName !== 'bridge_artist') {
      // 預留：如果傳入的是不匹配的長提示詞（如 system prompt 等），保證其不會作為無效 npcId 傳給後端
      finalNpcId = 'bridge_artist';
    }

    const authHeaders = await getPlayerAuthHeaders();
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({
        npcId: finalNpcId,
        message: playerMessage,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`Backend chat API error: ${response.status} ${response.statusText}${errorText ? ` - ${errorText}` : ''}`);
    }

    const data: BackendChatResponse = await response.json();

    // 解析情緒變化，用於與舊分支前端相容
    const trust = data.psychology?.trustDelta ?? 0;
    const pressure = data.psychology?.stressDelta ?? 0;

    // 全方位相容回傳格式：同時支援 main 的 backend* 屬性與舊版的 emotionDelta / dialogue
    return JSON.stringify({
      dialogue: data.text || '',
      emotionDelta: { trust, pressure },
      suggestedFlags: [] as string[],
      safetyLevel: 'safe' as const,
      backendPsychology: data.psychology,
      backendNpcState: data.npcState,
    });
  } catch (error) {
    console.error('Error in fetchLLMReply via Express backend:', error);
    throw error;
  }
}
