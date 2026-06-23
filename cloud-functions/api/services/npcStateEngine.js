/**
 * NPC 状态引擎 — 对话分类 + 状态变化 (Cloud Functions 版本)
 * 包含 context-aware 分类 + trust labels
 */
import memoryStore from './store.js';

// ---- 工具函数 ----
function clamp(v, min = 0, max = 100) { return Math.max(min, Math.min(max, v)); }
function hasAny(input, words) { return words.some(w => input.includes(w)); }

// ---- 对话分类 ----
const harmfulComfort = ['加油', '振作', '會好的', '一定會好', '好起來', '重新開始', '復出', '再畫', '一定可以'];
const empathyWords = ['我陪你', '陪你', '不用立刻', '不用馬上', '慢慢來', '可以沉默', '不說話', '我願意聽', '聽你說', '不畫畫也沒關係', '你現在這樣也可以'];
const grounding = ['雨聲', '風', '沉默', '聽見'];
const contradict = ['不應該', '不同意', '不對', '不是這樣', '其實還是', '你只是', '逃避', '別把', '怪在', '你錯了'];
const irrelevant = ['午餐', '咖哩', '手機', '沒電', '天氣預報', '放晴', '看到一隻貓', '電腦', '鍵盤'];
const hostile = ['廢物', '去死', '沒用', '垃圾', '活該', '可悲', '軟弱', '懦夫', '裝病', '演的', '滾', '閉嘴', '殺', '爛'];
const dismiss = ['隨便', '算了', '反正', '不重要', '無所謂', '懶得管', '不關我的事', '無聊', '嗯', '喔'];
const roleRelated = ['畫', '藝術', '創作', '色彩', '顏料', '畫布'];

function classifyDialogue(message, recentInputTypes = []) {
  const input = String(message || '').trim().toLowerCase();

  // 1. 关键词初步分类
  let type = 'ordinary';
  if (hasAny(input, hostile)) type = 'hostile';
  else if (hasAny(input, dismiss) && input.length < 4) type = 'dismiss';
  else if (hasAny(input, harmfulComfort)) type = 'comfort';
  else if (hasAny(input, empathyWords) || hasAny(input, grounding)) type = 'empathy';
  else if (hasAny(input, contradict)) type = 'contradict';
  else if (hasAny(input, irrelevant)) type = 'neutral';
  else if (hasAny(input, roleRelated)) type = 'role_related';

  // 2. Context-aware: empathy 用超過2次 → 降級為 comfort (有害)
  if (type === 'empathy' && recentInputTypes.length >= 3) {
    const recentEmpathy = recentInputTypes.slice(-3).filter(t => t === 'empathy').length;
    if (recentEmpathy >= 2) type = 'comfort';
  }

  return type;
}

// ---- Delta 计算 ----
function getDialogueDelta(message, knownType, recentInputTypes = []) {
  const dialogueType = knownType || classifyDialogue(message, recentInputTypes);

  if (dialogueType === 'hostile')     return { dialogueType, trustDelta: -8, stressDelta: 12 };
  if (dialogueType === 'comfort')     return { dialogueType, trustDelta: -3, stressDelta: 5 };
  if (dialogueType === 'empathy')     return { dialogueType, trustDelta: 10, stressDelta: -6 };
  if (dialogueType === 'contradict')  return { dialogueType, trustDelta: 0, stressDelta: 5 };
  if (dialogueType === 'dismiss')     return { dialogueType, trustDelta: -3, stressDelta: 3 };
  if (dialogueType === 'neutral')     return { dialogueType, trustDelta: 0, stressDelta: 0 };
  if (dialogueType === 'role_related') return { dialogueType, trustDelta: 2, stressDelta: -1 };
  return { dialogueType, trustDelta: 0, stressDelta: 0 };
}

// ---- 解锁检查 ----
function checkUnlock(npc) {
  if (npc.knowledge >= (npc.knowledgeRequired || 70) && npc.trust >= 50) {
    npc.innerWorldUnlocked = true;
  }
  return npc;
}

// ---- 更新 NPC 状态 ----
function updateAfterDialogue(npc, message, knownType, recentInputTypes = []) {
  const { dialogueType, trustDelta, stressDelta } = getDialogueDelta(message, knownType, recentInputTypes);
  npc.trust = clamp((npc.trust || 20) + trustDelta);
  npc.stress = clamp((npc.stress || 80) + stressDelta);

  // role_related: +3 knowledge, 其余不自动加
  if (dialogueType === 'role_related') {
    npc.knowledge = clamp((npc.knowledge || 0) + 3);
  }

  checkUnlock(npc);
  return { npc, dialogueType, trustDelta, stressDelta };
}

// ---- 状态标签 ----
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

// ---- 结局设置 ----
function setEnding(npc, ending) {
  if (!['success', 'failure', 'none'].includes(ending)) throw new Error('Invalid ending');
  npc.ending = ending;
  return npc;
}

export {
  clamp, checkUnlock,
  classifyDialogue, getDialogueDelta,
  updateAfterDialogue, getStateLabel, setEnding,
};
