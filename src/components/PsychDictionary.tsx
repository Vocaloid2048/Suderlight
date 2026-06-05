import { useEffect, useState } from 'react';

type DictEntry = {
  id: string;
  name: string;
  description: string;
  relatedClues: string[];
  unlocked: boolean;
};

type PsychDictionaryProps = {
  onClose: () => void;
};

export default function PsychDictionary({ onClose }: PsychDictionaryProps) {
  const [entries, setEntries] = useState<DictEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/dictionary')
      .then(res => res.json())
      .then(data => {
        setEntries(data.entries);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const selected = entries.find(e => e.id === selectedId);

  return (
    <div
      style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.7)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#17191d', padding: '30px', borderRadius: '10px',
          color: 'white', width: '500px', maxHeight: '80vh', overflowY: 'auto',
          border: '1px solid #555', boxShadow: '0 10px 40px rgba(0,0,0,0.9)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, color: '#eee', fontSize: '18px' }}>情緒詞典</h2>
          <button
            onClick={onClose}
            style={{
              background: '#333', color: 'white', border: '1px solid #555',
              borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontSize: 13,
            }}
          >
            關閉
          </button>
        </div>

        {loading ? (
          <div style={{ color: '#888', textAlign: 'center', padding: 20 }}>載入中...</div>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {entries.map(entry => (
                <button
                  key={entry.id}
                  onClick={() => entry.unlocked && setSelectedId(selectedId === entry.id ? null : entry.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 14px', borderRadius: 8,
                    background: entry.unlocked
                      ? (selectedId === entry.id ? '#2a2f38' : '#1e2128')
                      : '#14171c',
                    border: entry.unlocked
                      ? (selectedId === entry.id ? '1px solid #d6a35e' : '1px solid #333')
                      : '1px solid #222',
                    cursor: entry.unlocked ? 'pointer' : 'default',
                    color: entry.unlocked ? '#ddd' : '#555',
                    textAlign: 'left', width: '100%', fontSize: 14,
                    transition: 'background 0.15s',
                  }}
                >
                  <span style={{ fontSize: 16, opacity: entry.unlocked ? 1 : 0.4 }}>
                    {entry.unlocked ? '📖' : '🔒'}
                  </span>
                  <span style={{ fontWeight: entry.unlocked ? 500 : 400 }}>
                    {entry.name}
                  </span>
                  {entry.unlocked && (
                    <span style={{ marginLeft: 'auto', color: '#888', fontSize: 12 }}>
                      {selectedId === entry.id ? '▲' : '▼'}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {selected && (
              <div
                style={{
                  marginTop: 16, padding: '16px 18px', borderRadius: 8,
                  background: '#1a1d24', border: '1px solid #3a3d44',
                  lineHeight: 1.8, color: '#c8c8c8', fontSize: 14,
                }}
              >
                <div style={{ color: '#d6a35e', fontSize: 13, marginBottom: 8 }}>
                  {selected.name}
                </div>
                <div>{selected.description}</div>
                <div style={{ marginTop: 12, color: '#777', fontSize: 12 }}>
                  相關線索：{selected.relatedClues.length} 項
                </div>
              </div>
            )}

            {!selected && entries.length > 0 && (
              <div style={{ marginTop: 16, color: '#666', textAlign: 'center', fontSize: 13 }}>
                點擊已解鎖詞條查看詳細內容
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
