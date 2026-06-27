/**
 * 情緒詞典 — 前端本地副本
 * 與 cloud-functions/api/data/dictionary.js 保持同步
 * 用於離線 fallback 或初始化參考
 *
 * 字典條目已依 npcId 分離至各 NPC 資料夾：
 * - bridge_artist → src/data/npcs/bridgePainter/index.ts (bridgeArtistDictionary)
 * 統一的本地副本僅保留基礎結構
 */
export type DictEntry = {
  id: string;
  name: string;
  description: string;
  relatedClues: string[];
  unlockCondition: string;
};

// 本地副本（建議從 /api/dictionary 動態載入為準）
import { bridgeArtistDictionary } from './npcs/bridgePainter';

const DICTIONARY: { entries: DictEntry[] } = {
  entries: bridgeArtistDictionary as DictEntry[],
};

export default DICTIONARY;
