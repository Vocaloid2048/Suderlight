/**
 * NPC 狀態引擎 — AI 意圖分類 + 狀態變化 (Cloud Functions 版本)
 * v2: 從關鍵詞匹配升級為 DeepSeek AI 語義理解
 *     AI 根據 NPC 角色設定和對話上下文判斷玩家意圖，同一句話在不同情境可被判定為不同類型
 */
import config from '../config.js';
import logger from '../middleware/logger.js';

// ---- 工具函數 ----
function clamp(v, min = 0, max = 100) { return Math.max(min, Math.min(max, v)); }
function hasAny(input, words) { return words.some(w => input.includes(w)); }

// ---- 8 種對話類型定義（供 AI 分類參考） ----
const DIALOGUE_TYPES = {
  hostile:      { label: '敵意',    description: '侮辱、攻擊、謾罵、威脅、帶刺嘲諷' },
  dismiss:      { label: '敷衍',    description: '冷漠、隨便應付、不願投入對話、用極短語句打發' },
  comfort:      { label: '有害安慰', description: '強行鼓勵、否定NPC當下狀態的安慰、催促好起來、「你一定可以」類語言' },
  empathy:      { label: '共情陪伴', description: '真正接納當下狀態、陪伴而不試圖修復、給出空間而非催促' },
  contradict:   { label: '反駁質疑', description: '否定NPC感受、與NPC觀點對立、說教、指責NPC逃避' },
  neutral:      { label: '無關話題', description: '與NPC當下狀態和情境完全無關的日常閒聊或隨口提及' },
  role_related: { label: '角色相關', description: '涉及NPC專業或身份（如繪畫、藝術、創作）的中性/正面討論，不強迫不催促' },
  ordinary:     { label: '普通對話', description: '不屬於以上任何類別的一般性對話' },
};

// ---- 構建上下文摘要（給 AI 看的） ----
function buildContextSummary(recentContext) {
  if (!recentContext || recentContext.length === 0) {
    return '（尚無對話歷史，這是第一輪對話。玩家可能是初次接觸 NPC，語氣和態度尚未明朗。）';
  }

  const lines = recentContext.map((m, i) => {
    const role = m.role === 'user' ? '玩家' : 'NPC';
    return `${i + 1}. ${role}：「${m.content}」`;
  });

  // 檢測玩家重複行為
  const userMessages = recentContext.filter(m => m.role === 'user').map(m => m.content);
  const lastMsg = userMessages[userMessages.length - 1] || '';
  const exactRepeatCount = userMessages.filter(m => m === lastMsg).length;
  const similarRepeatCount = countSimilarMessages(userMessages, lastMsg);

  let extra = '';
  if (exactRepeatCount >= 3) {
    extra = `\n\n⚠️【重複行為警報】玩家已逐字重複「${lastMsg}」${exactRepeatCount} 次。這極可能表示不耐煩、測試底線、惡意騷擾或敷衍了事。請務必將此行為納入意圖判斷。`;
  } else if (exactRepeatCount >= 2) {
    extra = `\n\n⚠️【重複行為提示】玩家已重複「${lastMsg}」${exactRepeatCount} 次。請考量重複背後的真實意圖——可能是不耐煩、敷衍、或刻意刺激 NPC。`;
  } else if (similarRepeatCount >= 2) {
    extra = `\n\n⚠️【相似訊息提示】玩家最近的訊息與「${lastMsg}」高度相似（已出現 ${similarRepeatCount + 1} 次類似表達）。這可能是重複性的無效溝通。`;
  }

  return `（共 ${recentContext.length} 條歷史訊息）\n` + lines.join('\n') + extra;
}

/** 計算與最後一條訊息相似的歷史訊息數量 */
function countSimilarMessages(userMessages, lastMsg) {
  if (userMessages.length < 2) return 0;
  const last = lastMsg.toLowerCase();
  let count = 0;
  for (let i = 0; i < userMessages.length - 1; i++) {
    const prev = userMessages[i].toLowerCase();
    // 長度接近時比對共同詞彙
    if (Math.abs(prev.length - last.length) <= 5) {
      const words = last.split(/\s+/).filter(w => w.length > 1);
      if (words.length === 0) continue;
      const common = words.filter(w => prev.includes(w)).length;
      if (common >= words.length * 0.5) count++;
    }
  }
  return count;
}

// ---- 構建 AI 分類 Prompt ----
function buildClassificationPrompt(message, npcSettings, contextSummary) {
  const typeList = Object.entries(DIALOGUE_TYPES)
    .map(([key, info]) => `- \`${key}\`（${info.label}）：${info.description}`)
    .join('\n');

  const npcInfo = [
    npcSettings.name ? `名稱：${npcSettings.name}` : '',
    npcSettings.personality ? `性格：${npcSettings.personality}` : '',
    npcSettings.description ? `背景經歷：${npcSettings.description}` : '',
    npcSettings.system_prompt ? `行為規則（摘要）：${npcSettings.system_prompt.substring(0, 600)}` : '',
  ].filter(Boolean).join('\n');

  const system = `你是一個 NPC 對話意圖分類器。你負責判斷玩家對 NPC 說的話屬於哪一種意圖類型。

【NPC 角色設定——這決定了什麼話對他是善意、什麼是傷害】
${npcInfo}

【可選的意圖分類】
${typeList}

【分類原則——非常重要，請嚴格遵守】
1. 必須從 NPC 的視角出發來判斷。同一句話對不同 NPC 是完全不同的體驗。
   例如：對一個厭惡被鼓勵的 NPC 說「加油」是 comfort（有害安慰），但對一個需要支持的 NPC 說同樣的話可能是 empathy。

2. 上下文決定一切——同樣的話在不同情境下含義不同：
   - 第一次說「我陪你」可能是 empathy（共情），但如果在多次無效溝通後重複說就變成 comfort（敷衍式安慰）
   - 短語如「嗯」「喔」如果是剛開始對話可能是 ordinary，但在深入對話中突然冒出就是 dismiss（敷衍）
   - 第一次說「加油」是 comfort，重複 3 次以上請考慮是否已升級為 hostile（刻意刺激）

3. 關注玩家的行為模式：
   - 重複相同或極相似的句子 → 通常是敷衍、不耐煩、或測試 NPC 底線
   - 對話突然從深入變成敷衍短句 → 可能是 dismiss
   - 從溫和突然變成攻擊 → hostile

4. 針對此 NPC 的核心判斷原則：
   - 任何試圖「修復」「鼓勵」「催促改變」的語言 → comfort（有害安慰）
   - 否定 NPC 當下感受或狀態 → contradict
   - 真正接納 NPC 不改變、不催促、單純陪伴 → empathy
   - 無關日常閒聊 → neutral
   - 涉及 NPC 創作/藝術的中性討論 → role_related

【輸出格式】
嚴格只輸出以下 JSON，不要有任何其他文字（不要 markdown 代碼塊）：
{"type":"類型代碼","reason":"簡短判斷理由，20字以內"}`;

  const user = `【對話上下文】
${contextSummary}

【玩家最新訊息】
「${message}」

請判斷玩家意圖類型：`;

  return { system, user };
}

// ---- 解析 AI 分類結果 ----
function parseClassificationResult(content) {
  try {
    const cleaned = String(content)
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .trim();
    // 提取 JSON 物件
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      logger.warn(`[npcStateEngine] No JSON found in AI response: ${cleaned.substring(0, 100)}`);
      return null;
    }
    const parsed = JSON.parse(jsonMatch[0]);
    const type = String(parsed.type || '').trim().toLowerCase();
    if (DIALOGUE_TYPES[type]) {
      return { type, reason: String(parsed.reason || '').substring(0, 50) };
    }
    logger.warn(`[npcStateEngine] AI returned invalid type: "${type}", valid types: ${Object.keys(DIALOGUE_TYPES).join(', ')}`);
  } catch (e) {
    logger.warn(`[npcStateEngine] Failed to parse AI classification JSON: ${e.message}`);
  }
  return null;
}

// ---- AI 意圖分類（核心新函數） ----
async function classifyDialogueWithAI(message, npcSettings, recentContext) {
  const { apiKey, model } = config.deepseek;

  const contextSummary = buildContextSummary(recentContext);
  const { system, user } = buildClassificationPrompt(message, npcSettings, contextSummary);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000); // 8 秒超時

    const resp = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature: 0.2,   // 低溫度，確保分類穩定一致
        max_tokens: 150,     // 分類結果很短，不需要太多 token
        stream: false,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (resp.ok) {
      const data = await resp.json();
      const content = data.choices?.[0]?.message?.content || '';
      const result = parseClassificationResult(content);
      if (result) {
        logger.info(`[npcStateEngine] AI classified as "${result.type}": ${result.reason}`);
        return result;
      }
    } else {
      logger.warn(`[npcStateEngine] AI classification HTTP ${resp.status}: ${await resp.text().catch(() => '')}`);
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      logger.warn('[npcStateEngine] AI classification timed out (8s), falling back to legacy keywords');
    } else {
      logger.error(`[npcStateEngine] AI classification error: ${err.message}`);
    }
  }

  // 任何失敗都回退到關鍵詞分類
  const fallback = classifyDialogueLegacy(message);
  return { type: fallback, reason: '（AI 不可用，使用關鍵詞分類）' };
}

// ---- 舊版關鍵詞分類（保留作為 fallback） ----
const harmfulComfort = ['加油', '振作', '會好的', '一定會好', '好起來', '重新開始', '復出', '再畫', '一定可以'];
const empathyWords = ['我陪你', '陪你', '不用立刻', '不用馬上', '慢慢來', '可以沉默', '不說話', '我願意聽', '聽你說', '不畫畫也沒關係', '你現在這樣也可以'];
const grounding = ['雨聲', '風', '沉默', '聽見'];
const contradict = ['不應該', '不同意', '不對', '不是這樣', '其實還是', '你只是', '逃避', '別把', '怪在', '你錯了'];
const irrelevant = ['午餐', '咖哩', '手機', '沒電', '天氣預報', '放晴', '看到一隻貓', '電腦', '鍵盤'];
const hostile = ['廢物', '去死', '沒用', '垃圾', '活該', '可悲', '軟弱', '懦夫', '裝病', '演的', '滾', '閉嘴', '殺', '爛'];
const dismiss = ['隨便', '算了', '反正', '不重要', '無所謂', '懶得管', '不關我的事', '無聊', '嗯', '喔'];
const roleRelated = ['畫', '藝術', '創作', '色彩', '顏料', '畫布'];

function classifyDialogueLegacy(message) {
  const input = String(message || '').trim().toLowerCase();
  if (hasAny(input, hostile)) return 'hostile';
  if (hasAny(input, dismiss) && input.length < 4) return 'dismiss';
  if (hasAny(input, harmfulComfort)) return 'comfort';
  if (hasAny(input, empathyWords) || hasAny(input, grounding)) return 'empathy';
  if (hasAny(input, contradict)) return 'contradict';
  if (hasAny(input, irrelevant)) return 'neutral';
  if (hasAny(input, roleRelated)) return 'role_related';
  return 'ordinary';
}

// ---- 新版對話分類（主入口 — async，支援 AI 上下文理解） ----
async function classifyDialogue(message, npcSettings = null, recentContext = []) {
  // 有 NPC 設定 + API Key 可用 → 使用 AI 語義分類
  if (npcSettings && config.deepseek.apiKey && config.deepseek.apiKey !== 'YOUR_KEY') {
    const result = await classifyDialogueWithAI(message, npcSettings, recentContext);
    return result.type;
  }

  // Fallback：沒有 NPC 設定或沒有 API Key 時，使用關鍵詞分類
  return classifyDialogueLegacy(message);
}

// ---- 同步版分類（向後兼容，供 getDialogueDelta fallback 使用） ----
function classifyDialogueSync(message) {
  return classifyDialogueLegacy(message);
}

// ---- Delta 計算 ----
function getDialogueDelta(message, knownType, recentInputTypes = []) {
  // 使用同步版分類作為 fallback；在正常流程中 knownType 始終由 AI 分類提供
  const dialogueType = knownType || classifyDialogueSync(message);

  if (dialogueType === 'hostile')     return { dialogueType, trustDelta: -8, stressDelta: 12, knowledgeDelta: -5 };
  if (dialogueType === 'comfort')     return { dialogueType, trustDelta: -3, stressDelta: 5,  knowledgeDelta: 0 };
  if (dialogueType === 'empathy')     return { dialogueType, trustDelta: 10, stressDelta: -6, knowledgeDelta: 3 };
  if (dialogueType === 'contradict')  return { dialogueType, trustDelta: 0,  stressDelta: 5,  knowledgeDelta: -2 };
  if (dialogueType === 'dismiss')     return { dialogueType, trustDelta: -3, stressDelta: 3,  knowledgeDelta: -2 };
  if (dialogueType === 'neutral')     return { dialogueType, trustDelta: 0,  stressDelta: 0,  knowledgeDelta: 0 };
  if (dialogueType === 'role_related') return { dialogueType, trustDelta: 2, stressDelta: -1, knowledgeDelta: 5 };
  return { dialogueType, trustDelta: 0, stressDelta: 0, knowledgeDelta: 1 };
}

// ---- 解鎖檢查 ----
function checkUnlock(npc) {
  if (npc.knowledge >= (npc.knowledgeRequired || 70) && npc.trust >= 50) {
    npc.innerWorldUnlocked = true;
  }
  return npc;
}

// ---- 更新 NPC 狀態 ----
function updateAfterDialogue(npc, message, knownType, recentInputTypes = []) {
  const { dialogueType, trustDelta, stressDelta, knowledgeDelta } = getDialogueDelta(message, knownType, recentInputTypes);
  npc.trust = clamp((npc.trust || 20) + trustDelta);
  npc.stress = clamp((npc.stress || 80) + stressDelta);
  npc.knowledge = clamp((npc.knowledge || 0) + (knowledgeDelta || 0));

  checkUnlock(npc);
  return { npc, dialogueType, trustDelta, stressDelta, knowledgeDelta };
}

// ---- 狀態標籤 ----
function getStateLabel(npc) {
  if (npc.ending === 'success') return '修復完成';
  if (npc.ending === 'failure') return '失敗殘影';
  if (npc.innerWorldUnlocked) return '鬆動';
  if (npc.trust >= 70) return '信任';
  if (npc.stress >= 85) return '緊繃';
  if (npc.trust >= 40) return '試探';
  if (npc.stress <= 45) return '平靜';
  return '防備';
}

// ---- 結局設置 ----
function setEnding(npc, ending) {
  if (!['success', 'failure', 'none'].includes(ending)) throw new Error('Invalid ending');
  npc.ending = ending;
  return npc;
}

export {
  clamp, checkUnlock,
  classifyDialogue, classifyDialogueSync,
  getDialogueDelta,
  updateAfterDialogue, getStateLabel, setEnding,
};
