這是一份針對《情緒修復師：微光城市》專案的架構設計報告。本報告將在**完全不修改任何檔案**且**不撰寫程式碼**的前提下，針對您提出的四個核心目標（世界書區域解鎖、世界書關鍵字檢索、最近 20 條記憶、長期摘要記憶）進行系統架構設計。

---

### A. 現有架構問題

1.  **無狀態對話與「失憶症」問題（目標 3 & 4）**
    *   **無歷史對話記錄**：目前 `backend/routes/chat.js` 在調用 `deepseekService.chat(messages)` 時，傳入的 `messages` 僅包含重組後的 `system` Prompt（角色設定與全量世界書）與單條當前的 `user` Message。後端沒有對話歷史緩存，導致 NPC 對於上一秒自己說過的話和玩家說過的話毫無記憶。
    *   **記憶模組功能受限**：現有的 `backend/services/memoryService.js` 僅保存了 `lastInputTypes`（對話類型歷史，至多10個），完全沒有存儲實體對話內容（User/Assistant 對話對），這使得多輪對話的語境連貫性徹底失效，嚴重破壞了情緒修復的沉浸感。
2.  **世界書全量載入與 Token 膨脹（目標 1 & 2）**
    *   **無過濾全量拼接**：目前 `backend/services/promptBuilder.js` 中的 `formatWorldbook` 會將 `worldbook.json` 內所有啟用的條目一次性全部拼接到 System Prompt 中。
    *   **無效 Token 浪費與幻覺風險**：當前不論玩家在跟哪位 NPC 對話，天橋、錄音室、溫室、廢棄劇場等所有不相干的區域背景設定全都會被載入。這不僅極大地浪費了 API 的 Token 消耗，還容易使 LLM 產生認知混淆（幻覺），例如調香師維克多可能會突然說出天橋畫家的畫布設定。
3.  **缺乏關鍵字檢索機制（目標 2）**
    *   雖然世界書條目定義了 `keys`（關鍵字列表），例如 `"keys": ["酒館", "潛意識酒館", "避雨"]`，但目前代碼完全忽略了這些關鍵字，未實現「選擇性檢索（Selective Retrieval）」的動態加載機制。
4.  **缺乏區域解鎖與存檔關聯（目標 1）**
    *   世界書中的區域條目沒有解鎖狀態管理。在遊戲一開始，所有區域的秘密、裏世界設定就直接曝光在 System Prompt 中，無法根據玩家的探索進度（如親密度或線索收集進度）動態解鎖新區域知識。

---

### B. 建議資料結構

為了同時支持區域解鎖、關鍵字觸發、最近記憶與長期摘要，建議重新設計並擴展數據結構：

#### 1. 玩家存檔結構擴展 (`backend/data/save.json` 額外擴展欄位)
用以記錄玩家當前的「世界書區域解鎖狀態」：
```json
{
  "unlockedWorldbookIds": [1, 2, 3, 10, 11, 12] 
  // 預設僅解鎖全域背景、酒館、探索規則、詞典與邊界規則，特定區域（如錄音室、溫室）需滿足條件後動態寫入 ID
}
```

#### 2. 對話歷史與長期摘要記憶結構 (`backend/data/dialogueMemory.json` 擴展)
將原本僅記錄 `lastInputTypes` 的結構擴展為包含歷史隊列與滾動摘要的結構：
```json
{
  "bridge_artist": {
    "lastInputTypes": ["empathy", "ordinary"],
    "history": [
      {
        "role": "user",
        "content": "你為什麼一個人待在天橋上？",
        "timestamp": 1780610000000,
        "inputType": "ordinary"
      },
      {
        "role": "assistant",
        "content": "……因為這裡的風帶有鐵鏽的味道，能讓我感覺到自己還活著。",
        "timestamp": 1780610005000
      }
    ],
    "summary": "玩家（修復師）初次在天橋邂逅畫家，表現出溫和的傾聽態度。畫家雖然言詞防備，但透露了自己留在天橋是為了尋找『活著的感覺』。雙方初步建立了微弱的共感。"
  }
}
```

---

### C. 建議新增檔案

為確保代碼職責分離，避免將所有邏輯堆疊於 `memoryService` 中，建議新增以下模組：

1.  **`backend/services/worldbookService.js` (世界書服務)**
    *   **職責**：
        *   載入世界書原始數據並比對玩家存檔（`saveService`）中的解鎖狀態。
        *   提供關鍵字匹配引擎（支援不區分大小寫、子字串包含或正則表達式比對）。
        *   過濾出：`constant: true` (常駐條目) $+$ (已解鎖 $\cap$ 關鍵字匹配成功) 的動態條目。
2.  **`backend/services/summaryService.js` (長期摘要生成服務)**
    *   **職責**：
        *   封裝調用 DeepSeek API 進行對話提煉的 Prompt。
        *   負責將「舊摘要」與「即將被滑動窗口移出的對話歷史」進行滾動合併，輸出精簡的長期情感摘要。

---

### D. 建議修改檔案

1.  **`backend/services/memoryService.js`**
    *   新增 `saveDialogue(npcId, userMessage, npcReply)`：將單輪對話追加至 `history` 陣列中。
    *   新增 `getRecentDialogue(npcId, limit = 20)`：以滑動窗口機制截取最近的 20 條（10輪）對話對。
    *   新增 `getSummary(npcId)` 與 `updateSummary(npcId, newSummary)` 方法。
2.  **`backend/services/promptBuilder.js`**
    *   重構 `buildPrompt(npcId, playerMessage, recentInputTypes)`：
        *   引進 `worldbookService`，動態獲取當前觸發且已解鎖的世界書條目文本，取代全量加載。
        *   引進 `memoryService`，讀取長期摘要（`summary`）並格式化為 system prompt 中的【長期記憶與情感進度】區塊。
        *   讀取最近 20 條對話歷史，將其以 `{ role: 'user' / 'assistant', content: '...' }` 格式直接插在 System Prompt 與當前最新玩家訊息之間。
3.  **`backend/routes/chat.js`**
    *   在 DeepSeek 回覆成功並發送給前端後，調用 `memoryService.saveDialogue` 持久化當前對話。
    *   在對話落檔後，檢測是否滿足摘要觸發閾值，若滿足則觸發異步的長期摘要更新。
4.  **`backend/data/worldbook.json`**
    *   為每個 Entry 增加分類標識（如對應的 npcId 或區域 region），並標記預設解鎖狀態（`unlockedByDefault`）。

---

### E. Phase 4 拆分

#### **Phase 4.1: 對話歷史記憶 (最近 20 條) 與 PromptBuilder 重構**
*   **工作內容**：
    1. 擴展 `memoryService.js` 的 JSON 讀寫與記憶結構，實現 `history` 陣列的讀寫與自動截斷。
    2. 在 `memoryService.js` 中實現 `saveDialogue` 與 `getRecentDialogue` 方法。
    3. 重構 `promptBuilder.js` 的 `buildPrompt` 函數，將最近 20 條歷史以原生 OpenAI/DeepSeek 訊息格式陣列插入到最終的 `messages` 數組中，實現真正支援上下文的多輪對話。
    4. 在 `routes/chat.js` 對話響應鏈路中接入 `saveDialogue` 儲存邏輯。
*   **驗證方法**：
    1. 與天橋畫家對話，發送：「你好，我是修復師。」，獲得回覆後，再次發送：「你剛剛說你討厭復出，能告訴我為什麼嗎？」。
    2. 查看後端 API 請求 Payload，確認發送給 DeepSeek 的 `messages` 中包含了上一輪的 User 與 Assistant 訊息。
    3. 觀察 NPC 回覆是否能精準繼承前文語境。
    4. 連續對話 15 輪（30條訊息），確認滑動窗口是否能準確截斷並保持記憶在最近的 20 條，防止 Token 溢出。
*   **預估風險**：
    1. **Context Window 負載過大與費用上升**：多輪對話會導致每次 API 呼叫的 Token 消耗以線性增長。需建立對話單條字數限制。
    2. **格式污染傳遞**：若 NPC 在前幾輪說過的話夾雜了未解析的 Markdown 或 JSON，該格式會隨著歷史記憶帶入下一輪，誘發 LLM 後續輸出格式崩潰。需在寫入 `history` 前對 NPC 回覆進行嚴格的格式清洗。

#### **Phase 4.2: 世界書關鍵字選擇性檢索 (Selective Retrieval)**
*   **工作內容**：
    1. 建立 `worldbookService.js`，開發關鍵字匹配引擎（Keyword Matcher）。
    2. 遍歷世界書中的所有條目，提取 `keys`。在玩家發送 `playerMessage` 時，對其進行關鍵字比對。
    3. 設定條目加載過濾規則：
        *   `constant: true` 的全域常規條目、反幻想規則等一律無條件加載。
        *   `constant: false` 的條目（如：天橋、錄音室、溫室等特定場景描述），僅當 `playerMessage` 命中其 `keys` 中的任意一個關鍵字時才被動態載入。
    4. 將 `promptBuilder.js` 的全量加載替換為 `worldbookService.getTriggeredEntries`。
*   **驗證方法**：
    1. 當玩家輸入「聽說這裡有一間**錄音室**」時，查看調試日誌，確認 system prompt 中動態併入了「老舊錄音室」的 entry 文本。
    2. 當玩家輸入無關話題「午餐吃什麼」時，確認 system prompt 中僅包含「全域背景」與「反幻想規則」等常駐條目，其餘錄音室、溫室、標本室等條目皆未被載入。
*   **預估風險**：
    1. **關鍵字匹配過死或觸發率低下**：若玩家使用同義詞（如用「音樂房」替代「錄音室」）將無法觸發。需要適度擴充 `worldbook.json` 裡的 `keys` 覆蓋率，或將匹配引擎升級為支持同義詞詞典。
    2. **冷啟動背景丟失**：當玩家發送極短訊息（如「嗯」、「哈哈」）時，未能觸發任何特定區域世界書，LLM 可能丟失場景感知。此時必須確保當前 NPC 所在的「主場景條目」（如對話畫家時，天橋條目）作為預設基礎背景保底加載。

#### **Phase 4.3: 世界書區域解鎖與存檔關聯**
*   **工作內容**：
    1. 修改 `worldbook.json`，對特定條目加上區域 ID 與解鎖屬性。
    2. 在 `saveService.js` 所管理的存檔數據中增設 `unlockedWorldbookIds` 數組。
    3. 在 `worldbookService.js` 的過濾邏輯中注入存檔狀態比對：即使關鍵字匹配成功，若該 entry ID 不在玩家的 `unlockedWorldbookIds` 中，依然予以排除（不加載至 prompt）。
    4. 在 `npcStateEngine.js` 或是 `chat.js` 路由中設計解鎖觸發器：當與特定 NPC 的 `knowledge` 或 `trust` 達到閾值時，調用存檔解鎖 API，將對應的區域世界書 ID 寫入存檔並持久化。
*   **驗證方法**：
    1. 初始存檔下「錄音室」未解鎖。輸入「帶我去錄音室」，驗證 system prompt 中沒有錄音室條目，NPC 應表現出符合世界觀的困惑與不知道。
    2. 通過對話滿足解鎖條件，確認存檔 `save.json` 中的 `unlockedWorldbookIds` 成功增添了錄音室 entry ID。
    3. 再次輸入相同話語，確認錄音室條目已被成功檢索並加載，NPC 能給出正確的指引對話。
*   **預估風險**：
    1. **併發存檔寫入衝突**：若多個非同步對話同時觸發解鎖，可能會導致寫入 `save.json` 時產生競態條件（Race Condition）而造成存檔損毀。必須在 `saveService` 中實施簡單的檔案寫入佇列（Queue）或鎖定機制。
    2. **劇情死鎖**：若玩家操作不當錯失了解鎖條件，導致關鍵區域永久無法開啟。需設置劇情保底機制（例如對話達特定輪數自動強行解鎖基礎探索條目）。

#### **Phase 4.4: 長期摘要記憶的異步生成與滾動更新**
*   **工作內容**：
    1. 實作 `summaryService.js`，編寫用於總結對話歷史的 LLM System Prompt（限制輸出在 150 - 200 字內，聚焦於情緒心結、關鍵事件進度、修復師做出的承諾）。
    2. 設定觸發計數器：例如每 10 輪對話，或當 `history` 即將超出滑動窗口被丟棄前，觸發一次摘要。
    3. 將對話總結設計為**非阻塞異步背景任務（Async background task）**：在後端將 NPC 對話回覆發送給玩家後，在背景發起 LLM 摘要請求，避免讓玩家在對話過程中等待摘要生成的延遲。
    4. 完成後將摘要持久化至 `dialogueMemory.json` 的 `summary` 欄位。
    5. 重構 `promptBuilder.js`，將此長期摘要拼入 System Prompt 的【長期記憶與情感進度】區塊。
*   **驗證方法**：
    1. 將測試觸發閾值調低（如每 3 輪觸發一次摘要）。
    2. 與畫家深入對話 4 輪（如談論他對雨天的痛苦回憶、承諾會陪他到雨停）。
    3. 檢查 `dialogueMemory.json`，驗證 `summary` 欄位是否已被自動寫入，且精準總結了「痛苦回憶」與「陪他到雨停」等關鍵承諾。
    4. 繼續對話 15 輪，使最初的對話完全滑出最近 20 條記憶窗口。
    5. 突然提及：「我之前答應過會陪你到雨停的，你還記得嗎？」，確認 NPC 能根據長期摘要給出正確回覆，證明長期記憶生效。
*   **預估風險**：
    1. **語意漂移（Semantic Drift）**：隨著對話的不斷更新，摘要會進行多次「摘要的摘要」，可能導致關鍵細節在滾動更新中失真或丟失。解決方案是限制每次摘要僅能修改「狀態更新」區，並在 Prompt 中限定關鍵變量（如：[核心未解心結]、[修復承諾列表]、[當前情感溫度]）進行結構化填寫。
    2. **背景併發讀寫衝突**：在背景異步調用 AI 生成摘要需要 1-3 秒，期間若玩家迅速發送新訊息，可能導致讀取到舊的或正在寫入的記憶結構。需要對對話歷史的持久化引入緩存鎖定，在寫入新摘要時進行增量合併。