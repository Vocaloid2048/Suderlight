import { useEffect, useState } from 'react';
import { GlimmerButton, GlassPanel, GuiFrame } from '../components';

type DictEntry = {
  id: string;
  name: string;
  description: string;
  relatedClues: string[];
  unlockCondition: string;
  unlocked: boolean;
};

const SAVE_KEY = 'glimmer_city_vertical_slice_save_v1';

function getCollectedClues(): string[] {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return [];
    const save = JSON.parse(raw);
    return Array.isArray(save.collectedClues) ? save.collectedClues : [];
  } catch {
    return [];
  }
}

function isEntryUnlocked(entry: { relatedClues?: string[]; unlockCondition?: string }, collectedClues: string[]) {
  const related = Array.isArray(entry.relatedClues) ? entry.relatedClues : [];
  const condition = entry.unlockCondition;
  return collectedClues.some(c => related.includes(c) || c === condition);
}

export default function EmotionDictionaryPage({ onBack }: EmotionDictionaryPageProps) {
  const [entries, setEntries] = useState<DictEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/dictionary')
      .then(res => res.json())
      .then(data => {
        const collectedClues = getCollectedClues();
        const entriesWithUnlock = (Array.isArray(data.entries) ? data.entries : []).map((entry: any) => ({
          ...entry,
          unlocked: isEntryUnlocked(entry, collectedClues),
        }));
        setEntries(entriesWithUnlock);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const unlockedEntries = entries.filter(entry => entry.unlocked);
  const selected = entries.find(entry => entry.id === selectedId) ?? unlockedEntries[0];
  const lockedCount = entries.length - unlockedEntries.length;

  return (
    <GuiFrame tone="paper">
      <div style={{ position: 'relative', zIndex: 2, height: '100%', display: 'grid', gridTemplateColumns: '320px minmax(520px, 820px)', gap: 24, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <GlassPanel title="情緒詞典" subtitle="Emotion Dictionary" variant="paper" contentStyle={{ display: 'grid', gap: 10 }}>
          {loading && <div style={{ color: '#6b5137', padding: 16 }}>載入中...</div>}
          {!loading && unlockedEntries.length === 0 && <div style={{ color: '#6b5137', padding: 16 }}>尚未解鎖任何理解。</div>}
          {!loading && unlockedEntries.map(entry => (
            <button
              key={entry.id}
              onClick={() => setSelectedId(entry.id)}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '12px 14px',
                borderRadius: 10,
                border: selected?.id === entry.id ? '1px solid rgba(95,61,32,0.72)' : '1px solid rgba(95,61,32,0.2)',
                background: selected?.id === entry.id ? 'rgba(95,61,32,0.14)' : 'rgba(255,255,255,0.18)',
                color: '#241b14',
                cursor: 'pointer',
              }}
            >
              <div style={{ fontWeight: 700 }}>{entry.name}</div>
              <div style={{ color: '#765d42', fontSize: 12, marginTop: 4 }}>相關線索：點擊查看</div>
            </button>
          ))}
          {lockedCount > 0 && <div style={{ color: '#775f45', fontSize: 13, textAlign: 'center', paddingTop: 8 }}>尚有未解鎖的理解等待發現</div>}
          <GlimmerButton tone="ghost" onClick={onBack}>返回</GlimmerButton>
        </GlassPanel>

        <GlassPanel title={selected?.name ?? '未選擇詞條'} subtitle="Welfare Card" variant="paper" style={{ minHeight: 560 }} contentStyle={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'stretch' }}>
          <div style={{ borderRadius: 16, padding: 20, background: 'rgba(35,29,24,0.86)', color: '#f4efe7', boxShadow: 'inset 0 0 60px rgba(0,0,0,0.35)' }}>
            <div style={{ color: '#d6a35e', letterSpacing: 3, fontSize: 12 }}>左頁：心理手記</div>
            <h3 style={{ margin: '18px 0 10px' }}>感官描述</h3>
            <p style={{ color: '#d0c6ba', lineHeight: 1.9, whiteSpace: 'pre-line' }}>
              {selected?.description ?? '詞條尚未被雨水顯影。請在城市中找到更多記憶錨點。'}
            </p>
          </div>

          <div style={{ borderRadius: 16, padding: 20, background: 'linear-gradient(180deg, rgba(255,246,216,0.92), rgba(221,237,213,0.9))', color: '#293226', border: '1px solid rgba(80,108,76,0.2)' }}>
            <div style={{ color: '#678c5a', letterSpacing: 3, fontSize: 12 }}>右頁：公益小卡</div>
            <h3 style={{ margin: '18px 0 10px' }}>現實支持提醒</h3>
            <p style={{ lineHeight: 1.9 }}>
              如果你在現實中遇到類似困境，請優先尋找可信任的人、校園心理中心、社工或專業諮詢協助。當出現立即危險，請聯絡當地緊急服務。
            </p>
            <p style={{ lineHeight: 1.9, marginTop: 16 }}>
              遊戲中的傾聽練習，重點不是「說服對方好起來」，而是承認感受存在，並陪對方回到安全處境。
            </p>
          </div>
        </GlassPanel>
      </div>
    </GuiFrame>
  );
}
