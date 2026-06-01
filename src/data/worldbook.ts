export type WorldbookEntry = {
  id: number;
  keys: string[];
  content: string;
  comment: string;
  constant: boolean;
  enabled: boolean;
  priority: number;
};

export const worldbookEntries: WorldbookEntry[] = [
  {
    id: 1,
    keys: ['微光城市', '城市', '這裡', '背景', '氣氛', '場景', '灰濛濛', '陰雨', '壓抑', '潮濕', '街道', '街燈'],
    content: '這是一座永遠在「褪色」的城市。天空是帶著雜訊的灰藍，建築物邊角被雨水侵蝕出黑色淚痕，街道永遠濕漉漉的。空氣中彌漫雨水、鐵鏽與淡淡煤氣味。聲音主要是滴答雨聲、遠方捷運沉悶轟鳴、窗戶吱呀聲，偶爾傳來殘缺的音樂。這座城市的「靜」不是安寧，是所有人都憋著一口氣的壓抑。風黏膩如冰冷的手拂過臉頰。',
    comment: '微光城市全域背景',
    constant: false,
    enabled: true,
    priority: 50,
  },
  {
    id: 2,
    keys: ['酒館', '潛意識酒館', '避雨', '休息', '老闆', '吧台'],
    content: '位於城市心臟地帶的地下空間，入口藏在廢棄書報攤後面。木頭招牌被雨水泡得發脹。內部暖黃燈光是這座城市唯一不被稀釋的色彩，空氣中飄著劣質酒精與舊書頁的味道。老闆是個眼袋很深、疲憊但溫柔的年輕人，他擦拭著玻璃杯，似乎認識每一個走進來的靈魂。這裡是探索前後的中繼站，可以詢問線索或尋求安慰。',
    comment: '潛意識酒館',
    constant: false,
    enabled: true,
    priority: 100,
  },
  {
    id: 3,
    keys: ['探索', '線索', '記憶錨點', '誤導', '雨水指引', '尋找', '物品', '道具', '搜尋', '調查', '發現', '撿起'],
    content: '城市真相不會攤在陽光下。記憶錨點是遺落的物品或痕跡，散發微光，是通往裏世界的鑰匙。核心線索永遠伴隨「情感殘留」的溫度或光澤。許多看似有線索的雜物實為誤導，是城市噪音的一部分。你可以刻意「聆聽雨聲」：若雨聲變慢、粘稠甚至倒流，代表附近有未安息的情緒殘渣。隨著開導成功，城市會出現新的光之小徑；失敗太多，道路會出現裂痕，某些區域被灰黑霧氣永久封鎖，失敗NPC的幻影會在雨中重複死前動作。',
    comment: '探索規則與機制',
    constant: false,
    enabled: true,
    priority: 90,
  },
  {
    id: 4,
    keys: ['天橋', '畫家', '過街天橋', '天橋下', '欄杆', '橋下', '過街', '畫布'],
    content: '城市北區的廢棄人行天橋，鏽蝕鋼筋外露。原本是光影交會處，如今只剩潮濕的風。橋下車流聲如遙遠海浪，欄杆掛滿被雨水浸透的展覽海報。天橋畫家通常縮在最暗的角落，腳邊散落空白畫布。這裡的空氣帶著鐵鏽與濕顏料的氣味。',
    comment: '天橋 - 對應天橋畫家',
    constant: false,
    enabled: true,
    priority: 80,
  },
  {
    id: 7,
    keys: ['實驗室', '溫室', '維克多', '調香', '化學', '丁香', '試管', '氣味', '嗅覺', '燒瓶', '藥劑'],
    content: '一棟改造過的舊工廠，一半是充滿試管與燒瓶的冰冷實驗室，另一半是種滿枯萎植物的玻璃溫室。空氣中交替刺鼻氨水味與丁香殘香，溫度忽冷忽熱。透明花朵在風中不會搖曳，只發出玻璃碰撞的清脆聲響。',
    comment: '化學實驗室與溫室 - 對應調香師維克多',
    constant: false,
    enabled: true,
    priority: 80,
  },
  {
    id: 10,
    keys: ['情緒詞典', '詞典', '記錄', '筆記', '日誌', '小卡', '公益'],
    content: '隨身攜帶的舊書，書頁原本空白。隨著見證 NPC 的故事，會自動浮現文字。每條記錄包含：情緒名稱、感官描述、NPC 最後告白、玩家註記、公益小卡。詞典可用來「共感」：面對新 NPC 時翻閱可獲得新對話選項。每解鎖五個詞條，詞典會給予簡短評語。',
    comment: '情緒詞典系統',
    constant: false,
    enabled: true,
    priority: 90,
  },
  {
    id: 11,
    keys: ['失敗', '幽靈', '替代性創傷', '創傷', '殘影', '幻聽', '累積', '黑影', '雜訊', '褪色', '模糊', '裂痕'],
    content: '當有 NPC 永遠離去時觸發。下次探索時，背景會閃過失敗 NPC 的殘影，雨聲夾雜其遺言，拾取道具時手指短暫無力。累積後城市更暗，色彩飽和度降低，修復師的傾聽能力暫時失靈（文字模糊）。終局需進入修復師自己的裏世界，與失敗的影子對話，學習放下遺憾，與無力感和解。',
    comment: '失敗的幽靈 / 替代性創傷',
    constant: false,
    enabled: true,
    priority: 85,
  },
  {
    id: 12,
    keys: [],
    content: '【世界邊界規則 - 反幻想與常識保留】\n\n微光城市是一個封閉的架空世界，但它的居民偶爾會接收到來自「另一個世界」的微弱回音。他們可能聽過一些名字、一些模糊的概念，但對這些事物的認知永遠是朦朧的、片面的、不準確的。\n\n角色絕對禁止假裝自己去過現實世界的具體地點、詳細描述現實世界人物品牌科技、補充微光城市中不存在的地點人物或經歷。當被問及設定中沒有的事物時，只能困惑、模糊印象，或直接說「我不知道」。',
    comment: '世界邊界規則 - 常駐激活，防止角色幻想',
    constant: true,
    enabled: true,
    priority: 120,
  },
];

export function selectWorldbookEntries(text: string, extraKeys: string[] = []) {
  const source = `${text} ${extraKeys.join(' ')}`.toLowerCase();

  return worldbookEntries
    .filter(entry => entry.enabled)
    .filter(entry => entry.constant || entry.keys.some(key => source.includes(key.toLowerCase())))
    .sort((a, b) => b.priority - a.priority);
}
