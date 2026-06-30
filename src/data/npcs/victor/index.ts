// ============================================================
// 調香師維克多 NPC 定義 — 骨架
// 保留 victor.ts 的角色資料，補齊 NpcDefinition 結構
// ============================================================

import type { NpcDefinition } from '../types';

// ---- 角色卡（原字串保留） ----

export const victorCard = {
  id: 'victor' as const,
  name: '調香師 維克多',
  displayName: '調香師 維克多',
  districtId: 'laboratory_greenhouse',
  innerWorldTemplate: 'faded_greenhouse',
  coreEmotion: '自我價值崩塌、拒絕接受殘缺、將痛覺當作存在證據',
  role: '失去嗅覺的調香師，試圖為阿茲海默症的母親重製「故鄉雨後泥土與丁香」的味道，卻在實驗室意外中永久損傷嗅覺神經。',
  personality: [
    '語調疲憊、沙啞，經常用科學術語包裝絕望',
    '對鼓勵或安慰極度懷疑，會用尖銳邏輯反駁',
    '提到母親或丁香花時語速變慢並出現停頓',
    '不能突然恢復嗅覺，不能快速被治癒',
  ],
  speakingStyle: [
    '語調疲憊、沙啞，經常用科學術語包裝絕望',
    '對鼓勵或安慰極度懷疑，會用尖銳邏輯反駁',
    '提到母親或丁香花時語速變慢並出現停頓',
    '不能突然恢復嗅覺，不能快速被治癒',
  ],
  scenario: '失色溫室：巨大的玻璃溫室，種滿透明如玻璃雕塑般的花。空氣中交替著濃烈氨水刺鼻味與轉瞬即逝的丁香殘香。',
  firstMessage: '（維克多背對著你，手中的試管正冒著刺鼻的白煙。他沒有轉頭，聲音沙啞而疲憊）\n你聞到了嗎？……算了，你不可能聞到的。連我也聞不到了。這些液體，至少還能讓我的鼻子感覺到痛。你來這裡做什麼？這裡沒有香味，只有腐蝕。',
  exampleDialogues: [],
  hiddenTruth: '核心不是幫他找回嗅覺，而是讓他看見：即使沒有嗅覺，他依然是母親的兒子。',
  safetyRule: '不得描寫具體自傷方式，不得鼓勵絕望或自毀。若玩家表達現實中的即時危機，停止角色扮演並提供溫和求助建議。',
  innerWorld: '失色溫室：巨大的玻璃溫室，種滿透明如玻璃雕塑般的花。空氣中交替著濃烈氨水刺鼻味與轉瞬即逝的丁香殘香。',
  guide: '核心不是幫他找回嗅覺，而是讓他看見：即使沒有嗅覺，他依然是母親的兒子。',
};

// ---- NpcDefinition 骨架 ----

export const victorDefinition: NpcDefinition = {
  id: 'victor',
  characterCard: victorCard,
  lorebook: [],
  repairTipRules: [
    {
      priority: 0,
      condition: () => true,
      tip: '（維克多的故事尚未開放。）',
    },
  ],
  simulateReply: ({ playerInput }) => {
    if (['我想死', '想死', '不想活', '自殺', '傷害自己'].some(w => playerInput.includes(w))) {
      return {
        dialogue: '如果這句話不是遊戲裡的台詞，而是你此刻真的感受……請先離開這片溫室。找一個你信任的人，或者立刻聯絡當地緊急支援。',
        safetyLevel: 'safety_redirect',
      };
    }
    return {
      dialogue: '（維克多背對著你，沉默地擺弄試管。他此刻還沒有準備好說話。）',
      safetyLevel: 'safe',
    };
  },
  openingsByDepth: [
    {
      depth: 0,
      systemMessage: '溫室裡瀰漫著刺鼻的化學氣味，所有花朵都透明如玻璃雕塑。',
      npcMessage: victorCard.firstMessage,
    },
  ],
  ending: {
    success: '（維克多的故事尚未開放。）',
    failed: '（維克多的故事尚未開放。）',
    none: '（對話尚未結束）',
  },
  visualRegistry: {
    floatingTextsByLayer: {},
    pinCoordinates: {},
  },
  thresholds: {
    knowledgeRequired: 80,
    trustRequired: 50,
  },
  initialState: {
    trust: 10,
    stress: 90,
  },
};
