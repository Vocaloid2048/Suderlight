const express = require('express');
const deepseekService = require('../services/deepseekService');
const promptBuilder = require('../services/promptBuilder');
const saveService = require('../services/saveService');
const npcStateEngine = require('../services/npcStateEngine');
const memoryService = require('../services/memoryService');
const worldbookService = require('../services/worldbookService');
const summaryService = require('../services/summaryService');

const router = express.Router();

router.post('/', async (req, res, next) => {
  try {
    const { npcId, message } = req.body || {};

    if (!npcId || !message) {
      return res.status(400).json({ error: 'npcId and message are required' });
    }

    const npc = saveService.getNpc(npcId);
    if (!npc) {
      return res.status(404).json({ error: 'NPC not found' });
    }

    // 1. 若已經走到結局，直接返回結局文本
    if (npc.ending) {
      return res.json({
        text: npc.ending === 'success'
          ? '雨聲還在。他沒有痊癒，但沒有再把自己藏進空白裡。'
          : '天橋上只剩潮濕的紙張。那個人影沒有再回頭。',
        psychology: {
          trustDelta: 0,
          stressDelta: 0,
          stateLabel: npcStateEngine.getStateLabel(npc),
        },
        npcState: {
          trust: npc.trust,
          stress: npc.stress,
          knowledge: npc.knowledge,
          innerWorldUnlocked: npc.innerWorldUnlocked,
          ending: npc.ending,
        },
      });
    }

    // 2. 進行對話分類
    const dialogueType = npcStateEngine.classifyDialogue(message);
    const recentInputTypes = memoryService.getRecentTypes(npcId);
    
    // 3. 獲取最近歷史對話，以便後續判斷是否需要做摘要 (這時還沒加入當前輪次，recentHistory 長度即為先前的長度)
    const recentHistory = memoryService.getRecentDialogue(npcId, 20);

    // 4. 建立與 LLM 互動的 messages 陣列 (包含當前觸發世界書、長期摘要、對話歷史與最新訊息)
    const messages = promptBuilder.buildPrompt(npcId, message, recentInputTypes);
    
    // 5. 調用 AI 生成 NPC 回覆
    const reply = await deepseekService.chat(messages);

    // 6. 更新 NPC 情感狀態
    const stateUpdate = npcStateEngine.updateAfterDialogue(npc, message, dialogueType);
    
    // 7. 保存對話語氣、NPC 狀態與實體對話歷史
    memoryService.addInputType(npcId, stateUpdate.dialogueType);
    memoryService.saveDialogue(npcId, message, reply);
    saveService.saveNpc(stateUpdate.npc);

    // 8. 世界書區域解鎖判定與關聯
    // 依據玩家與特定 NPC 關係（如天橋畫家 bridge_artist）的進展，解鎖新的世界書區域
    if (npcId === 'bridge_artist') {
      if (stateUpdate.npc.innerWorldUnlocked || stateUpdate.npc.knowledge >= 70) {
        // 解鎖錄音室 (ID 5) 與化學實驗室及溫室 (ID 7)
        worldbookService.unlockEntry(5);
        worldbookService.unlockEntry(7);
      }
    }

    // 9. 響應客戶端，使玩家立即獲得 NPC 回覆
    res.json({
      text: reply,
      psychology: {
        trustDelta: stateUpdate.trustDelta,
        stressDelta: stateUpdate.stressDelta,
        stateLabel: npcStateEngine.getStateLabel(stateUpdate.npc),
        inputType: stateUpdate.dialogueType,
      },
      npcState: {
        trust: stateUpdate.npc.trust,
        stress: stateUpdate.npc.stress,
        knowledge: stateUpdate.npc.knowledge,
        innerWorldUnlocked: stateUpdate.npc.innerWorldUnlocked,
        ending: stateUpdate.npc.ending,
      },
    });

    // 10. 異步非阻塞地更新「長期摘要記憶」
    // 當前累積的歷史訊息數如果大於等於 8 條（即 4 輪完整的 User-Assistant 對話），則觸發背景摘要生成，不阻礙玩家對話
    if (recentHistory.length >= 8) {
      const oldSummary = memoryService.getSummary(npcId);
      // 提取最新的 8 條對話片斷（4輪對話）
      const segment = recentHistory.slice(-8);
      
      // 異步在後台發起 DeepSeek 摘要請求，更新長期情感摘要
      summaryService.generateUpdatedSummary(oldSummary, segment)
        .then(newSummary => {
          if (newSummary && newSummary !== '無' && newSummary.trim() !== '') {
            memoryService.updateSummary(npcId, newSummary);
            console.log(`[Summary Service] Asynchronously updated long-term summary for NPC: ${npcId}`);
          }
        })
        .catch(err => {
          console.error(`[Summary Service] Failed to asynchronously update summary for NPC: ${npcId}`, err);
        });
    }

  } catch (error) {
    next(error);
  }
});

module.exports = router;
