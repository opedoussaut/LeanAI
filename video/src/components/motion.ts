import { Easing, interpolate } from 'remotion';

export const EASE = Easing.bezier(0.2, 0.7, 0.2, 1); // the LeanAI app's own --ease
export const EASE_IN_OUT = Easing.bezier(0.65, 0, 0.35, 1);
export const EASE_IN = Easing.bezier(0.55, 0, 1, 0.45);

/** 0→1 between seconds a and b (scene-local), eased. */
export function ramp(tSec: number, a: number, b: number, ease = EASE): number {
  return interpolate(tSec, [a, b], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease });
}

/** fade in over [a, a+d], fade out over [b-d2, b]. */
export function window(tSec: number, a: number, b: number, d = 0.5, d2 = 0.5): number {
  return Math.min(ramp(tSec, a, a + d), 1 - ramp(tSec, b - d2, b, EASE_IN_OUT));
}

export const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smoothstep = (a: number, b: number, x: number) => {
  const u = clamp01((x - a) / (b - a));
  return u * u * (3 - 2 * u);
};
