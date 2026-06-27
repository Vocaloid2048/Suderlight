// ============================================================
// 天橋畫家線索資料
// 從 verticalSlice.ts 拆出，含 worldId 字段供等角地圖對應
// ============================================================

import type { ClueDefinition } from '../npcs/types';

export type BridgeArtistClueId = 'brush' | 'newspaper' | 'sketchbook' | 'accident_report';

export const bridgeArtistClues: Record<BridgeArtistClueId, ClueDefinition> = {
  brush: {
    id: 'brush',
    label: '乾涸的畫筆',
    shortLabel: '畫筆',
    knowledge: 10,
    worldId: 'bridge_artist',
    locationId: 'skybridge',
    pos: { x: 18, y: 9.5 },
    color: '#fff6d8',
    icon: '筆',
    content: '你在潮濕的天橋角落找到一支畫筆。筆尖已經乾硬，上面殘留洗不掉的灰色顏料，像一段被迫停下來的句子。',
    dictionaryHint: '創傷後的創作，不一定是回到原本的樣子，也可能只是重新允許手停在紙上。',
  },
  newspaper: {
    id: 'newspaper',
    label: '報紙剪報',
    shortLabel: '報紙',
    knowledge: 10,
    worldId: 'bridge_artist',
    locationId: 'newsstand',
    pos: { x: 10, y: 17 },
    color: '#fff6d8',
    icon: '紙',
    content: '報紙被雨泡皺，只剩一角還能辨認：「天才青年畫家車禍後失去辨色能力……」旁邊的版面被人用力撕掉。',
    dictionaryHint: '失色不是黑暗，而是世界仍在發光，只是所有光都繞過了你。',
  },
  sketchbook: {
    id: 'sketchbook',
    label: '素描本',
    shortLabel: '素描本',
    knowledge: 15,
    worldId: 'bridge_artist',
    locationId: 'park',
    pos: { x: 11, y: 11 },
    color: '#fff6d8',
    icon: '本',
    content: '素描本前半本全是鮮活的花與街燈，後半本只剩反覆描過的灰階輪廓。最後一頁寫著：「如果春天只剩形狀，我還算畫家嗎？」',
    dictionaryHint: '自我價值崩塌時，人常把「做不到」誤認成「我不存在」。',
  },
  accident_report: {
    id: 'accident_report',
    label: '車禍報導',
    shortLabel: '車禍報導',
    knowledge: 15,
    worldId: 'bridge_artist',
    locationId: 'skybridge',
    pos: { x: 23, y: 19 },
    color: '#fff6d8',
    icon: '報',
    content: '這不是普通新聞，而是一份被折起來的完整報導。事故後的採訪標題寫著：「大家都在等他復出。」紙邊被指甲掐出深深痕跡。',
    dictionaryHint: '有些期待看似溫柔，實際上會把人再次釘回創傷現場。',
  },
};

export const bridgeArtistClueOrder: BridgeArtistClueId[] = ['brush', 'newspaper', 'sketchbook', 'accident_report'];
