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

function getDialogueDelta(message) {
  const input = String(message || '').trim().toLowerCase();

  const harmfulComfort = ['加油', '振作', '會好的', '一定會好', '重新開始', '復出', '再畫'];
  const empathy = ['我陪你', '陪你', '不用立刻', '不用馬上', '慢慢來', '可以沉默', '不說話', '我願意聽', '聽你說', '不畫畫也沒關係', '你現在這樣也可以'];
  const grounding = ['雨聲', '風', '沉默', '聽見'];

  if (hasAny(input, harmfulComfort)) {
    return { trustDelta: -3, stressDelta: 5 };
  }

  if (hasAny(input, empathy)) {
    return { trustDelta: 10, stressDelta: -6 };
  }

  if (hasAny(input, grounding)) {
    return { trustDelta: 6, stressDelta: -4 };
  }

  return { trustDelta: 3, stressDelta: -1 };
}

function updateAfterDialogue(npc, message) {
  const { trustDelta, stressDelta } = getDialogueDelta(message);

  npc.trust = clamp(npc.trust + trustDelta);
  npc.stress = clamp(npc.stress + stressDelta);
  checkUnlock(npc);

  return {
    npc,
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
  getDialogueDelta,
  updateAfterDialogue,
  getStateLabel,
  setEnding,
};

