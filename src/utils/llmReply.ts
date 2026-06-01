/**
 * SillyTavern API 配置與調用封裝
 */

/**
 * 載入並切換 SillyTavern 中的角色
 * @param name 角色卡上的角色名稱 (character_name)
 */
export async function switchCharacter(name: string): Promise<void> {
  try {
    const res = await fetch(`/api/characters/load`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ character_name: name })
    });
    if (!res.ok) {
      throw new Error(`SillyTavern switchCharacter error: ${res.status} ${res.statusText}`);
    }
  } catch (error) {
    console.error(`切換角色至 ${name} 失敗:`, error);
    throw error;
  }
}

/**
 * 向 SillyTavern 發送對話並獲取其 completions 回覆
 * @param text 玩家輸入的台詞
 * @returns 回傳包含 { reply, emotion } 的 JSON
 */
export async function sendMessage(text: string): Promise<{ reply: string; emotion?: string }> {
  try {
    const res = await fetch(`/api/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text })
    });
    if (!res.ok) {
      throw new Error(`SillyTavern sendMessage error: ${res.status} ${res.statusText}`);
    }
    return await res.json();
  } catch (error) {
    console.error('發送對話至 SillyTavern 失敗:', error);
    throw error;
  }
}

/**
 * 相容層：呼叫 SillyTavern 獲取模型回覆，並格式化為前端原本期望的 JSON 字串，
 * 確保原本 BlankPainterChat.tsx 中的解析邏輯不需要進行破壞性修改。
 * @param userContent 使用者的問題或輸入內容
 * @param characterName 當前對談的角色名稱 (預設為 '天橋畫家')
 * @returns 格式化後的 JSON 字串
 */
export async function fetchLLMReply(userContent: string, characterName: string = '天橋畫家'): Promise<string> {
  try {
    // 1. 先確認切換角色
    await switchCharacter(characterName);
    
    // 2. 獲取 SillyTavern 對話回覆
    const result = await sendMessage(userContent);
    
    // 3. 情感數值轉換 (將 SillyTavern 回傳的 emotion 映射為情緒修復師原本期望的 Trust / Pressure 變化)
    let trust = 0;
    let pressure = 0;
    
    if (result.emotion) {
      const emoLower = result.emotion.toLowerCase();
      // 根據常見情緒做基本映射
      if (emoLower.includes('trust') || emoLower.includes('happy') || emoLower.includes('joy') || emoLower.includes('warm') || emoLower.includes('love')) {
        trust = 2;
        pressure = -1;
      } else if (emoLower.includes('press') || emoLower.includes('sad') || emoLower.includes('fear') || emoLower.includes('anger') || emoLower.includes('anxiety')) {
        trust = -1;
        pressure = 2;
      }
    }
    
    const formattedResponse = {
      dialogue: result.reply || '',
      emotionDelta: { trust, pressure },
      suggestedFlags: [] as string[],
      safetyLevel: 'safe' as const
    };
    
    return JSON.stringify(formattedResponse);
  } catch (error) {
    console.error('Error in fetchLLMReply via SillyTavern:', error);
    throw error;
  }
}
