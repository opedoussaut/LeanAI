import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { Background } from '../components/Background.tsx';
import { Display, Label, Num, Reveal } from '../components/Type.tsx';
import { ramp, EASE_IN_OUT } from '../components/motion.ts';
import { C, FONT } from '../data/theme.ts';
import { FPS } from '../data/timeline.ts';
import { REFERENCE } from '../data/reflex.config.ts';

export const LANE_X = [400, 960, 1520];

const AGENTS = [
  { ...REFERENCE.jev, color: C.jev },
  { ...REFERENCE.haiku, color: C.haiku },
  { ...REFERENCE.opus, color: C.opus },
];

export const Scene01Question: React.FC = () => {
  const t = useCurrentFrame() / FPS;
  const grid = ramp(t, 0.5, 2.4);
  const lift = ramp(t, 3.7, 4.4, EASE_IN_OUT);
  const exit = ramp(t, 5.55, 6.0, EASE_IN_OUT);
  return (
    <AbsoluteFill>
      <Background grid={grid} />
      {AGENTS.map((a, i) => {
        const appear = ramp(t, 1.0 + i * 0.45, 1.7 + i * 0.45);
        const numP = ramp(t, 2.55 + i * 0.18, 3.25 + i * 0.18);
        const value = a.latency * numP;
        return (
          <div key={a.label} style={{ position: 'absolute', left: LANE_X[i] - 260, width: 520, top: 330 - lift * 70, textAlign: 'center', opacity: 1 - exit * 0.6 }}>
            <div style={{ height: 1, background: a.color, opacity: 0.6 * appear, width: `${appear * 60}%`, margin: '0 auto 26px' }} />
            <Reveal p={appear}>
              <div style={{ fontFamily: FONT.display, fontSize: 40, fontWeight: 600, letterSpacing: '0.12em', color: C.text }}>{a.label}</div>
            </Reveal>
            <Reveal p={ramp(t, 1.25 + i * 0.45, 1.95 + i * 0.45)} style={{ marginTop: 6 }}>
              <Label color={C.text2} size={20}>{a.role}</Label>
            </Reveal>
            <div style={{ marginTop: 44, opacity: numP > 0 ? 1 : 0 }}>
              <Num size={132} weight={200} color={a.color}>{value.toFixed(2)}</Num>
              <Num size={52} weight={200} color={a.color} style={{ opacity: 0.7, marginLeft: 6 }}>s</Num>
            </div>
            <div style={{ opacity: numP }}>
              <Label size={18} color={C.text3}>avg decision latency</Label>
            </div>
          </div>
        );
      })}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 790, textAlign: 'center' }}>
        <Reveal p={ramp(t, 3.9, 4.6)} out={exit}>
          <Display size={64} weight={600}>IS THE BIGGEST MODEL</Display>
        </Reveal>
        <Reveal p={ramp(t, 4.1, 4.8)} out={exit}>
          <Display size={64} weight={300} color={C.text2}>ALWAYS THE SMARTEST CHOICE?</Display>
        </Reveal>
      </div>
      <div style={{ position: 'absolute', left: 96, bottom: 60, opacity: ramp(t, 3.0, 3.8) * (1 - exit) }}>
        <Label size={16} color={C.text3}>Reference · LeanAI falling-block benchmark · Level 20</Label>
      </div>
    </AbsoluteFill>
  );
};
