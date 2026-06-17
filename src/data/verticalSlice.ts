export type NpcId = 'bridge_artist' | 'victor';
export type LocationId = 'skybridge' | 'newsstand' | 'park';
export type ClueId = 'brush' | 'newspaper' | 'sketchbook' | 'accident_report';

export type LocationData = {
  id: LocationId;
  name: string;
  subtitle: string;
  description: string;
  ambient: string;
  spawn: { x: number; y: number };
};

export type ClueData = {
  id: ClueId;
  label: string;
  shortLabel: string;
  knowledge: number;
  locationId: LocationId;
  pos: { x: number; y: number };
  color: string;
  icon: string;
  content: string;
  dictionaryHint: string;
};

export const locations: Record<LocationId, LocationData> = {
  skybridge: {
    id: 'skybridge',
    name: '天橋',
    subtitle: '雨後的過街天橋',
    description: '鏽蝕欄杆掛滿被雨浸透的展覽海報，橋下車流聲像遙遠海浪。天橋畫家站在空白畫布前，像守著一塊沒有色彩的墓碑。',
    ambient: '鐵鏽、濕顏料、車流低鳴',
    spawn: { x: 10, y: 9 },
  },
  newsstand: {
    id: 'newsstand',
    name: '報攤',
    subtitle: '廢棄書報攤',
    description: '木頭招牌被雨水泡得發脹，泛黃報紙黏在一起。某些標題像還沒癒合的傷口，隔著塑膠布微微反光。',
    ambient: '濕紙、舊油墨、地下酒館的暖光縫隙',
    spawn: { x: 8, y: 11 },
  },
  park: {
    id: 'park',
    name: '公園',
    subtitle: '失修的城市公園',
    description: '長椅被雨水浸黑，兒童遊具在風裡發出細小尖聲。樹下有一本被踩進泥水裡的素描本。',
    ambient: '泥土、落葉、遲疑的雨聲',
    spawn: { x: 12, y: 12 },
  },
};

export const locationOrder: LocationId[] = ['skybridge'];

export const bridgeArtistClues: Record<ClueId, ClueData> = {
  brush: {
    id: 'brush',
    label: '乾涸的畫筆',
    shortLabel: '畫筆',
    knowledge: 20,
    locationId: 'skybridge',
    pos: { x: 18, y: 8.5 },
    color: '#fff6d8',
    icon: '筆',
    content: '你在潮濕的天橋角落找到一支畫筆。筆尖已經乾硬，上面殘留洗不掉的灰色顏料，像一段被迫停下來的句子。',
    dictionaryHint: '創傷後的創作，不一定是回到原本的樣子，也可能只是重新允許手停在紙上。',
  },
  newspaper: {
    id: 'newspaper',
    label: '報紙剪報',
    shortLabel: '報紙',
    knowledge: 20,
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
    knowledge: 30,
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
    knowledge: 30,
    locationId: 'skybridge',
    pos: { x: 23, y: 19 },
    color: '#fff6d8',
    icon: '檔',
    content: '這不是普通新聞，而是一份被折起來的完整報導。事故後的採訪標題寫著：「大家都在等他復出。」紙邊被指甲掐出深深痕跡。',
    dictionaryHint: '有些期待看似溫柔，實際上會把人再次釘回創傷現場。',
  },
};

export const clueOrder: ClueId[] = ['brush', 'newspaper', 'sketchbook', 'accident_report'];
