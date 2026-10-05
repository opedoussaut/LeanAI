import React from 'react';
import { C, FONT } from '../data/theme.ts';
import { clamp01, EASE } from './motion.ts';

/** Masked line reveal: text slides up from behind a mask. `p` 0..1. */
export const Reveal: React.FC<{
  p: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
  out?: number; // 0..1 exit progress (slides up and fades)
}> = ({ p, children, style, out = 0 }) => {
  const u = EASE(clamp01(p));
  const o = clamp01(out);
  return (
    <div style={{ overflow: 'hidden', paddingBottom: '0.08em', ...style }}>
      <div style={{ transform: `translateY(${(1 - u) * 105 - o * 30}%)`, opacity: Math.min(u * 1.4, 1) * (1 - o) }}>{children}</div>
    </div>
  );
};

export const Label: React.FC<{ children: React.ReactNode; color?: string; size?: number; style?: React.CSSProperties }> = ({
  children, color = C.text3, size = 18, style,
}) => (
  <div style={{ fontFamily: FONT.mono, fontSize: size, letterSpacing: '0.16em', color, textTransform: 'uppercase', fontWeight: 500, ...style }}>
    {children}
  </div>
);

export const Display: React.FC<{ children: React.ReactNode; size?: number; weight?: number; color?: string; style?: React.CSSProperties }> = ({
  children, size = 96, weight = 600, color = C.text, style,
}) => (
  <div style={{ fontFamily: FONT.display, fontSize: size, fontWeight: weight, color, letterSpacing: '-0.02em', lineHeight: 1.02, ...style }}>
    {children}
  </div>
);

/** Tabular numeric value. */
export const Num: React.FC<{ children: React.ReactNode; size?: number; weight?: number; color?: string; style?: React.CSSProperties }> = ({
  children, size = 40, weight = 300, color = C.text, style,
}) => (
  <span style={{ fontFamily: FONT.display, fontVariantNumeric: 'tabular-nums', fontSize: size, fontWeight: weight, color, letterSpacing: '-0.01em', ...style }}>
    {children}
  </span>
);
