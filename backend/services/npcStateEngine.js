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

function updateAfterDialogue(npc, message) {
  const input = String(message || '').trim().toLowerCase();

  const harmfulComfort = ['加油', '振作', '會好的', '一定會好', '重新開始', '復出', '再畫'];
  const empathy = ['我陪你', '陪你', '不用立刻', '不用馬上', '慢慢來', '可以沉默', '不說話', '我願意聽', '聽你說', '不畫畫也沒關係', '你現在這樣也可以'];
  const grounding = ['雨聲', '風', '沉默', '聽見'];

  if (hasAny(input, harmfulComfort)) {
    npc.trust = clamp(npc.trust - 3);
    npc.stress = clamp(npc.stress + 5);
  } else if (hasAny(input, empathy)) {
    npc.trust = clamp(npc.trust + 10);
    npc.stress = clamp(npc.stress - 6);
  } else if (hasAny(input, grounding)) {
    npc.trust = clamp(npc.trust + 6);
    npc.stress = clamp(npc.stress - 4);
  } else {
    npc.trust = clamp(npc.trust + 3);
    npc.stress = clamp(npc.stress - 1);
  }

  return checkUnlock(npc);
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
  updateAfterDialogue,
  getStateLabel,
  setEnding,
};
