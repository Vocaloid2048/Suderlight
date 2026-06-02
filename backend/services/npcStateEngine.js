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

  if (hasAny(input, harmfulComfort)) return 'comfort';
  if (hasAny(input, empathy) || hasAny(input, grounding)) return 'empathy';
  if (hasAny(input, contradict)) return 'contradict';
  if (hasAny(input, irrelevant)) return 'neutral';

  return 'ordinary';
}

function getDialogueDelta(message, knownType) {
  const dialogueType = knownType || classifyDialogue(message);

  if (dialogueType === 'comfort') {
    return { dialogueType, trustDelta: -3, stressDelta: 5 };
  }

  if (dialogueType === 'empathy') {
    return { dialogueType, trustDelta: 10, stressDelta: -6 };
  }

  if (dialogueType === 'contradict') {
    return { dialogueType, trustDelta: 0, stressDelta: -1 };
  }

  if (dialogueType === 'neutral') {
    return { dialogueType, trustDelta: 0, stressDelta: 0 };
  }

  return { dialogueType, trustDelta: 1, stressDelta: 0 };
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
