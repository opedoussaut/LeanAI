import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { Display, Reveal } from '../components/Type.tsx';
import { EASE_IN_OUT, lerp, ramp } from '../components/motion.ts';
import { C, FONT } from '../data/theme.ts';
import { FPS } from '../data/timeline.ts';
import { CURVES, toXY } from './Scene06Hybrid.tsx';

export const Scene07Final: React.FC = () => {
  const t = useCurrentFrame() / FPS;
  // the green point inherits the end of the hybrid trajectory and travels to centre
  const [sx, sy] = toXY(1, CURVES[3].f(1));
  const move = ramp(t, 0.1, 1.3, EASE_IN_OUT);
  const px = lerp(sx, 960, move);
  const py = lerp(sy, 380, move);
  const halo = ramp(t, 0.8, 1.6);
  const fadeOut = ramp(t, 7.25, 7.95, EASE_IN_OUT);
  return (
    <AbsoluteFill style={{ backgroundColor: C.bg }}>
      <AbsoluteFill style={{ opacity: 1 - fadeOut }}>
        <svg width={1920} height={1080} style={{ position: 'absolute' }}>
          <defs>
            <radialGradient id="pt" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={C.jev} stopOpacity={0.5} />
              <stop offset="100%" stopColor={C.jev} stopOpacity={0} />
            </radialGradient>
          </defs>
          <circle cx={px} cy={py} r={40 * halo} fill="url(#pt)" />
          <circle cx={px} cy={py} r={6} fill={C.jev} />
        </svg>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 430, textAlign: 'center' }}>
          <Reveal p={ramp(t, 1.2, 2.0)}>
            <div style={{ fontFamily: FONT.display, fontSize: 84, fontWeight: 600, letterSpacing: '0.32em', color: C.text, paddingLeft: '0.32em' }}>LEANAI</div>
          </Reveal>
        </div>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 580, textAlign: 'center' }}>
          {['THE RIGHT INTELLIGENCE.', 'THE RIGHT CONTEXT.', 'THE RIGHT MOMENT.'].map((l, k) => (
            <Reveal key={l} p={ramp(t, 2.5 + k * 0.5, 3.15 + k * 0.5)}>
              <Display size={40} weight={300} color={k === 2 ? C.text : C.text2} style={{ letterSpacing: '0.04em', lineHeight: 1.35 }}>{l}</Display>
            </Reveal>
          ))}
        </div>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 840, textAlign: 'center' }}>
          <Reveal p={ramp(t, 4.3, 5.0)}>
            <div style={{ fontFamily: FONT.mono, fontSize: 24, fontWeight: 500, letterSpacing: '0.2em', color: C.jev }}>ESCALATE REASONING</div>
          </Reveal>
          <Reveal p={ramp(t, 4.45, 5.15)}>
            <div style={{ fontFamily: FONT.mono, fontSize: 24, fontWeight: 500, letterSpacing: '0.2em', color: C.text, marginTop: 8 }}>ONLY WHEN VALUE JUSTIFIES IT.</div>
          </Reveal>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
