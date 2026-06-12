import type { CSSProperties, ReactNode } from 'react';

type GuiFrameProps = {
  children: ReactNode;
  tone?: 'city' | 'tavern' | 'inner' | 'paper' | 'dawn';
  style?: CSSProperties;
};

const backgrounds: Record<NonNullable<GuiFrameProps['tone']>, string> = {
  city: 'radial-gradient(circle at 48% 30%, rgba(45,55,65,0.95), rgba(5,7,10,1) 72%)',
  tavern: 'radial-gradient(circle at 42% 24%, rgba(95,58,32,0.72), rgba(18,11,9,0.96) 64%, #060506 100%)',
  inner: 'radial-gradient(circle at 50% 28%, rgba(62,64,72,0.84), rgba(9,10,14,0.97) 68%, #020306 100%)',
  paper: 'radial-gradient(circle at 50% 20%, rgba(68,57,43,0.85), rgba(12,10,8,0.96) 68%, #020202 100%)',
  dawn: 'radial-gradient(circle at 50% 42%, rgba(245,238,218,0.95), rgba(192,178,154,0.76) 56%, rgba(37,43,53,0.96) 100%)',
};

export default function GuiFrame({ children, tone = 'city', style }: GuiFrameProps) {
  return (
    <main
      style={{
        position: 'relative',
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        background: backgrounds[tone],
        color: '#f4efe7',
        ...style,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), radial-gradient(circle at 50% 50%, transparent, rgba(0,0,0,0.42))',
          backgroundSize: '100% 44px, cover',
          mixBlendMode: tone === 'dawn' ? 'soft-light' : 'normal',
        }}
      />
      {children}
    </main>
  );
}
