import type { ButtonHTMLAttributes, ReactNode } from 'react';

type GlimmerButtonTone = 'primary' | 'danger' | 'ghost' | 'quiet';

type GlimmerButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  tone?: GlimmerButtonTone;
  fullWidth?: boolean;
};

const toneStyles: Record<GlimmerButtonTone, { background: string; border: string; color: string; shadow: string }> = {
  primary: {
    background: 'linear-gradient(135deg, rgba(138,91,45,0.96), rgba(74,45,24,0.96))',
    border: '1px solid rgba(214,163,94,0.78)',
    color: '#fff8ec',
    shadow: '0 0 26px rgba(214,163,94,0.18)',
  },
  danger: {
    background: 'linear-gradient(135deg, rgba(90,37,40,0.96), rgba(42,18,22,0.96))',
    border: '1px solid rgba(220,95,104,0.7)',
    color: '#ffecec',
    shadow: '0 0 24px rgba(220,95,104,0.14)',
  },
  ghost: {
    background: 'rgba(24,27,33,0.86)',
    border: '1px solid rgba(255,255,255,0.14)',
    color: '#d8d8d8',
    shadow: 'none',
  },
  quiet: {
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.1)',
    color: '#aeb4bd',
    shadow: 'none',
  },
};

export default function GlimmerButton({
  children,
  tone = 'ghost',
  fullWidth = false,
  disabled,
  style,
  ...props
}: GlimmerButtonProps) {
  const styles = toneStyles[tone];

  return (
    <button
      {...props}
      disabled={disabled}
      style={{
        width: fullWidth ? '100%' : undefined,
        minHeight: 36,
        padding: '8px 14px',
        borderRadius: 10,
        background: disabled ? 'rgba(45,48,55,0.72)' : styles.background,
        border: disabled ? '1px solid rgba(255,255,255,0.08)' : styles.border,
        color: disabled ? '#777' : styles.color,
        boxShadow: disabled ? 'none' : styles.shadow,
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: 13,
        letterSpacing: 0.5,
        transition: 'transform 0.16s ease, border-color 0.16s ease, box-shadow 0.16s ease',
        ...style,
      }}
    >
      {children}
    </button>
  );
}
