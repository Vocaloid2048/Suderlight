/**
 * Express Backend API 配置與調用封裝
 */

/**
 * 載入並切換角色的相容 Stub (後端 Express 直接控制 NPC，故此處僅作為佔位)
 */
export async function switchCharacter(name: string): Promise<void> {
  console.log(`[Backend API] 佔位切換角色為: ${name} (已由後端 Express 直接控制)`);
}

/**
 * 發送對話並獲取其回覆的相容 Stub (直接呼叫後端 Express /api/chat)
 */
export async function sendMessage(text: string): Promise<{ reply: string; emotion?: string }> {
  try {
    const res = await fetch(`/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
 * 呼叫 Express 後端服務獲取模型回覆，並格式化為前端原本期望的 JSON 字串，
 * 確保原本 BlankPainterChat.tsx 中的解析邏輯不需要進行破壞性修改。
 * @param userContent 使用者的問題或輸入內容
 * @param characterName 當前對談的角色名稱 (預設為 '天橋畫家')
 * @returns 格式化後的 JSON 字串
 */
export async function fetchLLMReply(userContent: string, characterName: string = '天橋畫家'): Promise<string> {
  try {
    // 1. 將角色名稱轉換成後端識別的 npcId
    let npcId = 'bridge_artist';
    if (characterName.includes('天橋畫家') || characterName.includes('artist')) {
      npcId = 'bridge_artist';
    }

    // 2. 呼叫後端 Express 的 /api/chat 對話端點
    const res = await fetch(`/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        npcId: npcId,
        message: userContent
      })
    });

    if (!res.ok) {
      throw new Error(`Express backend /api/chat 錯誤: ${res.status} ${res.statusText}`);
    }

    const result = await res.json();

    // 3. 提取情緒數值轉換 (將後端 psychology 中的 trustDelta / stressDelta 映射為前端期望的 Trust / Pressure 變化)
    const trust = result.psychology?.trustDelta ?? 0;
    const pressure = result.psychology?.stressDelta ?? 0;

    const formattedResponse = {
      dialogue: result.text || '',
      emotionDelta: { trust, pressure },
      suggestedFlags: [] as string[],
      safetyLevel: 'safe' as const
    };

    return JSON.stringify(formattedResponse);
  } catch (error) {
    console.error('Error in fetchLLMReply via Express backend:', error);
    throw error;
  }
}
