type MeterBarProps = {
  label: string;
  value: number;
  max?: number;
  tone?: 'gold' | 'blue' | 'red' | 'green';
};

const colors: Record<NonNullable<MeterBarProps['tone']>, string> = {
  gold: '#d6a35e',
  blue: '#8fbbe8',
  red: '#df7b7b',
  green: '#9be6ba',
};

export default function MeterBar({ label, value, max = 100, tone = 'gold' }: MeterBarProps) {
  const percent = Math.max(0, Math.min(100, (value / max) * 100));
  const color = colors[tone];

  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#b8b8b8', fontSize: 12 }}>
        <span>{label}</span>
        <span>{value}/{max}</span>
      </div>
      <div style={{ height: 7, borderRadius: 999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div
          style={{
            width: `${percent}%`,
            height: '100%',
            background: `linear-gradient(90deg, ${color}66, ${color})`,
            boxShadow: `0 0 18px ${color}55`,
            transition: 'width 0.2s ease',
          }}
        />
      </div>
    </div>
  );
}
