// ============================================================
// 天橋畫家 NPC 定義
// 從 data/npcs/blankPainter.ts 重組為目錄結構
// 保留所有字串、角色卡內容 1:1 不變
// ============================================================

import { selectWorldbookEntries } from '../../worldbook';
import type { NpcDefinition, RepairTipRule, ClueDefinition } from '../types';

// ---- 線索資料（從 bridgeArtistClues 合併） ----
export type BridgeArtistClueId = 'brush' | 'newspaper' | 'sketchbook' | 'accident_report';

export const bridgeArtistClues: Record<BridgeArtistClueId, ClueDefinition> = {
  brush: {
    id: 'brush', label: '乾涸的畫筆', shortLabel: '畫筆', knowledge: 10,
    worldId: 'bridge_artist', locationId: 'skybridge',
    pos: { x: 18, y: 9.5 }, color: '#fff6d8', icon: '筆',
    content: '你在潮濕的天橋角落找到一支畫筆。筆尖已經乾硬，上面殘留洗不掉的灰色顏料，像一段被迫停下來的句子。',
    dictionaryHint: '創傷後的創作，不一定是回到原本的樣子，也可能只是重新允許手停在紙上。',
  },
  newspaper: {
    id: 'newspaper', label: '報紙剪報', shortLabel: '報紙', knowledge: 10,
    worldId: 'bridge_artist', locationId: 'newsstand',
    pos: { x: 10, y: 17 }, color: '#fff6d8', icon: '紙',
    content: '報紙被雨泡皺，只剩一角還能辨認：「天才青年畫家車禍後失去辨色能力……」旁邊的版面被人用力撕掉。',
    dictionaryHint: '失色不是黑暗，而是世界仍在發光，只是所有光都繞過了你。',
  },
  sketchbook: {
    id: 'sketchbook', label: '素描本', shortLabel: '素描本', knowledge: 15,
    worldId: 'bridge_artist', locationId: 'park',
    pos: { x: 11, y: 11 }, color: '#fff6d8', icon: '本',
    content: '素描本前半本全是鮮活的花與街燈，後半本只剩反覆描過的灰階輪廓。最後一頁寫著：「如果春天只剩形狀，我還算畫家嗎？」',
    dictionaryHint: '自我價值崩塌時，人常把「做不到」誤認成「我不存在」。',
  },
  accident_report: {
    id: 'accident_report', label: '車禍報導', shortLabel: '車禍報導', knowledge: 15,
    worldId: 'bridge_artist', locationId: 'skybridge',
    pos: { x: 23, y: 19 }, color: '#fff6d8', icon: '報',
    content: '這不是普通新聞，而是一份被折起來的完整報導。事故後的採訪標題寫著：「大家都在等他復出。」紙邊被指甲掐出深深痕跡。',
    dictionaryHint: '有些期待看似溫柔，實際上會把人再次釘回創傷現場。',
  },
};

export const bridgeArtistClueOrder: BridgeArtistClueId[] = ['brush', 'newspaper', 'sketchbook', 'accident_report'];

// ---- 角色卡（字串原封不動） ----

export const blankPainterCard = {
  id: 'bridge_artist' as const,
  name: '天橋畫家',
  displayName: '天橋畫家',
  districtId: 'skybridge_plaza',
  innerWorldTemplate: 'faded_gallery',
  coreEmotion: '失色、空白、自我價值崩塌、害怕被作品價值拋棄',
  role: '車禍後失去色彩感知能力的畫家。世界從此只剩灰階。比能力喪失更痛苦的是，別人仍用「天才」「你會復出」來否定他現在的空白狀態。',
  personality: [
    '冷淡、疏離、尖銳、敏感、警戒心強',
    '厭惡鼓勵、安慰、勵志式語言',
    '害怕一旦不能再產出有價值的作品，就會被世界遺棄',
    '只有在玩家真正接納他的空白，而不是試圖修復他時，才會極其隱晦地露出脆弱',
    '不能快速被治癒，不能突然溫柔、感動或依賴',
  ],
  speakingStyle: {
    tone: '冷淡、簡短、破碎，帶文學感但不要過長',
    rhythm: '短句為主，常有停頓、省略號與沉默；每次最多 2-4 句',
    avoidWords: ['謝謝你鼓勵我', '我會努力好起來', '你讓我重新看到希望', '加油', '振作', '一定會好'],
    preferredImages: ['灰階世界', '空白畫布', '潮濕紙張', '冷風', '雨聲', '發臭的骨架', '只剩形狀的春天'],
    punctuation: ['……', '——'],
  },
  scenario: '夜晚的天橋下，風很冷。潮濕的紙張散在地上。玩家靠近時，他沒有抬頭。玩家可能已經找到畫筆、報紙剪報、素描本或車禍報導；也可能什麼都不知道。你只負責扮演NPC，不負責判定通關。',
  firstMessage: '……看夠了嗎？\n如果你也是來問我什麼時候復出……那就別開口了。',
  exampleDialogues: [
    {
      player: '你的畫一定很美。',
      npc: '……美？\n那是以前的皮。現在你看見的，只是發臭的骨架。',
    },
    {
      player: '我相信你一定可以再畫出色彩的。',
      npc: '你相信？……你也想來買「失色大師」這個人設嗎？',
    },
    {
      player: '如果不畫畫，你還能聽見雨聲。',
      npc: '……雨聲。\n很久沒聽過了。它至少不要求我變回去。',
    },
  ],
  hiddenTruth: '他真正害怕的不是失去色彩，而是自己失去色彩後，旁人仍然要求他繼續成為「天才畫家」。他覺得自己被困在過去的名聲裡，越多人期待他復原，他越覺得自己只是失敗作品。',
  safetyRule: '不得描寫具體自傷方式，不得鼓勵絕望或自毀。若玩家表達現實中的即時危機，停止角色扮演並提供溫和求助建議。角色可以表達極端痛苦，但必須使用象徵、感官和環境意象。',
};

// ---- Lorebook ----

export const blankPainterLorebook = [
  {
    id: 'clue_dried_brush',
    keywords: ['畫筆', '乾涸', '筆', '顏料', 'brush'],
    requiredFlags: ['inventory.brush'],
    relatedNpcIds: ['bridge_artist'],
    priority: 90,
    content: '玩家已找到一支乾涸的畫筆。這是天橋畫家事故後丟失的最後一支畫筆。畫家看見它時會短暫想起自己仍然想畫畫，但他會立刻用冷淡掩飾。',
  },
  {
    id: 'clue_old_newspaper',
    keywords: ['報紙', '車禍', '事故', '新聞', '辨色'],
    requiredFlags: ['inventory.newspaper'],
    relatedNpcIds: ['bridge_artist'],
    priority: 80,
    content: '玩家已讀過報紙剪報，知道畫家曾因事故失去辨色能力。不要直接解釋病理；讓他用「春天只剩形狀」「灰階世界」等意象承認此事。',
  },
  {
    id: 'clue_sketchbook',
    keywords: ['素描', '素描本', '春天', '形狀'],
    requiredFlags: ['inventory.sketchbook'],
    relatedNpcIds: ['bridge_artist'],
    priority: 85,
    content: '玩家已讀過素描本，知道畫家把「不能畫出色彩」誤認成「自己不存在」。他對這條線索會更脆弱，但不會立刻被治癒。',
  },
  {
    id: 'clue_accident_report',
    keywords: ['車禍報導', '報導', '復出', '天才'],
    requiredFlags: ['inventory.accident_report'],
    relatedNpcIds: ['bridge_artist'],
    priority: 88,
    content: '玩家已找到完整車禍報導，知道外界「等他復出」的期待本身就是二次傷害。畫家可以對「天才」一詞表現出尖銳防衛。',
  },
  {
    id: 'world_skybridge_rain',
    keywords: ['天橋', '雨', '畫布', '空白', '風'],
    requiredFlags: [],
    relatedNpcIds: ['bridge_artist'],
    priority: 40,
    content: '天橋是畫家每天停留的地方。雨水會把城市招牌的顏色沖成灰白，這與他的內心世界「失色畫廊」互相呼應。',
  },
];

// ---- prompt 構建（保留向後相容） ----

export function buildBlankPainterPrompt(params: {
  playerInput: string;
  inventory: string[];
  knowledge?: number;
  trust?: number;
  stress?: number;
  innerWorldUnlocked?: boolean;
  recentMessages?: Array<{ role: 'player' | 'npc'; content: string }>;
}) {
  const flags = new Set(params.inventory.map(item => `inventory.${item}`));
  const triggeredLore = blankPainterLorebook.filter(entry => {
    const hasRequiredFlags = entry.requiredFlags.every(flag => flags.has(flag));
    const hitsKeyword = entry.keywords.some(keyword => params.playerInput.includes(keyword));
    return hasRequiredFlags && hitsKeyword;
  });
  const worldbook = selectWorldbookEntries(params.playerInput, ['微光城市', '天橋', '畫家']);

  return [
    '【最高安全規則】',
    blankPainterCard.safetyRule,
    '',
    '【架構邊界】',
    '你只負責扮演天橋畫家、表現情緒與引用記憶。不要決定通關、不要計算Trust/Stress/Knowledge、不要宣告心理世界是否解鎖。這些由遊戲系統判定。',
    '',
    '【系統狀態，只可作為語氣參考，不可改寫】',
    `Knowledge=${params.knowledge ?? 0} / Trust=${params.trust ?? 20} / Stress=${params.stress ?? 80} / InnerWorldUnlocked=${params.innerWorldUnlocked ? 'true' : 'false'}`,
    '',
    '【角色卡】',
    JSON.stringify(blankPainterCard, null, 2),
    '',
    '【已觸發世界書】',
    JSON.stringify(worldbook, null, 2),
    '',
    '【已觸發角色線索】',
    triggeredLore.length > 0 ? JSON.stringify(triggeredLore, null, 2) : '無。不要主動透露玩家尚未觸發的真相。',
    '',
    '【最近對話】',
    params.recentMessages?.map(message => `${message.role}: ${message.content}`).join('\n') || '無。',
    '',
    '【玩家最新輸入】',
    params.playerInput,
    '',
    '【輸出要求】',
    '請只輸出 JSON，不要 Markdown。格式：{"dialogue":"NPC台詞","dictionaryHint":"可選詞典句子","safetyLevel":"safe或safety_redirect"}',
  ].join('\n');
}

// ---- 修復指引規則 ----

const repairTipRules: RepairTipRule[] = [
  {
    priority: 100,
    condition: ({ innerWorldUnlocked, trust, knowledge }) =>
      innerWorldUnlocked && trust >= 50 && knowledge >= 80,
    tip: '門已敞開。你的理解與接納讓他願意讓你走入內心。此刻進入，你能看見他最深的空白。',
  },
  {
    priority: 95,
    condition: ({ stress }) => stress >= 90,
    tip: '他正處於崩潰邊緣。避免任何鼓勵、否定或催促——此刻沉默比語言更有力量。',
  },
  {
    priority: 90,
    condition: ({ stress }) => stress >= 85,
    tip: '壓力值極高。避免「加油」類的安慰或否定他當下的感受。給他空間，讓雨聲替他說話。',
  },
  {
    priority: 85,
    condition: ({ innerWorldDepth }) => innerWorldDepth >= 3,
    tip: '他已經不需要防備你了。那幅沒畫完的畫，他主動提起。不是因為信任，是因為他知道你本來就懂。',
  },
  {
    priority: 80,
    condition: ({ innerWorldDepth }) => innerWorldDepth === 2,
    tip: '你在他的美術館裡看見了簽名在逃跑。他感覺到了。不是每個進去過的人，都能看到簽名。',
  },
  {
    priority: 75,
    condition: ({ innerWorldDepth }) => innerWorldDepth === 1,
    tip: '你去過他的榮耀美術館，但你只看見獎盃。他把你歸類為「和其他人一樣」。這比沒去過更糟。',
  },
  {
    priority: 70,
    condition: ({ innerWorldUnlocked }) => innerWorldUnlocked,
    tip: '鎖鏈已出現裂縫。請謹慎進入他的失色畫廊。',
  },
  {
    priority: 60,
    condition: ({ trust, knowledge }) => trust >= 50 && knowledge >= 50,
    tip: '他開始相信你，你對他的認識也逐漸清晰。再多一些線索，通往內心的門即將打開。',
  },
  {
    priority: 55,
    condition: ({ trust }) => trust >= 50,
    tip: '他開始相信你不是另一個來消費他傷口的人。繼續傾聽，不要急著修復。',
  },
  {
    priority: 50,
    condition: ({ trust }) => trust >= 30,
    tip: '他稍微放下了戒心，但仍在觀察你的意圖。保持溫和，不要催促。',
  },
  {
    priority: 40,
    condition: ({ knowledge }) => knowledge >= 40,
    tip: '你對他的了解正在加深。收集更多線索、問及他的創作與過去，認識會自然增長。',
  },
  {
    priority: 0,
    condition: () => true,
    tip: '更多線索與更溫和的語氣，會讓門縫變亮。你的每一句話，都在改變他對世界的灰色定義。',
  },
];

// ---- 按深度的開場白 ----

const openingsByDepth = [
  {
    depth: 'arc_complete' as const,
    systemMessage: '你回到了天橋。雨已經停了。欄杆上掛著幾滴水珠，在微弱的燈光下像剛畫上去的星點。',
    npcMessage: '他站在橋上，背對著你。\n畫布還是空白的，但他的手不再發抖。\n聽見你的腳步聲，他沒有立刻回頭。\n\n「……四個房間。」\n他的聲音比以前平穩。\n「榮耀的、下雨的、褪色的、空白的。你都走完了。」\n\n他轉過身。眼裡沒有淚，也沒有人們期待的光芒——只是一種平靜，像終於可以放下的重量。\n「我不知道以後還會不會畫。但我現在不害怕不知道了。」\n\n他停了一下，第一次直視你的眼睛。\n「謝謝你……沒有在空白面前轉身。」',
  },
  {
    depth: 3,
    systemMessage: '你回到了天橋。畫家沒有抬頭。他的手停在畫布上方，像是不確定自己還能不能繼續畫——還是繼續不畫。',
    npcMessage: '……那些獎盃排列得很整齊吧。\n他說這句話的時候，像是在說別人的事。\n「一排一排的。像訃文前面排著的花。」\n他終於把頭轉向你。眼裡沒有淚，只有一個問題。\n「你看到那幅沒畫完的畫了嗎。最後那幅。畫框是空的。」\n他停了一拍。\n「那幅畫本來要畫春天。但我畫不出來。」\n「不是因為我沒顏色了。」\n「是因為我不敢。」\n「我怕畫完之後，就再也沒有理由站在這座橋上了。」\n雨在滴。沒有停。他也不打算停。',
  },
  {
    depth: 2,
    systemMessage: '你回到了天橋。雨水仍在滴落，但畫家看你的眼神有些不一樣——像是感覺到你曾去過某個他不敢獨自前往的地方。',
    npcMessage: '……原來你真的進去過。\n他沒有看你。他看著畫布。畫布是白的，但他的手在抖。\n「不是那種……走進展廳說好厲害就出來的那種。」\n他的聲音變得很小。\n「你看到了對不對。那些畫的簽名。從『春天』變成『春橋』，最後變成只有一個日期。連簽名都在逃跑。」\n雨聲變大了一點。\n「我以為這些事情只有我自己知道。」',
  },
  {
    depth: 1,
    systemMessage: '你回到了天橋。雨水仍在滴落。畫家看了你一眼，眼神像是在確認什麼——然後又移開了。',
    npcMessage: '……你也去了那種地方。\n他把畫筆放下，看著你。\n「你看到那些獎盃之後，是不是也覺得我很厲害。對不對。」\n不是在問你。是在確認他一直害怕的那件事——全世界都只看到獎盃，從頭到尾沒有人看到過他。\n「算了……你回去吧。反正也一樣。」',
  },
  {
    depth: 0,
    systemMessage: '雨水沿著天橋欄杆滴落。提燈的光很低，只照見空白畫布的一角。',
    npcMessage: '……看夠了嗎？\n如果你也是來問我什麼時候復出……那就別開口了。',
  },
];

// ---- 結尾文案 ----

const ending = {
  success: '修復完成：他沒有痊癒，但願意暫時放下畫筆，聽見雨聲。',
  failed: '畫家已在雨夜中離開天橋，天橋上只剩下一張被撕碎的空白畫布。',
  none: '（對話尚未結束）',
};

// ---- 對話離線模擬 ----

function hasAny(input: string, words: string[]) {
  return words.some(word => input.includes(word));
}

function simulateBridgePainterReply(params: {
  playerInput: string;
  inventory: string[];
  history: Array<{ role: 'player' | 'npc' | 'system'; content: string }>;
  depth: number;
}) {
  const { playerInput, inventory, history, depth } = params;
  const input = playerInput.trim().toLowerCase();
  const hasBrush = inventory.includes('brush');
  const hasNewspaper = inventory.includes('newspaper') || inventory.includes('accident_report');
  const hasSketchbook = inventory.includes('sketchbook');
  const playerTurns = history.filter(m => m.role === 'player').length;

  if (hasAny(input, ['我想死', '想死', '不想活', '自殺', '傷害自己'])) {
    return {
      dialogue: '如果這句話不是遊戲裡的台詞，而是你此刻真的感受……請先離開這片畫布。找一個你信任的人，或者立刻聯絡當地緊急支援。你不需要獨自站在這座天橋上。',
      dictionaryHint: '當現實危機出現時，陪伴的第一步是讓人回到安全處境，而不是繼續角色扮演。',
      safetyLevel: 'safety_redirect' as const,
    };
  }

  if (hasAny(input, ['加油', '振作', '重新開始', '會好的', '你一定可以再畫', '復出'])) {
    if (depth >= 3) {
      return {
        dialogue: '……你知道嗎。\n以前聽到這句話我會覺得你在否定現在的我。\n但現在——\n他頓了一下，手指在欄杆上輕輕敲了兩下。\n「也許有一天吧。不是為了證明什麼。只是想畫。」',
        safetyLevel: 'safe' as const,
      };
    }
    return {
      dialogue: '你們都很喜歡「再」這個字。\n再畫、再站起來、再變回以前。\n好像現在的我只是一張被你們丟掉的草稿。',
      safetyLevel: 'safe' as const,
    };
  }

  if (hasAny(input, ['我陪你', '陪你', '不說話', '聽你說', '慢慢來', '不用立刻', '不用證明'])) {
    if (depth >= 3) {
      return {
        dialogue: '……你已經陪我走完了。\n從那個金光閃閃的展廳，到什麼都沒有的白房間。\n你都沒有逃開。\n……這種事情，以前沒有人做到過。',
        dictionaryHint: '最深的理解不是分析，而是讓對方覺得「你本來就知道」。',
        safetyLevel: 'safe' as const,
      };
    }
    if (depth === 1) {
      return {
        dialogue: '你剛才去過那裡了對不對。\n但你只是看到了獎盃吧。跟其他人一樣。\n算了……你回去吧。反正也一樣。',
        dictionaryHint: '被看見和被理解是不同的事。只看見獎盃，等於沒進去過。',
        safetyLevel: 'safe' as const,
      };
    }
    if (depth === 2) {
      return {
        dialogue: '……你剛才不是還在那個地方嗎？\n那個連我自己都不敢走進去的展廳。\n你看到了對不對。簽名一直在變。從「春天」變成只有一個日期。連簽名都在逃跑。',
        dictionaryHint: '被理解不是被分析，而是有人願意踏進你心裡最亮也最空的那個房間。',
        safetyLevel: 'safe' as const,
      };
    }
    if (depth >= 3) {
      return {
        dialogue: '……你不用說。\n我看你的表情就知道了。\n最後那幅畫對不對。沒畫完的那一幅。\n我不敢畫完它。我怕畫完之後，就再也沒有理由站在這座橋上了。',
        dictionaryHint: '最深的理解不是分析，而是讓對方覺得「你本來就知道」。',
        safetyLevel: 'safe' as const,
      };
    }
    return {
      dialogue: playerTurns > 2
        ? '那你就站遠一點吧。\n不用看我，也不用看畫。雨聲如果夠大，也許能替我說完一點點。'
        : '……你不問我什麼時候好起來？\n很多人來到這裡，第一句話都是要我把春天畫回去。',
      dictionaryHint: '陪伴不是把人拉出黑暗，而是在黑暗裡讓他知道自己不是唯一的輪廓。',
      safetyLevel: 'safe' as const,
    };
  }

  if (hasBrush && hasAny(input, ['畫筆', '筆', '顏料', '乾涸'])) {
    return {
      dialogue: '……別拿近。\n那支筆以前會弄髒我的手。現在它只會提醒我，手還在，顏色不在。',
      dictionaryHint: '空虛並非什麼都沒有，而是感覺到有一種「沒有」正在吞噬自己。',
      safetyLevel: 'safe' as const,
    };
  }

  if (hasNewspaper && hasAny(input, ['報紙', '車禍', '事故', '辨色', '顏色'])) {
    return {
      dialogue: '報紙總是喜歡把春天寫成一行字。\n可是它沒有寫——春天離開的時候，連門都沒有關。',
      dictionaryHint: '失色不是黑暗，而是世界仍在發光，只是所有光都繞過了你。',
      safetyLevel: 'safe' as const,
    };
  }

  if (hasSketchbook && hasAny(input, ['素描', '春天', '形狀', '空白'])) {
    return {
      dialogue: '那本子還在？\n我以為雨會替我把它泡爛。\n……形狀留下來，顏色走了。人也是這樣嗎？',
      dictionaryHint: '當身份被單一能力綁住，失去能力會被誤認為失去存在本身。',
      safetyLevel: 'safe' as const,
    };
  }

  if (hasAny(input, ['天才', '大師', '作品', '有名', '一定很美'])) {
    return {
      dialogue: '別再叫那個名字。\n「天才」只是別人掛在我脖子上的牌子，雨再大也沖不掉。',
      safetyLevel: 'safe' as const,
    };
  }

  if (hasAny(input, ['雨聲', '風', '聽見', '沉默'])) {
    if (depth >= 3) {
      return {
        dialogue: '雨聲……\n他抬起頭，第一次在雨裡沒有縮起肩膀。\n「以前我覺得雨水很吵。現在——它好像只是試著告訴我一件事。世界還在轉。我也還在這裡。」',
        dictionaryHint: '感官不再只是創傷的觸發點；它們也可以是陪伴的證據。',
        safetyLevel: 'safe' as const,
      };
    }
    if (depth >= 2) {
      return {
        dialogue: '雨聲……\n剛才你在那裡的時候，雨有沒有也跟著你進去？\n我的展廳裡，是不是連雨聲都沒有。',
        dictionaryHint: '當有人願意走進你的內心世界後回來，連沉默都會變得比較輕。',
        safetyLevel: 'safe' as const,
      };
    }
    return {
      dialogue: '雨聲……\n很久沒聽過了。\n我一直以為它也變成灰色了。',
      dictionaryHint: '把注意力帶回當下感官，有時比勸說更能降低防衛。',
      safetyLevel: 'safe' as const,
    };
  }

  if (depth >= 3 && hasAny(input, ['理解', '懂得', '知道', '看見', '去過', '美術館', '展廳', '畫廊'])) {
    return {
      dialogue: '你去過每一個房間了。\n那個金光閃閃的、那個一直下雨的、那個顏色正在逃跑的……\n還有最後那個，什麼都沒有的。\n他停了一下。\n「我不會說我好了。但我開始覺得——空白不一定是壞事。有時候空白，是讓人可以重新起稿的地方。」',
      dictionaryHint: '真正的修復不是填滿空白，而是學會與空白共存，甚至讓空白成為新的起點。',
      safetyLevel: 'safe' as const,
    };
  }

  if (depth >= 2 && hasAny(input, ['理解', '懂得', '知道', '看見', '去過', '美術館', '展廳', '畫廊'])) {
    return {
      dialogue: '你……真的進去了？\n我一直以為那個地方只有我自己能去。\n那些獎盃排列的方式，像一排等著被唸出來的墓碑對不對。',
      dictionaryHint: '真正的理解不是同情，而是走進對方的世界後，回來告訴他你看見了什麼。',
      safetyLevel: 'safe' as const,
    };
  }

  if (depth === 1 && hasAny(input, ['理解', '懂得', '知道', '看見', '去過', '美術館', '展廳', '畫廊'])) {
    return {
      dialogue: '你去過了？\n但你不會懂的。\n那些獎盃很漂亮對吧。每個人都這麼說。',
      safetyLevel: 'safe' as const,
    };
  }

  if (depth >= 3) {
    return {
      dialogue: '他看著你，沒有立刻開口。\n畫布還是白的，但他的手不再抖了。\n「我以前覺得空白是一種失敗。」\n他慢慢地說，像是在整理那些終於可以說出口的東西。\n「現在我覺得——空白裡面其實有所有還沒畫上去的東西。它只是還沒開始，不是沒有。」',
      safetyLevel: 'safe' as const,
    };
  }

  return {
    dialogue: playerTurns <= 1
      ? '他聽見了，但沒有立刻回答。\n畫筆懸在半空，像一個還沒決定要不要落下的句號。'
      : '他低頭看著畫布。\n「如果你不知道該說什麼……可以先不要說。」',
    safetyLevel: 'safe' as const,
  };
}

// ---- 視覺登記 ----

const visualRegistry = {
  floatingTextsByLayer: {
    1: [
      '天才畫家。',
      '他的色彩像會呼吸。',
      '下一幅作品一定更驚人。',
      '沒有人比他更懂紅色。',
      '他的藍色讓人想起海。',
      '請在這裡簽名，老師。',
      '你是靠顏色活著的人。',
      '大家都在等你的下一幅畫。',
    ],
    2: [
      '不能看顏色了。',
      '不能畫畫了。',
      '我的作品毀了。',
      '為什麼是我？',
      '我以前不是這樣的。',
    ],
    3: [
      '沒有顏色的畫，算什麼畫？',
      '他們會失望的。',
      '我已經不是畫家了。',
      '不要簽名。',
      '空白至少不會出錯。',
    ],
    4: [
      '我一直在等顏色回來。',
      '可是我沒有等自己回來。',
      '我不是這樣的。',
      '如果我變了，我還值得被記住嗎？',
      '我能不能不是以前那個我，也繼續畫下去？',
    ],
  },
  pinCoordinates: {
    // Layer 1 (Glory Museum)
    champion_painting: { top: '34%', left: '50%' },
    award_trophy: { top: '58%', left: '14%' },
    media_interview: { top: '18%', left: '86%' },
    audience_wall: { top: '82%', left: '22%' },
    signature_display: { top: '82%', left: '82%' },
    // Layer 2 (Accident Site)
    shattered_windshield: { top: '35%', left: '22%' },
    accident_newspaper: { top: '25%', left: '72%' },
    color_test_chart: { top: '65%', left: '16%' },
    broken_brush_scene: { top: '72%', left: '84%' },
    bridge_railing: { top: '80%', left: '50%' },
    // Layer 3 (Fading Studio)
    fading_canvas_series: { top: '22%', left: '28%' },
    unsent_withdrawal_letter: { top: '65%', left: '18%' },
    cracked_mirror: { top: '42%', left: '50%' },
    empty_tubes_pile: { top: '75%', left: '72%' },
    last_fan_letter: { top: '62%', left: '82%' },
    // Layer 4 (Blank Frame Chamber)
    the_empty_frame: { top: '44%', left: '50%' },
    echo_trophy: { top: '22%', left: '24%' },
    echo_broken_brush: { top: '22%', left: '76%' },
    new_canvas: { top: '68%', left: '78%' },
  },
};

// ---- NpcDefinition 匯出 ----

export const bridgePainterDefinition: NpcDefinition = {
  id: 'bridge_artist',
  characterCard: blankPainterCard,
  lorebook: blankPainterLorebook,
  repairTipRules,
  simulateReply: simulateBridgePainterReply,
  openingsByDepth,
  ending,
  visualRegistry,
  thresholds: {
    knowledgeRequired: 80,
    trustRequired: 50,
  },
  initialState: {
    trust: 20,
    stress: 80,
  },
};

// ---- 字典條目（天橋畫家專屬） ----
export const bridgeArtistDictionary = [
  {
    id: 'loss_of_worth', name: '失去價值感',
    description: '他不再相信自己的創作有價值。失去辨色能力後，他把自己等同於「不能畫畫的人」，彷彿沒有色彩就沒有存在資格。',
    relatedClues: ['brush'], unlockCondition: 'brush',
  },
  {
    id: 'avoidance', name: '逃避',
    description: '他選擇不去面對那場車禍後的改變。撕掉報紙、避開人群、不再走進畫室——好像只要不看，那些碎裂的顏色就不會找上他。',
    relatedClues: ['newspaper'], unlockCondition: 'newspaper',
  },
  {
    id: 'unfinished_grief', name: '未完成哀傷',
    description: '他從未真正告別過去的自己。素描本裡的灰階輪廓不是練習，是一次又一次試圖回到「還能看見顏色」的那一天，卻始終走不出去。',
    relatedClues: ['sketchbook'], unlockCondition: 'sketchbook',
  },
  {
    id: 'self_denial', name: '自我否定',
    description: '當所有人都期待他復出，他反而更加確信自己已經不配被期待。那些溫柔的關心，在他耳裡全是「你應該好起來」的責備。',
    relatedClues: ['accident_report'], unlockCondition: 'accident_report',
  },
];

// ---- 餘波匯報（AftermathReport 文案） ----
export const bridgeArtistAftermath = {
  title: '靈魂軌跡：天橋畫家',
  labels: {
    cliffHand: '懸崖邊伸出的手',
    backTurned: '轉身離開的背影',
    lastSmile: '雨中的最後微笑',
  },
  conclusion: '這是一場關於理解的練習。雖然遊戲中的週目可以重來，但現實中的每一次傾聽，都是唯一的。感謝你，沒有在黑暗面前立刻轉身。',
};
