export type BackendNpcState = {
  trust: number;
  stress: number;
  knowledge: number;
  innerWorldUnlocked: boolean;
  ending: 'success' | 'failed' | null;
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
 * 呼叫 Express 後端 /api/chat。
 * DeepSeek API Key 只存在後端，前端只送 npcId 與玩家輸入。
 */
export async function fetchLLMReply(playerMessage: string, npcId = 'bridge_artist'): Promise<string> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      npcId,
      message: playerMessage,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Backend chat API error: ${response.status} ${response.statusText}${errorText ? ` - ${errorText}` : ''}`);
  }

  const data: BackendChatResponse = await response.json();

  return JSON.stringify({
    dialogue: data.text,
    safetyLevel: 'safe',
    backendPsychology: data.psychology,
    backendNpcState: data.npcState,
  });
}
