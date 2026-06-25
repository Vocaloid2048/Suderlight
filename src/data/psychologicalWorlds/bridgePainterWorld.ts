// ============================================================
// 天橋畫家心理世界 - 完整四層情感弧線
// Success → Trauma → Identity Collapse → Acceptance
// ============================================================

// ---- 類型定義 ----

/** 心理世界層級標識 */
export type PsychLayerId = "glory_gallery" | "accident_site" | "fading_maze" | "blank_frame_chamber";

/** 心理世界層級編號 */
export type PsychLayerNumber = 1 | 2 | 3 | 4;

/** 層級視覺色調 */
export type LayerColorScheme = 'gold' | 'cold' | 'faded' | 'void';

/** 玩家反思選項 */
export interface ReflectionChoice {
  text: string;
  insight: boolean;
}

/** 心理世界通用可互動物件 */
export interface PsychInteractable {
  id: string;
  name: string;
  category: string;
  /** 在當前層的網格位置（row, col） */
  row: number;
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
}

/** 心理世界單層資料 */
export interface PsychLayerData {
  layerId: PsychLayerId;
  layerNumber: PsychLayerNumber;
  layerName: string;
  /** 這層對應的心理主題 */
  symbol: string;
  /** 氛圍描述 */
  atmosphere: string;
  /** 場景描述文字 */
  sceneDescription: string;
  /** 進入本層時的情緒引言 */
  emotionalForeword: string;
  /** 本層完成後玩家的理解收穫 */
  playerUnderstanding: string;
  /** 可互動物件清單 */
  interactables: PsychInteractable[];
  /** 進入下一層需要的理解度門檻 */
  nextLayerThreshold: number;
  /** 視覺色調 */
  colorScheme: LayerColorScheme;
  /** 本層最大可獲得理解度 */
  maxUnderstanding: number;
}

// ---- 向後相容：保留 GalleryInteractable ----
export interface GalleryInteractable extends PsychInteractable {}

/** 理解度獎勵 */
export interface UnderstandingReward {
  interactableId: string;
  amount: number;
  reason: string;
  layerId: PsychLayerId;
}

// ============================================================
// Layer 1: 榮耀美術館 — Success
// 情感主題：身份認同／成就／成功表象
// ============================================================

const layer1Interactables: PsychInteractable[] = [
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

// ============================================================
// Layer 2: 事故現場 — Trauma
// 情感主題：創傷／失去／破碎的轉折點
// ============================================================

const layer2Interactables: PsychInteractable[] = [
  {
    id: "shattered_windshield",
    name: "碎裂的車窗",
    category: "accident",
    row: 0,
    col: 0,
    surfaceInfo:
      "一扇佈滿蛛網狀裂痕的車窗，懸浮在黑暗的雨幕中。雨水沿著裂縫滲入，像永遠擦不乾的眼淚。",
    deepMessage:
      "你透過裂縫看出去——世界是扭曲的，色塊被切割成幾何碎片。\n"
      + "這就是他眼裡的世界，從那一刻開始。\n"
      + "車窗的另一面，隱約能看見一隻手，保持著作畫的姿勢。",
    insight: "撞擊的瞬間，他失去的不只是視力，而是看見世界的方式。",
    reflectionChoices: [
      { text: "這只是一場車禍", insight: false },
      { text: "他失去的是看見色彩的能力", insight: true },
    ],
    understandingReward: 9,
  },
  {
    id: "accident_newspaper",
    name: "事故報導剪報",
    category: "accident",
    row: 0,
    col: 1,
    surfaceInfo:
      "一張被雨水浸透的報紙，標題寫著「本地知名畫家遭遇嚴重車禍」。日期是四年前。",
    deepMessage:
      "你讀完內文——肇事者逃逸，他昏迷了三天。\n"
      + "醫生診斷：外傷性腦損傷導致後天性色覺障礙。\n"
      + "用他能理解的說法：從此這個世界，只剩深淺不一的灰。",
    insight: "車禍奪走了他的色彩——畫家失去顏色，等於失去語言。",
    reflectionChoices: [
      { text: "至少他還活著", insight: false },
      { text: "對一個畫家來說，失去顏色等於失去一切", insight: true },
    ],
    understandingReward: 8,
  },
  {
    id: "color_test_chart",
    name: "色覺檢查圖",
    category: "accident",
    row: 1,
    col: 0,
    surfaceInfo:
      "牆上掛著一幅石原色覺檢查圖——就是那種由彩色圓點組成的數字辨識圖。但這張圖裡的數字，他看不見。",
    deepMessage:
      "圖的旁邊貼著一張手寫紙條，字跡顫抖：\n"
      + "「醫生說我還能看到形狀。但形狀有什麼用？\n"
      + "  形狀只是骨架，顏色才是靈魂。\n"
      + "  我畫了一輩子的靈魂，現在我什麼都看不見了。」",
    insight: "他還能看見形狀——但對他而言，沒有顏色的畫，跟沒有靈魂的軀體一樣。",
    reflectionChoices: [
      { text: "至少還能看見形狀", insight: false },
      { text: "沒有顏色的世界，對他來說失去了意義", insight: true },
    ],
    understandingReward: 10,
  },
  {
    id: "broken_brush_scene",
    name: "摔斷的畫筆",
    category: "emotion",
    row: 1,
    col: 2,
    surfaceInfo:
      "水泥地上躺著一支折成兩半的畫筆。筆桿的斷口參差不齊，像是被用力摔斷的。筆尖的顏料早已乾涸。",
    deepMessage:
      "你撿起斷裂的兩半，試著把它們拼在一起。\n"
      + "斷口對不齊——不是摔斷的，是折斷的，反覆折了許多次。\n"
      + "這不是意外。這是憤怒。這是絕望。\n"
      + "是在無數個夜晚，對著自己最熟悉的手，喊著『為什麼』。",
    insight: "他不是平靜地接受失去——他憤怒過，絕望過，然後才變得安靜。",
    reflectionChoices: [
      { text: "只是一支壞掉的筆", insight: false },
      { text: "這支筆不是意外斷的——是他自己折斷的", insight: true },
    ],
    understandingReward: 9,
  },
  {
    id: "bridge_railing",
    name: "天橋欄杆",
    category: "location",
    row: 2,
    col: 1,
    surfaceInfo:
      "一段冰冷的天橋欄杆，鐵鏽斑駁。它看起來很普通——但你知道，這是他現在每天站著的地方。",
    deepMessage:
      "欄杆上刻著一行小字，幾乎被鐵鏽覆蓋：\n"
      + "「事故地點——天橋下方。」\n"
      + "原來他每天回來這個地方畫畫，不是偶然。\n"
      + "他每天站在自己世界崩塌的地方，試著畫出某種東西。\n"
      + "任何東西。",
    insight: "他選擇在事故地點畫畫——這不是巧合，是他在試著面對。",
    reflectionChoices: [
      { text: "這只是普通的欄杆", insight: false },
      { text: "他每天都在自己世界崩塌的地方畫畫", insight: true },
    ],
    understandingReward: 8,
  },
];

// ============================================================
// Layer 3: 褪色畫室 — Identity Collapse
// 情感主題：身分崩解／虛無／失去意義
// ============================================================

const layer3Interactables: PsychInteractable[] = [
  {
    id: "fading_canvas_series",
    name: "褪色的畫布序列",
    category: "identity",
    row: 0,
    col: 0,
    surfaceInfo:
      "五幅畫布一字排開，從左到右——第一幅鮮豔飽滿，最後一幅幾乎全白。像一條從彩色走向虛無的時間軸。",
    deepMessage:
      "第二幅：色彩依然豐富，但構圖開始不對稱。\n"
      + "第三幅：顏色明顯黯淡，筆觸變得猶豫。\n"
      + "第四幅：只剩灰階，隱約能看出形狀在顫抖。\n"
      + "第五幅：幾乎空白——只在角落有半個簽名，最後一筆拖得很長，沒有句號。",
    insight: "他不是突然放棄繪畫的——是顏色一天一天從他手中流失。",
    reflectionChoices: [
      { text: "很美的系列作品", insight: false },
      { text: "顏色是一點一點消失的——像生命被慢慢抽乾", insight: true },
    ],
    understandingReward: 10,
  },
  {
    id: "unsent_withdrawal_letter",
    name: "未寄出的退展信",
    category: "identity",
    row: 0,
    col: 2,
    surfaceInfo:
      "抽屜裡塞著一疊信，全是寫給畫廊的退展通知。每一封都沒有貼郵票，沒有寄出。",
    deepMessage:
      "信的內容從「因健康因素無法繼續參展」,\n"
      + "變成「我不再具備創作的資格」,\n"
      + "最後變成「請忘記我曾經存在」。\n"
      + "每一封都寫完了，但每一封都留在抽屜裡。\n"
      + "他不是不知道怎麼結束——他是不敢。",
    insight: "他寫了很多次告別信，但從來不敢真的寄出去——因為告別等於承認自己不再是畫家。",
    reflectionChoices: [
      { text: "退出畫廊是明智的決定", insight: false },
      { text: "他一直想告別，但不敢——因為那等於殺死自己的身分", insight: true },
    ],
    understandingReward: 9,
  },
  {
    id: "cracked_mirror",
    name: "碎裂的鏡子",
    category: "self",
    row: 1,
    col: 1,
    surfaceInfo:
      "一面落地鏡，從中央裂開成三片。每一片都倒映著你——但每一片的角度都不同，看起來像是三個不同的人。",
    deepMessage:
      "你仔細觀察裂縫。不是撞擊造成的——裂痕從鏡框的四個角落同時向中心延伸。\n"
      + "像是被從內部撐開的。\n"
      + "鏡子下面寫著一句話：\n"
      + "「我不知道鏡子裡的人是誰。他不是畫家。那他是什麼？」",
    insight: "他看著鏡子，認不出自己——因為『畫家』這個身分碎裂後，他不知道自己還能是誰。",
    reflectionChoices: [
      { text: "鏡子不小心打破了", insight: false },
      { text: "不是鏡子破了——是他的自我認同碎了", insight: true },
    ],
    understandingReward: 10,
  },
  {
    id: "empty_tubes_pile",
    name: "空顏料管堆",
    category: "loss",
    row: 2,
    col: 0,
    surfaceInfo:
      "角落裡堆著一座小山般的顏料管——全被擠空了，鋁管扭曲變形。粗略估計有上百支。",
    deepMessage:
      "你拿起一支——標籤上寫著「鉻黃」，但管子裡的顏料是灰色的。\n"
      + "再拿起一支「鈷藍」——也是灰色。\n"
      + "每一支都是灰色。\n"
      + "他不是沒有顏料。他是失去了看見顏色的能力後，\n"
      + "反覆試圖擠出他記憶中的顏色——但每一次，都只是更多的灰。",
    insight: "他反覆嘗試畫出記憶中的色彩——但每一次都只得到灰色。他不是放棄了，他是被耗盡了。",
    reflectionChoices: [
      { text: "這只是用完的顏料", insight: false },
      { text: "他一次次試圖找回顏色，直到被耗盡", insight: true },
    ],
    understandingReward: 8,
  },
  {
    id: "last_fan_letter",
    name: "最後一封粉絲信",
    category: "loss",
    row: 2,
    col: 2,
    surfaceInfo:
      "一封沒有打開的信，信封已經泛黃。寄件日期是兩年前。寄件人是一個十四歲的女孩。",
    deepMessage:
      "你猶豫了一下，還是打開了。\n"
      + "「親愛的大畫家：我媽媽說，等你畫出新的畫，\n"
      + "  我們就可以再來看你的展覽。她生病的時候，\n"
      + "  你的畫是她在醫院裡唯一覺得漂亮的東西。\n"
      + "  所以她說，你一定會再畫的，對不對？」\n"
      + "信紙背面，是鉛筆畫的一朵小花。\n"
      + "這封信他從來沒打開過——因為他害怕看見任何期待。",
    insight: "他承受的不只是自己的失落——還有那些期待他回來的人的目光。",
    reflectionChoices: [
      { text: "粉絲應該理解他的處境", insight: false },
      { text: "他害怕的不只是自己，還有那些等他回來的人", insight: true },
    ],
    understandingReward: 9,
  },
];

// ============================================================
// Layer 4: 空白畫框 — Acceptance
// 情感主題：接納／存在本身即是價值／「空白也可以」
// ============================================================

const layer4Interactables: PsychInteractable[] = [
  {
    id: "the_empty_frame",
    name: "空白畫框",
    category: "acceptance",
    row: 1,
    col: 1,
    surfaceInfo:
      "一個精緻的木質畫框，裡面沒有畫布，沒有顏料，什麼都沒有。它就這樣靜靜地懸浮在白色虛空中——完美的空白。",
    deepMessage:
      "框裡沒有畫。但你看著它，發現它本身就是一件作品。\n"
      + "木頭的紋理、框角微微磨損的痕跡、光影在邊緣流動——\n"
      + "這不是缺少畫的框，這是框本身的完成。\n"
      + "你突然明白：不是所有的空白都需要被填滿。\n"
      + "有些空間，存在的意義就是保持空白。",
    insight: "空白不是缺陷。畫框的存在本身，就已是完整。",
    reflectionChoices: [
      { text: "這需要一幅畫", insight: false },
      { text: "空白也是一種完成。不是所有的空白都需要被填滿", insight: true },
    ],
    understandingReward: 12,
  },
  {
    id: "echo_trophy",
    name: "回聲：獎盃",
    category: "echo",
    row: 0,
    col: 0,
    surfaceInfo:
      "第一層中的獎盃在這裡變成了一個半透明的投影，在虛空中微弱地發光。刻字幾乎看不見了。",
    deepMessage:
      "你伸手觸碰——投影散成光點，只留下一句話在空中迴盪：\n"
      + "「我不再需要用名字證明自己存在。」\n"
      + "這是他最後的選擇。",
    insight: "曾經刻進金屬的名字，最終可以選擇輕盈地消失。",
    reflectionChoices: [
      { text: "獎盃還是很重要的", insight: false },
      { text: "他終於不再需要用名字證明自己存在", insight: true },
    ],
    understandingReward: 8,
  },
  {
    id: "echo_broken_brush",
    name: "回聲：斷裂的畫筆",
    category: "echo",
    row: 0,
    col: 2,
    surfaceInfo:
      "第二層中那支折斷的畫筆，現在安靜地躺在地上——但斷口處發著微光，像被某種東西修復了。",
    deepMessage:
      "筆還是斷的。兩半之間的空隙沒有被填補。\n"
      + "但那道光來自筆本身——不是被修復了，而是被接納了。\n"
      + "裂痕不是缺陷，是這支筆經歷過的一切。",
    insight: "傷痕不需要被抹去——它們可以被接納，然後成為完整的一部分。",
    reflectionChoices: [
      { text: "斷掉的筆沒有用了", insight: false },
      { text: "傷痕不需要被修復——它們可以被接納", insight: true },
    ],
    understandingReward: 7,
  },
  {
    id: "new_canvas",
    name: "新的空白畫布",
    category: "acceptance",
    row: 2,
    col: 1,
    surfaceInfo:
      "一張全新的畫布，立在白色虛空中。它也是空白的——但和畫框的空不同。這張畫布是等待，不是空缺。",
    deepMessage:
      "畫布旁邊放著一支嶄新的畫筆，筆尖沒有顏料。\n"
      + "旁邊浮著一句話，筆跡很輕、很平靜：\n"
      + "「我不確定我還會不會畫。\n"
      + "  但我確定——即使我不畫，我也還是值得存在的。\n"
      + "  畫不畫，和我值不值得，是兩件事。」",
    insight: "存在的價值不需要用創作來證明。不畫畫也可以——存在本身就足夠。",
    reflectionChoices: [
      { text: "希望他有一天能再提筆", insight: false },
      { text: "不畫也無所謂——他不需要用創作來證明自己的價值", insight: true },
    ],
    understandingReward: 10,
  },
];

// ============================================================
// 層級資料
// ============================================================

export const gloryGalleryLayer: PsychLayerData = {
  layerId: "glory_gallery",
  layerNumber: 1,
  layerName: "榮耀美術館",
  symbol: "身份認同／成就／成功表象",
  atmosphere: "金色光芒、回音空蕩、展示櫃冰冷",
  sceneDescription:
    "這裡展示了畫家的作品，以及他本人。\n"
    + "這裡有他過去獲獎的畫作，與他當初獲獎時的榮耀。\n"
    + "金色的燈光照亮了曾經的輝煌，但一切都安靜得有些詭異。",
  emotionalForeword: "所有的成功，都是從某處開始的。但成功本身，也可以是牢籠。",
  playerUnderstanding: "他曾經非常成功——但成功本身，正在成為他的牢籠。",
  interactables: layer1Interactables,
  nextLayerThreshold: 30,
  colorScheme: "gold",
  maxUnderstanding: 40,
};

export const accidentSceneLayer: PsychLayerData = {
  layerId: "accident_site",
  layerNumber: 2,
  layerName: "事故現場",
  symbol: "創傷／失去／世界崩壞的瞬間",
  atmosphere: "冷藍雨夜、玻璃碎片、鐵鏽與潮濕",
  sceneDescription:
    "冷藍的雨夜，這是他的世界崩塌的瞬間。\n"
    + "原本對任何色彩都極其靈敏的他，在劇烈的撞擊後，眼前的色彩被粗暴地抹去，只留下了冰冷而單調的灰階。",
  emotionalForeword: "每一道傷痕，都是一次世界的重構。這裡，是他的世界崩塌的地方。",
  playerUnderstanding: "他的色彩不是慢慢褪去的——是一瞬間被剝奪的。而那之後，一切都不一樣了。",
  interactables: layer2Interactables,
  nextLayerThreshold: 32,
  colorScheme: "cold",
  maxUnderstanding: 44,
};

export const fadedStudioLayer: PsychLayerData = {
  layerId: "fading_maze",
  layerNumber: 3,
  layerName: "褪色畫室",
  symbol: "身分崩解／虛無／自我認同的消融",
  atmosphere: "灰塵懸浮、褪色畫布、碎裂的倒影",
  sceneDescription:
    "車禍醫治過後出院，他回到畫室。\n"
    + "他在畫架上放了一張乾淨的白色畫紙，靜靜地坐在前面，畫布上是一片空白。\n"
    + "這裡不再有創作。這裡只有失去創作能力之後，留下來的死寂與空洞。",
  emotionalForeword: "當一個人不能再做自己認定的「自己」，剩下來的，還能是誰？",
  playerUnderstanding: "失去創作能力之後，他失去的是一整個自我——畫家死了，留下來的人不知道該怎麼活。",
  interactables: layer3Interactables,
  nextLayerThreshold: 32,
  colorScheme: "faded",
  maxUnderstanding: 46,
};

export const blankFrameLayer: PsychLayerData = {
  layerId: "blank_frame_chamber",
  layerNumber: 4,
  layerName: "空白畫框",
  symbol: "接納／存在本身即是完成／釋放",
  atmosphere: "純白虛空、寂靜、輕盈的迴聲",
  sceneDescription:
    "一個巨大的空白畫框懸浮在純白虛空中，畫家坐在它的面前。\n"
    + "他開始提筆作畫了，但眼前的畫布只有沉悶的灰色。\n"
    + "但在短暫的瞬間，灰色畫布會變回有顏色的蔚藍，向世人展示他內心深處的渴望。",
  emotionalForeword: "最後一層不是結局，而是釋放。不是所有的故事都需要一個句號。",
  playerUnderstanding: "他意識到自己的存在不需要被任何東西定義——不畫畫也可以，只是活著就足夠。",
  interactables: layer4Interactables,
  nextLayerThreshold: 0, // 最後一層，完成後結束
  colorScheme: "void",
  maxUnderstanding: 37,
};

// ---- 所有層級列表（按順序） ----

export const ALL_PSYCH_LAYERS: PsychLayerData[] = [
  gloryGalleryLayer,
  accidentSceneLayer,
  fadedStudioLayer,
  blankFrameLayer,
];

/**
 * 根據層級編號取得層級資料
 */
export function getPsychLayer(layerNumber: number): PsychLayerData | undefined {
  return ALL_PSYCH_LAYERS.find(l => l.layerNumber === layerNumber);
}

// ============================================================
// 理解度系統（多層級）
// ============================================================

/**
 * 根據互動物件 ID 取得理解度獎勵
 */
export function getUnderstandingReward(
  interactableId: string,
  choseInsight: boolean,
  layerNumber?: number,
): UnderstandingReward | null {
  if (!choseInsight) return null;

  const layers = layerNumber
    ? ALL_PSYCH_LAYERS.filter(l => l.layerNumber === layerNumber)
    : ALL_PSYCH_LAYERS;

  for (const layer of layers) {
    const obj = layer.interactables.find((o) => o.id === interactableId);
    if (obj) {
      return {
        interactableId: obj.id,
        amount: obj.understandingReward,
        reason: obj.insight,
        layerId: layer.layerId,
      };
    }
  }

  return null;
}

/**
 * 取得互動物件（於任意層級）
 */
export function getInteractable(id: string): PsychInteractable | undefined {
  for (const layer of ALL_PSYCH_LAYERS) {
    const obj = layer.interactables.find((o) => o.id === id);
    if (obj) return obj;
  }
  return undefined;
}

/**
 * 取得指定層級的所有互動物件
 */
export function getLayerInteractables(layerNumber: number): PsychInteractable[] {
  const layer = getPsychLayer(layerNumber);
  return layer ? [...layer.interactables] : [];
}
