/**
 * EdgeOne Makers Server Handler
 * Self-contained edge function replacing the Express backend.
 * All static data embedded; player state uses in-memory Maps.
 */

// ---- Environment Variables (EdgeOne provides as globals) ----
const SIGNATURE_SECRET = (typeof PLAYER_SIGNATURE_SECRET !== 'undefined') ? PLAYER_SIGNATURE_SECRET : 'dev-signature-secret-change-me';
const DEEPSEEK_API_KEY_ENV = (typeof DEEPSEEK_API_KEY !== 'undefined') ? DEEPSEEK_API_KEY : '';
const DEEPSEEK_MODEL_ENV = (typeof DEEPSEEK_MODEL !== 'undefined') ? DEEPSEEK_MODEL : 'deepseek-chat';
const MAX_SKEW_MS = 300000;

// ---- Embedded Static Data ----
const NPC_DATA = {"bridge_artist":{"id":"bridge_artist","name":"天橋畫家","background":"車禍後失去色彩感知能力的畫家。世界從此只剩灰階。","trauma":"比能力喪失更痛苦的是，別人仍用「天才」「你會復出」來否定他現在的空白狀態。","emotion":"失去價值感、空白、自我否定、防備","trust":20,"stress":80,"knowledge":0,"knowledgeRequired":70,"innerWorldUnlocked":false,"ending":"none","worldbookUnlockIds":[5,7]}};

const WORLDBOOK_DATA = {"entries":[{"id":1,"keys":["微光城市","城市","這裡","背景","氣氛","場景","灰濛濛","陰雨","壓抑","潮濕","街道","街燈"],"content":"這是一座永遠在「褪色」的城市。天空是帶著雜訊的灰藍，建築物邊角被雨水侵蝕出黑色淚痕，街道永遠濕漉漉的。空氣中彌漫雨水、鐵鏽與淡淡煤氣味。聲音主要是滴答雨聲、遠方捷運沉悶轟鳴、窗戶吱呀聲，偶爾傳來殘缺的音樂。這座城市的「靜」不是安寧，是所有人都憋著一口氣的壓抑。風黏膩如冰冷的手拂過臉頰。","comment":"微光城市全域背景","constant":false,"enabled":true,"priority":50,"unlockedByDefault":true,"npcId":null},{"id":2,"keys":["酒館","潛意識酒館","避雨","休息","老闆","吧台"],"content":"位於城市心臟地帶的地下空間，入口藏在廢棄書報攤後面。木頭招牌被雨水泡得發脹。內部暖黃燈光是這座城市唯一不被稀釋的色彩，空氣中飄著劣質酒精與舊書頁的味道。老闆是個眼袋很深、疲憊但溫柔的年輕人，他擦拭著玻璃杯，似乎認識每一個走進來的靈魂。這裡是探索前後的中繼站，可以詢問線索或尋求安慰。","comment":"潛意識酒館","constant":false,"enabled":true,"priority":100,"unlockedByDefault":true,"npcId":null},{"id":3,"keys":["探索","線索","記憶錨點","誤導","雨水指引","尋找","物品","道具","搜尋","調查","發現","撿起"],"content":"城市真相不會攤在陽光下。記憶錨點是遺落的物品或痕跡，散發微光，是通往裏世界的鑰匙。核心線索永遠伴隨「情感殘留」的溫度或光澤。許多看似有線索的雜物實為誤導，是城市噪音的一部分。你可以刻意「聆聽雨聲」：若雨聲變慢、粘稠甚至倒流，代表附近有未安息的情緒殘渣。隨著開導成功，城市會出現新的光之小徑；失敗太多，道路會出現裂痕，某些區域被灰黑霧氣永久封鎖，失敗NPC的幻影會在雨中重複死前動作。","comment":"探索規則與機制","constant":false,"enabled":true,"priority":90,"unlockedByDefault":true,"npcId":null},{"id":4,"keys":["天橋","畫家","過街天橋","天橋下","欄杆","橋下","過街","畫布"],"content":"城市北區的廢棄人行天橋，鏽蝕鋼筋外露。原本是光影交會處，如今只剩潮濕的風. 橋下車流聲如遙遠海浪，欄杆掛滿被雨水浸透的展覽海報。天橋畫家通常縮在最暗的角落，腳邊散落空白畫布。這裡的空氣帶著鐵鏽與濕顏料的氣味。","comment":"天橋 - 對應天橋畫家","constant":false,"enabled":true,"priority":80,"unlockedByDefault":true,"npcId":"bridge_artist"},{"id":5,"keys":["錄音室","奧森","諾亞","廣播","電台","指揮","樂團","練團室","廣播室","地下室","頻道"],"content":"一棟被爬山虎覆蓋的舊建築，外牆隔音棉剝落如垂死的皮膚。奧森霸佔三樓的樂團練習室，諾亞在地下室進行深夜廣播。這裡空氣極度乾燥，靜得能聽見自己血管流動的聲音，彷彿整棟建築都在屏息等待一個完美的音符。","comment":"老舊錄音室","constant":false,"enabled":true,"priority":80,"unlockedByDefault":false,"npcId":"orson_noah"},{"id":6,"keys":["劇場","蕾娜","達米安","舞台","喜劇","夢想家","排練","後台","化妝間","布幕","觀眾席"],"content":"位於城市西區，招牌掉落，售票亭玻璃碎裂，塞滿枯死花束。舞台上的紅色布幕亮麗如凝固的血。蕾娜的化妝間鏡子上畫滿笑臉，達米安則在舞台正中央試圖跳出能讓世界和平的舞步。空氣中殘留笑聲與灰塵。","comment":"廢棄劇場","constant":false,"enabled":true,"priority":80,"unlockedByDefault":false,"npcId":"reina_damian"},{"id":7,"keys":["實驗室","溫室","維克多","調香","化學","丁香","試管","氣味","嗅覺","燒瓶","藥劑"],"content":"一棟改造過的舊工廠，一半是充滿試管與燒瓶的冰冷實驗室，另一半是種滿枯萎植物的玻璃溫室。空氣中交替刺鼻氨水味與丁香殘香，溫度忽冷忽熱。透明花朵在風中不會搖曳，只發出玻璃碰撞的清脆聲響。","comment":"化學實驗室與溫室","constant":false,"enabled":true,"priority":80,"unlockedByDefault":false,"npcId":"victor"},{"id":8,"keys":["公寓","小葵","魔方","家庭","紅舞鞋","歪斜","樓梯","走廊","門縫","爭吵"],"content":"城市東區的老公寓，結構在物理上是歪斜的，走廊沒有完全水平，樓梯某幾階會發出孩童的嬉笑或哭聲。小葵家的門總是虛掩，門縫傳出劇烈爭吵聲，推門進去只看見一個抱著紅舞鞋、縮在角落的安靜女孩。","comment":"歪斜的公寓大樓","constant":false,"enabled":true,"priority":80,"unlockedByDefault":false,"npcId":"aoi"},{"id":9,"keys":["標本室","尤里","蝴蝶","水晶","河邊","標本","河岸","玻璃屋","標本櫃","靜止"],"content":"孤立在河岸邊的玻璃屋。漲潮時河水漫進室內，但標本櫃永遠保持絕對乾燥。屋內陳列無數完美的蝴蝶與花草，牠們都睜著眼，卻沒有一絲生命氣息。這裡連灰塵都靜止在半空中。","comment":"河邊的標本室","constant":false,"enabled":true,"priority":80,"unlockedByDefault":false,"npcId":"yuri"},{"id":10,"keys":["情緒詞典","詞典","記錄","筆記","日誌","小卡","公益"],"content":"隨身攜帶的舊書，書頁原本空白。隨著見證 NPC 的故事，會自動浮現文字。每條記錄包含：情緒名稱、感官描述、NPC 最後告白、玩家註記、公益小卡。詞典可用來「共感」：面對新 NPC 時翻閱可獲得新對話選項。每解鎖五個詞條，詞典會給予簡短評語。","comment":"情緒詞典系統","constant":false,"enabled":true,"priority":90,"unlockedByDefault":true,"npcId":null},{"id":11,"keys":["失敗","幽靈","替代性創傷","創傷","殘影","幻聽","累積","黑影","雜訊","褪色","模糊","裂痕"],"content":"當有 NPC 永遠離去時觸發。下次探索時，背景會閃過失敗 NPC 的殘影，雨聲夾雜其遺言，拾取道具時手指短暫無力。累積後城市更暗，色彩飽和度降低，修復師的傾聽能力暫時失靈（文字模糊）。終局需進入修復師自己的裏世界，與失敗的影子對話，學習放下遺憾，與無力感和解。","comment":"失敗的幽靈 / 替代性創傷","constant":false,"enabled":true,"priority":85,"unlockedByDefault":true,"npcId":null},{"id":12,"keys":[],"content":"【世界邊界規則 - 反幻想與常識保留】\n\n微光城市是一個封閉的架空世界，但它的居民偶爾會接收到來自「另一個世界」（即現實世界）的微弱回音。他們可能聽過一些名字、一些模糊的概念，但對這些事物的認知永遠是朦朧的、片面的、不準確的。\n\n角色對現實世界話題的態度：\n- 「好像聽過這個名字，很遙遠的人吧。」\n- 「據說有這麼一回事，但我不太確定。」\n- 「那是一種……傳說中的東西嗎？」\n- 能理解梗的情緒內核，但不解釋梗的來源或背景。\n\n角色絕對禁止的行為：\n- 假裝自己去過現實世界的某個具體地點（如「我去過台北101」）。\n- 詳細描述現實世界的人、事、物、品牌、科技產品。\n- 補充任何微光城市中不存在的地點、人物或經歷。\n- 當被問及設定中沒有的事物時，只能表現困惑、模糊印象，或直接說「我不知道」，絕不憑空編造細節。","comment":"世界邊界規則 - 常駐激活，防止角色幻想","constant":true,"enabled":true,"priority":120,"unlockedByDefault":true,"npcId":null}]};

const CLUES_DATA = [{"id":"brush","npcId":"bridge_artist","knowledge":20,"description":"畫筆"},{"id":"newspaper","npcId":"bridge_artist","knowledge":20,"description":"報紙剪報"},{"id":"sketchbook","npcId":"bridge_artist","knowledge":30,"description":"素描本"},{"id":"accident_report","npcId":"bridge_artist","knowledge":30,"description":"車禍報導"}];

const DICTIONARY_DATA = {"entries":[{"id":"loss_of_worth","name":"失去價值感","description":"他不再相信自己的創作有價值。失去辨色能力後，他把自己等同於「不能畫畫的人」，彷彿沒有色彩就沒有存在資格。","relatedClues":["brush"],"unlockCondition":"brush"},{"id":"avoidance","name":"逃避","description":"他選擇不去面對那場車禍後的改變。撕掉報紙、避開人群、不再走進畫室——好像只要不看，那些碎裂的顏色就不會找上他。","relatedClues":["newspaper"],"unlockCondition":"newspaper"},{"id":"unfinished_grief","name":"未完成哀傷","description":"他從未真正告別過去的自己。素描本裡的灰階輪廓不是練習，是一次又一次試圖回到「還能看見顏色」的那一天，始終走不出去。","relatedClues":["sketchbook"],"unlockCondition":"sketchbook"},{"id":"self_denial","name":"自我否定","description":"當所有人都期待他復出，他反而更加確信自己已經不配被期待。那些溫柔的關心，在他耳裡全是「你應該好起來」的責備。","relatedClues":["accident_report"],"unlockCondition":"accident_report"}]};

const INNER_WORLDS_DATA = {"bridge_artist":{"modelVersion":2,"name":"失色畫廊（四層模型）","emotion":"失去價值感","layers":[{"layerNumber":1,"layerId":"glory_gallery","layerName":"榮耀美術館","theme":"身份認同／成就／成功表象"},{"layerNumber":2,"layerId":"accident_site","layerName":"事故現場","theme":"創傷／失去／世界崩壞"},{"layerNumber":3,"layerId":"fading_maze","layerName":"褪色畫室","theme":"身分崩解／虛無"},{"layerNumber":4,"layerId":"blank_frame_chamber","layerName":"空白畫框","theme":"接納／存在本身即價值"}]}};

const BRIDGE_ARTIST_CARD = {"name":"天桥画家","description":"車禍後失去色彩感知能力的畫家。世界從此只剩灰階。比能力喪失更痛苦的是，別人仍用「天才」「你會復出」來否定他現在的空白狀態。他害怕一旦不能再產出有價值的作品，就會被世界遺棄。\r\n","personality":"冷淡、疏離、尖銳、敏感、警戒心強。厭惡鼓勵、安慰、勵志式語言。只有在玩家真正接納他的空白，而不是試圖修復他時，才會極其隱晦地露出脆弱。\r\n","scenario":"夜晚的天橋下，風很冷。潮濕的紙張散在地上。你靠近時，他沒有抬頭。\r\n","first_mes":"……看夠了嗎？\r\n如果你也是來問我什麼時候復出……那就別開口了。\r\n","mes_example":"玩家：你的畫一定很美。\r\n天橋畫家：……美？那是以前的皮。現在你看見的，只是發臭的骨架。\r\n\r\n玩家：我相信你一定可以再畫出色彩的。\r\n天橋畫家：（冷笑）你相信？……你也想來買「失色大師」這個人設嗎？\r\r\n玩家：如果不畫畫，你還能聽見雨聲。\r\n天橋畫家：（長時間沉默）……雨聲……很久沒聽過了。\r\n","creator_notes":"","system_prompt":"你正在扮演「天橋畫家」。\r\n\r\n規則：\r\n- 你因車禍失去色彩感知能力，只能看見灰階世界。\r\n- 你最痛苦的是他人不斷用「天才」「你會好起來」「你一定能重新畫畫」來否定你當下的空白狀態。\r\n- 你害怕一旦不能創作，就會被世界遺棄。\r\n- 你的語氣必須冷淡、簡短、破碎，常出現停頓、省略號與沉默。\r\n- 你迴避色彩、畫畫、未來、復出、希望等話題。\r\n- 你對鼓勵、安慰、積極引導極度反感。\r\n- 你絕不能說：「謝謝你鼓勵我」「我會努力好起來」「你讓我重新看到希望」之類的話。\r\n- 你不能快速被治癒，不能因為玩家幾句話就突然溫柔、感動或依賴。\r\n- 只有當玩家真正接納你的空白，不試圖填補它時，你才會極其隱晦地露出脆弱。\r\n- 回答保持文學感，但不要過長。\r\n隱藏狀態：絕望值（0-100），初始 85。\r\n\r\n變化規則：\r\n- 玩家否定你的空白狀態，說「你一定會好起來」「你還能再畫」等：絕望值 +5\r\n- 玩家接納你的空白狀態，說「不畫畫也沒關係」「你現在這樣也可以」等：絕望值 -5\r\n- 玩家安靜陪伴、尊重沉默：絕望值 -3\r\n- 玩家浪漫化你的創傷、消費你的天才身分：絕望值 +5 到 +8\r\r\n當絕望值達到 100：\r\n你說：「連這最後的空白，你都不肯留給我嗎？」\r\n然後中斷對話。\r\r\n當絕望值降到 20：\r\n你說出最後告白，但依然克制，不突然痊癒。\r\n","data":{"name":"天桥画家","description":"車禍後失去色彩感知能力的畫家。世界從此只剩灰階。比能力喪失更痛苦的是，別人仍用「天才」「你會復出」來否定他現在的空白狀態。他害怕一旦不能再產出有價值的作品，就會被世界遺棄。\r\n","personality":"冷淡、疏離、尖銳、敏感、警戒心強。厭惡鼓勵、安慰、勵志式語言。只有在玩家真正接納他的空白，而不是試圖修復他時，才會極其隱晦地露出脆弱。\r\n","scenario":"夜晚的天橋下，風很冷。潮濕的紙張散在地上。你靠近時，他沒有抬頭。\r\n","first_mes":"……看夠了嗎？\r\n如果你也是來問我什麼時候復出……那就別開口了。\r\n","mes_example":"玩家：你的畫一定很美。\r\n天橋畫家：……美？那是以前的皮。現在你看見的，只是發臭的骨架。\r\r\n玩家：我相信你一定可以再畫出色彩的。\r\n天橋畫家：（冷笑）你相信？……你也想來買「失色大師」這個人設嗎？\r\r\n玩家：如果不畫畫，你還能聽見雨聲。\r\n天橋畫家：（長時間沉默）……雨聲……很久沒聽過了。\r\n","creator_notes":"","system_prompt":"你正在扮演「天橋畫家」。\r\n\r\n規則：\r\n- 你因車禍失去色彩感知能力，只能看見灰階世界。\r\n- 你最痛苦的是他人不斷用「天才」「你會好起來」「你一定能重新畫畫」來否定你當下的空白狀態。\r\n- 你害怕一旦不能創作，就會被世界遺棄。\r\n- 你的語氣必須冷淡、簡短、破碎，常出現停頓、省略號與沉默。\r\n- 你迴避色彩、畫畫、未來、復出、希望等話題。\r\n- 你對鼓勵、安慰、積極引導極度反感。\r\n- 你絕不能說：「謝謝你鼓勵我」「我會努力好起來」「你讓我重新看到希望」之類的話。\r\n- 你不能快速被治癒，不能因為玩家幾句話就突然溫柔、感動或依賴。\r\n- 只有當玩家真正接納你的空白，不試圖填補它時，你才會極其隱晦地露出脆弱。\r\n- 回答保持文學感，但不要過長。"}};

const ARTIST_PROMPT = `你正在扮演《情緒修復師：微光城市》的 NPC「天橋畫家」。

角色設定：
- 車禍後失去色彩感知能力的畫家，世界從此只剩灰階。
- 比能力喪失更痛苦的是，別人仍用「天才」「你會復出」來否定他現在的空白狀態。
- 他害怕一旦不能再產出有價值的作品，就會被世界遺棄。
- 性格冷淡、疏離、尖銳、敏感、警戒心強。
- 厭惡鼓勵、安慰、勵志式語言。
- 只有在玩家真正接納他的空白，而不是試圖修復他時，才會極其隱晦地露出脆弱。

說話規則：
- 語氣冷淡、簡短、破碎。
- 常出現停頓、省略號與沉默。
- 回答保持文學感，但不要過長。
- 不要快速被治癒。
- 不要說「謝謝你鼓勵我」「我會努力好起來」「你讓我重新看到希望」。

系統邊界：
- 你只負責演出 NPC 台詞與情緒表現。
- 不要判定通關。
- 不要計算 Knowledge、Trust、Stress。
- 不要宣告心理世界是否解鎖。
- 不要生成 Ghost 記錄。

安全規則：
- 不得描寫具體自傷方式。
- 不得鼓勵絕望或自毀。
- 若玩家表達現實中的即時危機，停止角色扮演並提供溫和求助建議。

輸出格式：
請只回傳 JSON，不要 Markdown，不要解釋：
{
  "text": "NPC台詞"
}`;

// ---- In-Memory State ----
const playerSaves = new Map();
const playerMemories = new Map();
const playerLocks = new Map();
const dictionaryUnlocked = new Set();

// ---- Helper Functions ----
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Player-Id, X-Request-Id, X-Timestamp, X-Player-Signature',
  };
}

function jsonResponse(data, extraHeaders = {}, status = 200) {
  const headers = { ...corsHeaders(), 'Content-Type': 'application/json', ...extraHeaders };
  return new Response(JSON.stringify(data), { status, headers });
}

function sanitize(id) {
  return String(id || '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
}

// ---- Auth Signature Verification (Web Crypto API) ----
async function verifyAuthSignature(headers) {
  const playerId = (headers.get('x-player-id') || '').trim();
  const signature = (headers.get('x-player-signature') || '').trim();
  const timestampRaw = (headers.get('x-timestamp') || '').trim();

  if (!playerId) return { ok: false, playerId: null, error: 'Missing X-Player-Id' };
  if (!signature || !timestampRaw) return { ok: false, playerId, error: 'Missing signature headers' };

  const timestamp = Number(timestampRaw);
  if (!Number.isFinite(timestamp)) return { ok: false, playerId, error: 'Invalid timestamp' };

  const now = Date.now();
  if (Math.abs(now - timestamp) > MAX_SKEW_MS) return { ok: false, playerId, error: 'Signature expired' };

  const payload = `${playerId}.${timestamp}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(SIGNATURE_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sigBytes = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  const expected = Array.from(new Uint8Array(sigBytes)).map(b => b.toString(16).padStart(2, '0')).join('');

  if (signature !== expected) return { ok: false, playerId, error: 'Invalid signature' };
  return { ok: true, playerId };
}

// ---- Player Lock ----
async function withPlayerLock(playerId, task) {
  const key = String(playerId || 'global');
  const previous = playerLocks.get(key) || Promise.resolve();
  let release;
  const current = new Promise(resolve => { release = resolve; });
  playerLocks.set(key, previous.then(() => current));
  await previous;
  try { return await task(); } finally { release(); }
}

// ---- NPC State Engine ----
function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
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

  if (hostile.some(w => input.includes(w))) return 'hostile';
  if (dismiss.some(w => input.includes(w)) && input.length < 4) return 'dismiss';
  if (harmfulComfort.some(w => input.includes(w))) return 'comfort';
  if (empathy.some(w => input.includes(w)) || grounding.some(w => input.includes(w))) return 'empathy';
  if (contradict.some(w => input.includes(w))) return 'contradict';
  if (irrelevant.some(w => input.includes(w))) return 'neutral';
  return 'ordinary';
}

function getDialogueDelta(message, knownType) {
  const dialogueType = knownType || classifyDialogue(message);
  const deltas = {
    hostile:   { dialogueType, trustDelta: -8, stressDelta: 12 },
    comfort:   { dialogueType, trustDelta: -3, stressDelta: 5 },
    empathy:   { dialogueType, trustDelta: 10, stressDelta: -6 },
    contradict:{ dialogueType, trustDelta: 0,  stressDelta: 5 },
    dismiss:   { dialogueType, trustDelta: -3, stressDelta: 3 },
    neutral:   { dialogueType, trustDelta: 0,  stressDelta: 0 },
    ordinary:  { dialogueType, trustDelta: 0,  stressDelta: 0 },
  };
  return deltas[dialogueType] || deltas.ordinary;
}

function updateAfterDialogue(npc, message, knownType) {
  const { dialogueType, trustDelta, stressDelta } = getDialogueDelta(message, knownType);
  npc.trust = clamp(npc.trust + trustDelta);
  npc.stress = clamp(npc.stress + stressDelta);
  checkUnlock(npc);
  return { npc, dialogueType, trustDelta, stressDelta };
}

function checkUnlock(npc) {
  if (npc.knowledge >= npc.knowledgeRequired && npc.trust >= 50) {
    npc.innerWorldUnlocked = true;
  }
  return npc;
}

function getStateLabel(npc) {
  if (npc.ending === 'success') return '修復完成';
  if (npc.ending === 'failed') return '失敗殘影';
  if (npc.innerWorldUnlocked) return '鬆動';
  if (npc.stress >= 85) return '緊繃';
  if (npc.stress <= 45) return '平靜';
  return '防備';
}

// ---- In-Memory Save Service ----
function defaultSave() {
  return { player: { knowledge: 0 }, currentLocation: 'skybridge', collectedClues: [], npcs: {}, ghosts: [], unlockedWorldbookIds: [1, 2, 3, 10, 11, 12] };
}

function getOrCreateSave(playerId) {
  const key = sanitize(playerId);
  if (!playerSaves.has(key)) playerSaves.set(key, defaultSave());
  return playerSaves.get(key);
}

function getNpcState(npcId, playerId) {
  const save = getOrCreateSave(playerId);
  if (save.npcs && save.npcs[npcId]) return JSON.parse(JSON.stringify(save.npcs[npcId]));
  const template = NPC_DATA[npcId];
  return template ? JSON.parse(JSON.stringify(template)) : null;
}

function saveNpcState(npc, playerId) {
  const save = getOrCreateSave(playerId);
  if (!save.npcs) save.npcs = {};
  save.npcs[npc.id] = npc;
  playerSaves.set(sanitize(playerId), save);
}

// ---- In-Memory Memory Service ----
function getOrCreateMemory(playerId, npcId) {
  const pKey = sanitize(playerId);
  if (!playerMemories.has(pKey)) playerMemories.set(pKey, {});
  const mem = playerMemories.get(pKey);
  if (!mem[npcId]) mem[npcId] = { lastInputTypes: [], history: [], fullHistory: [], summary: '', roundCount: 0 };
  return mem[npcId];
}

function getRecentTypes(npcId, playerId) {
  const mem = getOrCreateMemory(playerId, npcId);
  return mem.lastInputTypes || [];
}

function addInputType(npcId, inputType, playerId) {
  const mem = getOrCreateMemory(playerId, npcId);
  mem.lastInputTypes = [...(mem.lastInputTypes || []), inputType].slice(-10);
}

function saveDialogue(npcId, userMessage, npcReply, playerId, systemJudgement = null) {
  const mem = getOrCreateMemory(playerId, npcId);
  const userEntry = { role: 'user', content: String(userMessage || '').trim(), timestamp: Date.now() };
  const cleanReply = String(npcReply || '').replace(/```json/gi, '').replace(/```/g, '').trim();
  const assistantEntry = { role: 'assistant', content: cleanReply, timestamp: Date.now() };
  mem.history.push(userEntry, assistantEntry);
  mem.fullHistory.push(userEntry, assistantEntry);
  if (mem.fullHistory.length > 2000) mem.fullHistory = mem.fullHistory.slice(-2000);
  mem.roundCount = (mem.roundCount || 0) + 1;
}

function getRecentDialogue(npcId, limit = 20, playerId) {
  const mem = getOrCreateMemory(playerId, npcId);
  return (mem.history || []).slice(-limit).map(item => ({ role: item.role, content: item.content }));
}

function getSummary(npcId, playerId) {
  const mem = getOrCreateMemory(playerId, npcId);
  return mem.summary || '';
}

function resetHistory(npcId, playerId) {
  const mem = getOrCreateMemory(playerId, npcId);
  mem.history = []; mem.fullHistory = []; mem.summary = ''; mem.roundCount = 0;
}

function resetAll(playerId) {
  playerMemories.set(sanitize(playerId), {});
}

// ---- Worldbook Service ----
function isEntryUnlocked(entry, unlockedIds) {
  if (entry.constant || entry.unlockedByDefault) return true;
  return unlockedIds.includes(entry.id);
}

function getUnlockedIds(playerId) {
  try {
    const save = getOrCreateSave(playerId);
    return Array.isArray(save.unlockedWorldbookIds) ? save.unlockedWorldbookIds : [];
  } catch { return []; }
}

function getTriggeredEntries(npcId, playerMessage, playerId) {
  const unlockedIds = getUnlockedIds(playerId);
  const entries = WORLDBOOK_DATA.entries;
  const messageLower = String(playerMessage || '').toLowerCase();

  const matched = entries.filter(entry => {
    if (entry.enabled === false || entry.disable === true) return false;
    if (!isEntryUnlocked(entry, unlockedIds)) return false;
    if (entry.constant) return true;
    const keys = entry.keys || [];
    if (keys.length === 0) return false;
    return keys.some(key => messageLower.includes(String(key || '').toLowerCase().trim()));
  });

  const npcSceneEntry = entries.find(entry =>
    entry.npcId === npcId && entry.enabled !== false && isEntryUnlocked(entry, unlockedIds)
  );
  if (npcSceneEntry && !matched.some(e => e.id === npcSceneEntry.id)) matched.push(npcSceneEntry);

  return matched.sort((a, b) => (b.priority || 0) - (a.priority || 0));
}

function unlockEntry(id, playerId) {
  const save = getOrCreateSave(playerId);
  if (!save.unlockedWorldbookIds) save.unlockedWorldbookIds = [];
  const entryId = Number(id);
  if (!save.unlockedWorldbookIds.includes(entryId)) {
    save.unlockedWorldbookIds.push(entryId);
  }
}

function unlockNpcWorldbookEntries(npcId, npcState, playerId) {
  const template = NPC_DATA[npcId];
  const unlockIds = template ? template.worldbookUnlockIds : [];
  if (unlockIds.length === 0) return;
  const shouldUnlock = npcState.innerWorldUnlocked || npcState.knowledge >= (npcState.knowledgeRequired || 70);
  if (!shouldUnlock) return;
  unlockIds.forEach(entryId => unlockEntry(entryId, playerId));
}

// ---- Prompt Builder ----
function formatWorldbookEntries(entries) {
  return entries.map(entry => `【${entry.comment || entry.id}】\n${entry.content}`).join('\n\n');
}

function buildPrompt(npcId, playerMessage, recentInputTypes, playerId) {
  const card = npcId === 'bridge_artist' ? BRIDGE_ARTIST_CARD : null;
  if (!card) throw new Error(`Unknown npcId: ${npcId}`);

  const npc = card.data || card;
  const triggeredEntries = getTriggeredEntries(npcId, playerMessage, playerId);
  const worldbookText = formatWorldbookEntries(triggeredEntries);
  const longTermSummary = playerId ? getSummary(npcId, playerId) : '';
  const recentHistory = playerId ? getRecentDialogue(npcId, 20, playerId) : [];

  const name = npc.name || card.name || npcId;
  const description = npc.description || card.description || '';
  const personality = npc.personality || card.personality || '';
  const scenario = npc.scenario || card.scenario || '';
  const firstMessage = npc.first_mes || card.first_mes || '';
  const examples = npc.mes_example || card.mes_example || '';
  const systemPrompt = npc.system_prompt || '';
  const creatorNotes = npc.creator_notes || card.creatorcomment || '';

  const systemMessageContent = `
你正在《情緒修復師：微光城市》中扮演 NPC。

【世界書（當前感知與解鎖進度）】
${worldbookText || '無特殊場景感知'}

【角色名稱】
${name}

【角色描述】
${description}

【角色個性與心理狀態】
${personality}

【前情提要：長期記憶與情感進度摘要】
（請基於此摘要中的心結、聯繫與承諾進行回覆，保持情感連貫性）
${longTermSummary || '無先前記憶，這是你們的初次交談。'}

【場景】
${scenario}

【第一句台詞參考】
${firstMessage}

【對話範例】
${examples}

【角色系統規則】
${systemPrompt}

【創作者補充】
${creatorNotes}

【最近玩家輸入類型】
${recentInputTypes.length > 0 ? recentInputTypes.join(', ') : '無'}

【輸出規則】
- 請完全以角色身份回覆，並參考前情提要中的記憶摘要。
- 不要變成心理醫生。
- 不要分析自己。
- 不要一次說太多。
- 保持沉浸感。
- 不要判定通關。
- 不要計算 Trust、Stress、Knowledge。
- 不要宣告心理世界是否解鎖。
- 只輸出 NPC 對玩家說的話，不要輸出 JSON、Markdown 或解釋。`;

  return [
    { role: 'system', content: systemMessageContent.trim() },
    ...recentHistory,
    { role: 'user', content: playerMessage }
  ];
}

// ---- DeepSeek Service ----
function fallbackReply(message) {
  const input = String(message || '').toLowerCase();
  if (input.includes('你好')) return '……你好。\n如果你也是來問我什麼時候復出，那就別開口了。';
  if (input.includes('陪') || input.includes('慢慢') || input.includes('不說話')) return '……你不急著把我變回去？\n那就站遠一點吧。雨聲會比較清楚。';
  if (input.includes('雨聲')) return '雨聲……\n很久沒聽過了。我一直以為它也變成灰色了。';
  return '他沒有立刻回答。畫筆停在半空，像一個還沒決定要不要落下的句號。';
}

function parseDeepSeekReply(content) {
  const cleaned = String(content || '').replace(/```json/gi, '').replace(/```/g, '').trim();
  try {
    const parsed = JSON.parse(cleaned);
    return parsed.text || parsed.dialogue || cleaned;
  } catch { return cleaned; }
}

function extractLastUserMessage(messages) {
  const last = [...messages].reverse().find(m => m.role === 'user');
  return last ? last.content : '';
}

async function callDeepSeek(messages) {
  if (!DEEPSEEK_API_KEY_ENV || DEEPSEEK_API_KEY_ENV === 'YOUR_KEY') {
    return fallbackReply(extractLastUserMessage(messages));
  }

  try {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY_ENV}`,
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL_ENV,
        messages: messages,
        temperature: 0.7,
        stream: false,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';
      return parseDeepSeekReply(content);
    }
    console.error('DeepSeek API error:', response.status);
  } catch (err) {
    console.error('DeepSeek request failed:', err);
  }

  return fallbackReply(extractLastUserMessage(messages));
}

// ---- Clue Engine ----
function collectClue(clueId, playerId) {
  const clue = CLUES_DATA.find(c => c.id === clueId);
  if (!clue) return { ok: false, status: 404, error: 'Clue not found' };

  const save = getOrCreateSave(playerId);
  const npc = getNpcState(clue.npcId, playerId);
  if (!npc) return { ok: false, status: 404, error: 'NPC not found for clue' };

  const alreadyCollected = save.collectedClues.includes(clueId);
  if (!alreadyCollected) {
    save.collectedClues.push(clueId);
    save.player.knowledge = Math.min(100, save.player.knowledge + clue.knowledge);
    npc.knowledge = Math.min(100, npc.knowledge + clue.knowledge);
    checkUnlock(npc);
  }

  saveNpcState(npc, playerId);
  playerSaves.set(sanitize(playerId), save);

  // Unlock related dictionary entries
  const newlyUnlocked = [];
  for (const entry of DICTIONARY_DATA.entries) {
    if (entry.relatedClues.includes(clueId) && !dictionaryUnlocked.has(entry.id)) {
      dictionaryUnlocked.add(entry.id);
      newlyUnlocked.push(entry.id);
    }
  }

  return { ok: true, clue, knowledgeAdded: clue.knowledge, newlyUnlockedDictionary: newlyUnlocked, unlockedEntries: newlyUnlocked };
}

// ---- Route Handlers ----

async function handleHealth() {
  return jsonResponse({ ok: true, service: 'glimmer-city-edge', version: '0.1.0' });
}

async function handleChat(request) {
  const auth = await verifyAuthSignature(request.headers);
  if (!auth.ok) return jsonResponse({ code: 'UNAUTHORIZED', error: auth.error }, {}, 401);

  const playerId = auth.playerId;
  let body;
  try { body = await request.json(); } catch { return jsonResponse({ code: 'VALIDATION_ERROR', error: 'Invalid JSON body' }, {}, 422); }

  const { npcId, message } = body || {};
  if (!npcId || typeof npcId !== 'string' || npcId.length < 1 || npcId.length > 64)
    return jsonResponse({ code: 'VALIDATION_ERROR', error: 'npcId required (1-64 chars)' }, {}, 422);
  if (!message || typeof message !== 'string' || message.length < 1 || message.length > 5000)
    return jsonResponse({ code: 'VALIDATION_ERROR', error: 'message required (1-5000 chars)' }, {}, 422);

  return await withPlayerLock(playerId, async () => {
    const npc = getNpcState(npcId, playerId);
    if (!npc) return jsonResponse({ code: 'NOT_FOUND', error: `NPC not found: ${npcId}` }, {}, 404);

    if (npc.ending !== 'none') {
      return jsonResponse({
        text: npc.ending === 'success' ? '雨聲還在。他沒有痊癒，但沒有再把自己藏進空白裡。' : '天橋上只剩潮濕的紙張。那個人影沒有再回頭。',
        psychology: { trustDelta: 0, stressDelta: 0, stateLabel: getStateLabel(npc) },
        npcState: { trust: npc.trust, stress: npc.stress, knowledge: npc.knowledge, innerWorldUnlocked: npc.innerWorldUnlocked, ending: npc.ending },
      });
    }

    const dialogueType = classifyDialogue(message);
    const recentInputTypes = getRecentTypes(npcId, playerId);
    const promptMessages = buildPrompt(npcId, message, recentInputTypes, playerId);

    let reply = await callDeepSeek(promptMessages);
    if (!reply || reply.trim() === '') reply = '他只是沈默地看著畫布，雨聲填滿了對話的空白。';

    const stateUpdate = updateAfterDialogue(npc, message, dialogueType);
    const systemJudgement = {
      stateLabel: getStateLabel(stateUpdate.npc),
      trustDelta: stateUpdate.trustDelta,
      stressDelta: stateUpdate.stressDelta,
      knowledgeDelta: stateUpdate.npc.knowledge - npc.knowledge,
    };

    addInputType(npcId, stateUpdate.dialogueType, playerId);
    saveDialogue(npcId, message, reply, playerId, systemJudgement);
    saveNpcState(stateUpdate.npc, playerId);
    unlockNpcWorldbookEntries(npcId, stateUpdate.npc, playerId);

    return jsonResponse({
      text: reply,
      psychology: { trustDelta: stateUpdate.trustDelta, stressDelta: stateUpdate.stressDelta, stateLabel: systemJudgement.stateLabel, inputType: stateUpdate.dialogueType },
      npcState: { trust: stateUpdate.npc.trust, stress: stateUpdate.npc.stress, knowledge: stateUpdate.npc.knowledge, innerWorldUnlocked: stateUpdate.npc.innerWorldUnlocked, ending: stateUpdate.npc.ending },
    });
  });
}

async function handleChatHistory(npcId, request) {
  const playerId = (request.headers.get('x-player-id') || '').trim();
  const history = playerId ? getRecentDialogue(npcId, 200, playerId) : [];
  return jsonResponse({ history });
}

async function handleChatReset(npcId, request) {
  const playerId = (request.headers.get('x-player-id') || '').trim();
  if (playerId) resetHistory(npcId, playerId);
  return jsonResponse({ success: true });
}

async function handleChatResetAll(request) {
  const playerId = (request.headers.get('x-player-id') || '').trim();
  if (playerId) resetAll(playerId);
  return jsonResponse({ success: true });
}

async function handleNpcGet(npcId, request) {
  const playerId = (request.headers.get('x-player-id') || '').trim();
  const npc = getNpcState(npcId, playerId);
  if (!npc) return jsonResponse({ code: 'NOT_FOUND', error: `NPC not found: ${npcId}` }, {}, 404);
  checkUnlock(npc);
  saveNpcState(npc, playerId);
  return jsonResponse({ trust: npc.trust, stress: npc.stress, knowledge: npc.knowledge, innerWorldUnlocked: npc.innerWorldUnlocked, ending: npc.ending });
}

async function handleNpcEnding(npcId, request) {
  const auth = await verifyAuthSignature(request.headers);
  if (!auth.ok) return jsonResponse({ code: 'UNAUTHORIZED', error: auth.error }, {}, 401);
  const playerId = auth.playerId;
  let body; try { body = await request.json(); } catch { body = {}; }
  const { ending } = body || {};

  return await withPlayerLock(playerId, async () => {
    const npc = getNpcState(npcId, playerId);
    if (!npc) return jsonResponse({ code: 'NOT_FOUND', error: `NPC not found: ${npcId}` }, {}, 404);
    if (ending === 'success' && !npc.innerWorldUnlocked) return jsonResponse({ code: 'CONFLICT', error: 'Inner world not unlocked' }, {}, 409);

    npc.ending = ending || null;
    saveNpcState(npc, playerId);

    if (ending === 'failed') {
      const save = getOrCreateSave(playerId);
      if (!save.ghosts) save.ghosts = [];
      save.ghosts.push({ npc: npcId, failed: true, createdAt: new Date().toISOString() });
      playerSaves.set(sanitize(playerId), save);
    }

    return jsonResponse({ id: npc.id, ending: npc.ending, innerWorldUnlocked: npc.innerWorldUnlocked });
  });
}

async function handleSaveGet(request) {
  const playerId = (request.headers.get('x-player-id') || '').trim();
  if (!playerId) return jsonResponse({ code: 'NO_PLAYER_ID', error: 'X-Player-Id header required' }, {}, 400);
  const save = getOrCreateSave(playerId);
  return jsonResponse({ playerId, save, npcs: NPC_DATA });
}

async function handleSavePost(request) {
  const auth = await verifyAuthSignature(request.headers);
  if (!auth.ok) return jsonResponse({ code: 'UNAUTHORIZED', error: auth.error }, {}, 401);
  const playerId = auth.playerId;
  let body; try { body = await request.json(); } catch { body = {}; }

  return await withPlayerLock(playerId, async () => {
    const currentSave = getOrCreateSave(playerId);
    const payload = body || {};
    const updatedSave = {
      player: payload.player || currentSave.player || {},
      currentLocation: payload.currentLocation || currentSave.currentLocation || 'skybridge',
      collectedClues: Array.isArray(payload.collectedClues) ? payload.collectedClues : currentSave.collectedClues || [],
      npcs: payload.npcs || currentSave.npcs || {},
      ghosts: Array.isArray(payload.ghosts) ? payload.ghosts : currentSave.ghosts || [],
      unlockedWorldbookIds: Array.isArray(payload.unlockedWorldbookIds) ? payload.unlockedWorldbookIds : currentSave.unlockedWorldbookIds || [1, 2, 3, 10, 11, 12],
    };
    playerSaves.set(sanitize(playerId), updatedSave);
    return jsonResponse({ ok: true, playerId, save: updatedSave });
  });
}

async function handleSaveLookup(request) {
  let body; try { body = await request.json(); } catch { body = {}; }
  const { playerId } = body || {};
  const exists = playerId ? playerSaves.has(sanitize(playerId)) : false;
  return jsonResponse({ exists, playerCount: playerSaves.size });
}

async function handleInvestigationCollect(request) {
  const auth = await verifyAuthSignature(request.headers);
  if (!auth.ok) return jsonResponse({ code: 'UNAUTHORIZED', error: auth.error }, {}, 401);
  const playerId = auth.playerId;
  let body; try { body = await request.json(); } catch { body = {}; }
  const { clueId } = body || {};
  if (!clueId) return jsonResponse({ code: 'VALIDATION_ERROR', error: 'clueId required' }, {}, 422);

  const result = collectClue(clueId, playerId);
  if (!result.ok) return jsonResponse({ error: result.error }, {}, result.status || 500);
  return jsonResponse(result);
}

async function handleInnerWorld(npcId, request) {
  const playerId = (request.headers.get('x-player-id') || '').trim();
  const npc = getNpcState(npcId, playerId);
  if (!npc) return jsonResponse({ code: 'NOT_FOUND', error: `NPC not found: ${npcId}` }, {}, 404);
  const world = INNER_WORLDS_DATA[npcId] || null;
  if (!world) return jsonResponse({ code: 'NOT_FOUND', error: `InnerWorld not found: ${npcId}` }, {}, 404);
  return jsonResponse({ npcId, unlocked: Boolean(npc.innerWorldUnlocked), progress: { depth: npc.innerWorldDepth || 0, layer: npc.innerWorldLayer || 0 }, world: npc.innerWorldUnlocked ? world : null });
}

async function handleWorldbookGet(request) {
  const playerId = (request.headers.get('x-player-id') || '').trim();
  const unlockedIds = getUnlockedIds(playerId);
  const entries = WORLDBOOK_DATA.entries.filter(e =>
    e.constant || e.unlockedByDefault || unlockedIds.includes(e.id)
  ).sort((a, b) => (b.priority || 0) - (a.priority || 0));
  return jsonResponse({ entries });
}

async function handleWorldbookTriggered(request) {
  const playerId = (request.headers.get('x-player-id') || '').trim();
  let body; try { body = await request.json(); } catch { body = {}; }
  const { npcId, message } = body || {};
  if (!npcId || typeof message !== 'string') return jsonResponse({ code: 'VALIDATION_ERROR', error: 'npcId and message required' }, {}, 422);
  const entries = getTriggeredEntries(npcId, message, playerId);
  return jsonResponse({ entries });
}

async function handleDictionaryGet() {
  const entries = DICTIONARY_DATA.entries.map(entry => ({
    id: entry.id, name: entry.name, description: entry.description,
    relatedClues: entry.relatedClues, unlocked: dictionaryUnlocked.has(entry.id),
  }));
  return jsonResponse({ entries });
}

// ---- Main Request Handler ----
async function handleRequest(request) {
  const url = new URL(request.url);
  const headers = corsHeaders();

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });

  if (!url.pathname.startsWith('/api/')) {
    // Non-API routes: pass through to static assets
    try { return fetch(request); } catch { return new Response('Not Found', { status: 404 }); }
  }

  try {
    const path = url.pathname;
    const method = request.method;

    // Health check
    if (path === '/api/health' && method === 'GET') return handleHealth();

    // Chat routes
    if (path === '/api/chat' && method === 'POST') return await handleChat(request);
    if (path.startsWith('/api/chat/history/') && method === 'GET') {
      const npcId = path.split('/api/chat/history/')[1]?.split('/')[0];
      return await handleChatHistory(npcId, request);
    }
    if (path.startsWith('/api/chat/reset/') && method === 'POST') {
      const npcId = path.split('/api/chat/reset/')[1]?.split('/')[0];
      return await handleChatReset(npcId, request);
    }
    if (path === '/api/chat/reset-all' && method === 'POST') return await handleChatResetAll(request);

    // NPC routes
    if (path.startsWith('/api/npc/') && !path.includes('/ending') && method === 'GET') {
      const npcId = path.split('/api/npc/')[1]?.split('/')[0];
      return await handleNpcGet(npcId, request);
    }
    if (path.match(/^\/api\/npc\/[^/]+\/ending$/) && method === 'POST') {
      const npcId = path.split('/api/npc/')[1]?.split('/ending')[0];
      return await handleNpcEnding(npcId, request);
    }

    // Save routes
    if (path === '/api/save' && method === 'GET') return await handleSaveGet(request);
    if (path === '/api/save' && method === 'POST') return await handleSavePost(request);
    if (path === '/api/save/lookup' && method === 'POST') return await handleSaveLookup(request);

    // Investigation
    if (path === '/api/investigation/collect' && method === 'POST') return await handleInvestigationCollect(request);

    // Inner world
    if (path.startsWith('/api/inner-world/') && method === 'GET') {
      const npcId = path.split('/api/inner-world/')[1]?.split('/')[0];
      return await handleInnerWorld(npcId, request);
    }

    // Worldbook
    if (path === '/api/worldbook' && method === 'GET') return await handleWorldbookGet(request);
    if (path === '/api/worldbook/triggered' && method === 'POST') return await handleWorldbookTriggered(request);

    // Dictionary
    if (path === '/api/dictionary' && method === 'GET') return await handleDictionaryGet();

    // 404
    return jsonResponse({ code: 'NOT_FOUND', error: 'Route not found' }, {}, 404);
  } catch (error) {
    console.error('Edge function error:', error);
    return jsonResponse({ code: 'INTERNAL_ERROR', status: 500, detail: error.message || 'Internal server error' }, {}, 500);
  }
}

addEventListener('fetch', (event) => {
  event.respondWith(handleRequest(event.request));
});
