// ============================================================
// 天橋畫家心理世界 - 第一層：榮耀美術館
// Vertical Slice：僅實作第一層完整可玩流程
// ============================================================

// ---- 類型定義 ----

/** 心理世界層級標識 */
export type PsychLayerId = "glory_gallery" | "accident_site" | "fading_maze" | "blank_frame_chamber";

/** 玩家反思選項 */
export interface ReflectionChoice {
  /** 選項文字 */
  text: string;
  /** 是否通向真正理解 */
  insight: boolean;
}

/** 心理世界單層資料 */
export interface PsychLayerData {
  layerId: PsychLayerId;
  layerName: string;
  /** 這層對應的心理主題（一句話象徵） */
  symbol: string;
  /** 氛圍描述 */
  atmosphere: string;
  /** 場景描述文字 */
  sceneDescription: string;
  /** 本層完成後玩家的理解收穫（一句話） */
  playerUnderstanding: string;
  /** 可互動物件清單 */
  interactables: GalleryInteractable[];
  /** 進入下一層需要的理解度門檻（0 表示本層是最後一層） */
  nextLayerThreshold: number;
}

/** 第一層榮耀美術館可互動物件 */
export interface GalleryInteractable {
  /** 互動物件 ID */
  id: string;
  /** 顯示名稱 */
  name: string;
  /** 分類標籤 */
  category: string;
  /** 在 3×3 網格中的行 */
  row: number;
  /** 在 3×3 網格中的列 */
  col: number;
  /** 玩家第一眼看到的表面資訊 */
  surfaceInfo: string;
  /** 觀察後揭露的深層心理訊息 */
  deepMessage: string;
  /** 玩家選擇正確觀察後獲得的理解片段 */
  insight: string;
  /** 玩家反思選項 */
  reflectionChoices: ReflectionChoice[];
  /** 理解度獎勵數值 */
  understandingReward: number;
  /** 是否已被發現 */
  discovered?: boolean;
}

/** 理解度獎勵 */
export interface UnderstandingReward {
  interactableId: string;
  amount: number;
  reason: string;
}

// ---- 榮耀美術館互動物件 ----

/** 3×3 網格位置表（row, col）：
 *
 *   (0,0) (0,1) (0,2)
 *   (1,0) (1,1) (1,2)
 *   (2,0) (2,1) (2,2)
 */

const galleryInteractables: GalleryInteractable[] = [
  // ---- 1. 冠軍畫作 ----
  {
    id: "champion_painting",
    name: "冠軍畫作",
    category: "achievement",
    row: 0,
    col: 0,
    surfaceInfo: "巨幅金獎油畫，描繪陽光燦爛的花園。色彩飽滿、構圖精準，每一筆都無懈可擊。",
    deepMessage:
      "但湊近一看——那些花的筆觸是機械化的，花園的排列像閱兵典禮一樣整齊。\n\n"
      + "這幅畫是被「設計出來」的，不是「畫出來」的。",
    insight: "他的完美是被獎項訓練出來的，不是發自內心的表達。",
    reflectionChoices: [
      { text: "這是一幅完美的傑作", insight: false },
      { text: "這幅畫完美得不像出自真心", insight: true },
    ],
    understandingReward: 8,
  },

  // ---- 2. 獲獎獎盃 ----
  {
    id: "award_trophy",
    name: "獲獎獎盃",
    category: "achievement",
    row: 0,
    col: 2,
    surfaceInfo:
      "玻璃櫃中依年份排列著一排金色獎盃，從最早的到最近的，每一座都閃閃發亮。",
    deepMessage:
      "你注意到獎盃底座刻的不是「乾枯」——而是他早期的筆名。\n"
      + "越近期的獎盃，刻字越深，筆劃越用力，像在害怕名字會消失在金屬表面。",
    insight: "他把存在價值刻在了獎盃上——名字越深，越怕消失。",
    reflectionChoices: [
      { text: "這些獎盃證明了他的才華", insight: false },
      { text: "他的名字刻得越來越深，像在害怕消失", insight: true },
    ],
    understandingReward: 7,
  },

  // ---- 3. 媒體專訪牆 ----
  {
    id: "media_interview",
    name: "媒體專訪牆",
    category: "public_perception",
    row: 1,
    col: 0,
    surfaceInfo:
      "貼滿剪報的牆面，標題寫著「天才畫家」「藝術界新星」「不容錯過的傳奇」。"
      + "每篇專訪都附著他的照片——微笑，領獎，微笑，領獎。",
    deepMessage:
      "但你一篇一篇讀完後發現——\n"
      + "所有記者的問題都一樣：你的靈感從哪來？你的下一個目標是什麼？你覺得自己成功嗎？\n"
      + "從來沒有人問過：「你累嗎？」「你想畫什麼？」",
    insight: "外界只看見標籤。沒有人在乎他想畫什麼。",
    reflectionChoices: [
      { text: "他真的很厲害", insight: false },
      { text: "沒有人在乎他想畫什麼", insight: true },
    ],
    understandingReward: 10,
  },

  // ---- 4. 觀眾留言牆 ----
  {
    id: "audience_wall",
    name: "觀眾留言牆",
    category: "public_perception",
    row: 1,
    col: 2,
    surfaceInfo: "整面牆貼滿觀眾的便利貼，色彩繽紛，每一張上面都是讚美。",
    deepMessage:
      "「你的畫救了我」「你是我最喜歡的畫家」「謝謝你帶給世界美」——\n"
      + "但你一張一張翻過去，發現所有留言都只說「他給了世界什麼」。\n"
      + "沒有人寫過：「希望你也快樂。」",
    insight: "被所有人讚美，不等於被任何人理解。",
    reflectionChoices: [
      { text: "大家都喜歡他的畫", insight: false },
      { text: "被所有人讚美，不等於被任何人理解", insight: true },
    ],
    understandingReward: 8,
  },

  // ---- 5. 簽名展示區 ----
  {
    id: "signature_display",
    name: "簽名展示區",
    category: "identity",
    row: 2,
    col: 1,
    surfaceInfo: "長長的展示桌上，陳列著他歷年來的親筆簽名，從最早到最近，一字排開。",
    deepMessage:
      "早期的簽名輕快流暢，筆尾帶著飛揚的弧線。\n"
      + "後期的簽名筆壓沉重，幾乎要戳破紙面。\n"
      + "而且——每個簽名後面都習慣性地點上一個小小的句號。\n"
      + "像在確認：我還是我。",
    insight: "他的簽名從輕快變成沉重——他在用簽名證明自己還存在。",
    reflectionChoices: [
      { text: "這是名人的簽名", insight: false },
      { text: "從輕快到沉重，他在用簽名證明自己還存在", insight: true },
    ],
    understandingReward: 7,
  },
];

// ---- 第一層資料 ----

export const gloryGalleryLayer: PsychLayerData = {
  layerId: "glory_gallery",
  layerName: "榮耀美術館",
  symbol: "身份認同／成就／執著",
  atmosphere: "金色光芒、回音空蕩、展示櫃冰冷",
  sceneDescription:
    "你踏入一座鋪滿金色燈光的美術館大廳。\n"
    + "牆上掛滿輝煌的作品，玻璃櫃裡陳列著閃閃發光的獎盃。\n"
    + "但不對勁——這裡太安靜了，沒有觀眾，沒有掌聲。\n"
    + "所有的榮耀都像被保鮮膜包著，只是展示品。",
  playerUnderstanding: "他曾經非常成功——但成功本身，正在成為他的牢籠。",
  interactables: galleryInteractables,
  nextLayerThreshold: 0, // 第一層完成後即可返回表世界（Vertical Slice）
};

// ---- 理解度系統 ----

/**
 * 第一層榮耀美術館的理解度上限
 */
export const MAX_LAYER1_UNDERSTANDING = 40;

/**
 * 根據互動物件 ID 取得理解度獎勵（含反思正確才給）
 */
export function getUnderstandingReward(
  interactableId: string,
  choseInsight: boolean
): UnderstandingReward | null {
  if (!choseInsight) return null;

  const obj = galleryInteractables.find((o) => o.id === interactableId);
  if (!obj) return null;

  return {
    interactableId: obj.id,
    amount: obj.understandingReward,
    reason: obj.insight,
  };
}

/**
 * 取得互動物件
 */
export function getInteractable(id: string): GalleryInteractable | undefined {
  return galleryInteractables.find((o) => o.id === id);
}

/**
 * 取得所有互動物件
 */
export function getAllInteractables(): GalleryInteractable[] {
  return [...galleryInteractables];
}
