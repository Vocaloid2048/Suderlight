/**
 * NPC 状态引擎 — 对话分类 + 状态变化（后端）
 *
 * 【修复】判定逻辑平衡：
 * - 默认 ordinary 从 {trust:+1, stress:0} 改为 {trust:0, stress:0}（不再无条件+1）
 * - contradict 从 {stress:-1} 改为 {stress:+5}（反驳应增加压力而非减少）
 * - 新增 hostile 类别：敌意/侮辱/威胁 → {trust:-8, stress:+12}
 * - 新增 dismiss 类别：冷漠/忽视/敷衍 → {trust:-3, stress:+3}
 */

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function hasAny(input, words) {
  return words.some(word => input.includes(word));
}

function checkUnlock(npc) {
  if (npc.knowledge >= npc.knowledgeRequired && npc.trust >= 50) {
    npc.innerWorldUnlocked = true;
  }
  return npc;
}

function classifyDialogue(message) {
  const input = String(message || '').trim().toLowerCase();

  const harmfulComfort = ['加油', '振作', '會好的', '一定會好', '好起來', '重新開始', '復出', '再畫', '一定可以'];
  const empathy = ['我陪你', '陪你', '不用立刻', '不用馬上', '慢慢來', '可以沉默', '不說話', '我願意聽', '聽你說', '不畫畫也沒關係', '你現在這樣也可以'];
  const grounding = ['雨聲', '風', '沉默', '聽見'];
  const contradict = ['不應該', '不同意', '不對', '不是這樣', '其實還是', '你只是', '逃避', '別把', '怪在', '你錯了'];
  const irrelevant = ['午餐', '咖哩', '手機', '沒電', '天氣預報', '放晴', '看到一隻貓', '電腦', '鍵盤'];
  const hostile = ['廢物', '去死', '沒用', '垃圾', '活該', '可悲', '軟弱', '懦夫', '裝病', '演的', '滾', '閉嘴', '殺', '爛'];
  const dismiss = ['隨便', '算了', '反正', '不重要', '無所謂', '懶得管', '不關我的事', '無聊', '嗯', '喔'];

  if (hasAny(input, hostile)) return 'hostile';
  if (hasAny(input, dismiss) && input.length < 4) return 'dismiss'; // 极短 dismiss 才算忽视，避免误判
  if (hasAny(input, harmfulComfort)) return 'comfort';
  if (hasAny(input, empathy) || hasAny(input, grounding)) return 'empathy';
  if (hasAny(input, contradict)) return 'contradict';
  if (hasAny(input, irrelevant)) return 'neutral';

  return 'ordinary';
}

function getDialogueDelta(message, knownType) {
  const dialogueType = knownType || classifyDialogue(message);

  // 敌意/侮辱 → 大幅降信任 + 大幅升压力
  if (dialogueType === 'hostile') {
    return { dialogueType, trustDelta: -8, stressDelta: 12 };
  }

  // 强行安慰 → 降信任 + 升压力
  if (dialogueType === 'comfort') {
    return { dialogueType, trustDelta: -3, stressDelta: 5 };
  }

  // 同理心/接纳 → 大幅升信任 + 降压力
  if (dialogueType === 'empathy') {
    return { dialogueType, trustDelta: 10, stressDelta: -6 };
  }

  // 【修复】反驳 → 不降信任，但升压力（以前是 stressDelta: -1，错了）
  if (dialogueType === 'contradict') {
    return { dialogueType, trustDelta: 0, stressDelta: 5 };
  }

  // 忽视/敷衍 → 略降信任 + 略升压力
  if (dialogueType === 'dismiss') {
    return { dialogueType, trustDelta: -3, stressDelta: 3 };
  }

  // 无关话题 → 完全中性
  if (dialogueType === 'neutral') {
    return { dialogueType, trustDelta: 0, stressDelta: 0 };
  }

  // 【修复】普通对话 → 完全中性（以前 trustDelta: 1，会无条件积累信任）
  return { dialogueType, trustDelta: 0, stressDelta: 0 };
}

function updateAfterDialogue(npc, message, knownType) {
  const { dialogueType, trustDelta, stressDelta } = getDialogueDelta(message, knownType);

  npc.trust = clamp(npc.trust + trustDelta);
  npc.stress = clamp(npc.stress + stressDelta);
  checkUnlock(npc);

  return {
    npc,
    dialogueType,
    trustDelta,
    stressDelta,
  };
}

function getStateLabel(npc) {
  if (npc.ending === 'success') return '修復完成';
  if (npc.ending === 'failed') return '失敗殘影';
  if (npc.innerWorldUnlocked) return '鬆動';
  if (npc.stress >= 85) return '緊繃';
  if (npc.stress <= 45) return '平靜';
  return '防備';
}

function setEnding(npc, ending) {
  if (!['success', 'failed', null].includes(ending)) {
    throw new Error('Invalid ending');
  }
  npc.ending = ending;
  return npc;
}

module.exports = {
  checkUnlock,
  classifyDialogue,
  getDialogueDelta,
  updateAfterDialogue,
  getStateLabel,
  setEnding,
};
