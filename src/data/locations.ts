// ============================================================
// 場景 / 地點定義
// 從 verticalSlice.ts 拆出
// ============================================================

export type LocationId = 'skybridge' | 'newsstand' | 'park';

export type LocationData = {
  id: LocationId;
  name: string;
  subtitle: string;
  description: string;
  ambient: string;
  spawn: { x: number; y: number };
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
