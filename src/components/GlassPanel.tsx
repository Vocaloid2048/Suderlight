import type { CSSProperties, ReactNode } from 'react';

type GlassPanelProps = {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  variant?: 'dark' | 'warm' | 'paper';
  style?: CSSProperties;
  contentStyle?: CSSProperties;
};

const variantStyle: Record<NonNullable<GlassPanelProps['variant']>, CSSProperties> = {
  dark: {
    background: 'linear-gradient(180deg, rgba(18,20,25,0.9), rgba(9,10,13,0.92))',
    border: '1px solid rgba(255,255,255,0.12)',
  },
  warm: {
    background: 'linear-gradient(180deg, rgba(45,32,22,0.9), rgba(18,14,12,0.94))',
    border: '1px solid rgba(214,163,94,0.2)',
  },
  paper: {
    background: 'linear-gradient(180deg, rgba(232,218,190,0.95), rgba(181,159,123,0.92))',
    border: '1px solid rgba(70,48,30,0.34)',
    color: '#241b14',
  },
};

export default function GlassPanel({
  children,
  title,
  subtitle,
  variant = 'dark',
  style,
  contentStyle,
}: GlassPanelProps) {
  const isPaper = variant === 'paper';

  return (
    <section
      style={{
        borderRadius: 18,
        boxShadow: '0 24px 90px rgba(0,0,0,0.46)',
        backdropFilter: 'blur(18px)',
        overflow: 'hidden',
        color: isPaper ? '#241b14' : '#f4efe7',
        ...variantStyle[variant],
        ...style,
      }}
    >
      {(title || subtitle) && (
        <header style={{ padding: '18px 20px 14px', borderBottom: isPaper ? '1px solid rgba(70,48,30,0.22)' : '1px solid rgba(255,255,255,0.09)' }}>
          {subtitle && (
            <div style={{ color: isPaper ? '#6b5137' : '#d6a35e', fontSize: 12, letterSpacing: 2, textTransform: 'uppercase' }}>
              {subtitle}
            </div>
          )}
          {title && <h2 style={{ margin: subtitle ? '7px 0 0' : 0, fontSize: 20, letterSpacing: 1 }}>{title}</h2>}
        </header>
      )}
      <div style={{ padding: 20, ...contentStyle }}>{children}</div>
    </section>
  );
}
