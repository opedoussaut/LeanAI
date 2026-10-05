import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { Background } from '../components/Background.tsx';
import { Display, Label, Reveal } from '../components/Type.tsx';
import { EASE_IN_OUT, ramp, smoothstep } from '../components/motion.ts';
import { C, FONT } from '../data/theme.ts';
import { FPS, HYBRID_ESCALATIONS } from '../data/timeline.ts';

// QUALITATIVE trajectories (no numbers on the axes): illustrative shapes, not measurements.
const sig = (x: number) => 1 / (1 + Math.exp(-x));
export const CURVES = [
  { id: 's1', label: 'SYSTEM 1 ONLY', color: C.jev, w: 1.6, f: (x: number) => 0.56 * (1 - Math.exp(-x * 9)) - 0.07 * smoothstep(0.5, 1, x) },
  { id: 'llm', label: 'LLM ONLY', color: C.haiku, w: 1.6, f: (x: number) => 0.5 * (1 - Math.exp(-x * 2.6)) },
  { id: 'frontier', label: 'FRONTIER LLM ONLY', color: C.opus, w: 1.6, f: (x: number) => 0.6 * Math.pow(smoothstep(0.12, 1.05, x), 1.25) },
  {
    id: 'hybrid', label: 'LEANAI HYBRID', color: C.white, w: 3.2,
    f: (x: number) => 0.56 * (1 - Math.exp(-x * 9)) + 0.12 * sig((x - 0.36) / 0.025) + 0.1 * sig((x - 0.6) / 0.025) + 0.08 * sig((x - 0.82) / 0.025),
  },
];
export const ESCALATIONS = HYBRID_ESCALATIONS;

export const CHART = { x: 200, y: 250, w: 1000, h: 560 };
export const toXY = (x: number, y: number): [number, number] => [CHART.x + x * CHART.w, CHART.y + CHART.h - y * CHART.h];

export const Scene06Hybrid: React.FC = () => {
  const t = useCurrentFrame() / FPS;
  const enter = ramp(t, 0, 0.6);
  const drawBase = ramp(t, 0.5, 3.6, EASE_IN_OUT);
  const drawHybrid = ramp(t, 2.6, 5.4, EASE_IN_OUT);
  const end = ramp(t, 8.4, 9.0, EASE_IN_OUT);
  const pathFor = (f: (x: number) => number, upto: number) => {
    const n = 120;
    const pts: string[] = [];
    for (let i = 0; i <= n; i++) {
      const x = (i / n) * upto;
      const [px, py] = toXY(x, f(x));
      pts.push(`${i ? 'L' : 'M'} ${px.toFixed(1)} ${py.toFixed(1)}`);
    }
    return pts.join(' ');
  };
  return (
    <AbsoluteFill style={{ opacity: enter }}>
      <Background grid={1 - end} />
      <div style={{ position: 'absolute', left: 120, top: 70, opacity: 1 - end }}>
        <Reveal p={ramp(t, 0.1, 0.8)}><Label size={20} color={C.text2}>hybrid system</Label></Reveal>
      </div>
      <svg width={1920} height={1080} style={{ position: 'absolute', opacity: 1 - end }}>
        <line x1={CHART.x} y1={CHART.y + CHART.h} x2={CHART.x + CHART.w} y2={CHART.y + CHART.h} stroke={C.line2} />
        <line x1={CHART.x} y1={CHART.y} x2={CHART.x} y2={CHART.y + CHART.h} stroke={C.line2} />
        {CURVES.map((c) => {
          const upto = c.id === 'hybrid' ? drawHybrid : drawBase;
          if (upto <= 0) return null;
          const [ex, ey] = toXY(upto, c.f(upto));
          return (
            <g key={c.id}>
              <path d={pathFor(c.f, upto)} fill="none" stroke={c.color} strokeWidth={c.w} strokeOpacity={c.id === 'hybrid' ? 1 : 0.55} strokeLinecap="round" />
              <circle cx={ex} cy={ey} r={c.id === 'hybrid' ? 6 : 3.5} fill={c.id === 'hybrid' ? C.jev : c.color} opacity={c.id === 'hybrid' ? 1 : 0.7} />
            </g>
          );
        })}
        {ESCALATIONS.map((x, k) => {
          const on = ramp(drawHybrid, x - 0.01, x + 0.04);
          const [px, py] = toXY(x, CURVES[3].f(x));
          return <circle key={k} cx={px} cy={py} r={9 * on} fill="none" stroke={C.opus} strokeWidth={1.5} opacity={on} />;
        })}
      </svg>
      {/* end labels */}
      {CURVES.map((c, k) => {
        const upto = c.id === 'hybrid' ? drawHybrid : drawBase;
        const [ex, ey] = toXY(1, c.f(1));
        const op = ramp(upto, 0.92, 1) * (1 - end);
        const dy = c.id === 'llm' ? 14 : c.id === 'frontier' ? -14 : 0;
        return (
          <div key={c.id} style={{ position: 'absolute', left: ex + 22, top: ey - 13 + dy, opacity: op }}>
            <span style={{ fontFamily: FONT.mono, fontSize: c.id === 'hybrid' ? 22 : 18, fontWeight: 500, letterSpacing: '0.14em', color: c.id === 'hybrid' ? C.text : c.color }}>{c.label}</span>
          </div>
        );
      })}
      <div style={{ position: 'absolute', left: CHART.x, top: CHART.y + CHART.h + 16, opacity: ramp(t, 0.6, 1.2) * (1 - end) }}>
        <Label size={16} color={C.text3}>mission time →</Label>
      </div>
      <div style={{ position: 'absolute', left: CHART.x - 14, top: CHART.y - 40, opacity: ramp(t, 0.6, 1.2) * (1 - end) }}>
        <Label size={16} color={C.text3}>outcome ↑ · qualitative, illustrative</Label>
      </div>
      <div style={{ position: 'absolute', left: CHART.x + 470, top: CHART.y + CHART.h + 16, opacity: ramp(drawHybrid, 0.4, 0.5) * (1 - end) }}>
        <Label size={16} color={C.opus}>○ escalation to reasoning</Label>
      </div>
      {/* qualitative metrics */}
      <div style={{ position: 'absolute', left: 1560, top: 300, opacity: 1 - end }}>
        {['better outcome', 'lower ai cost', 'lower latency', 'more control'].map((m, k) => {
          const p = ramp(t, 4.9 + k * 0.25, 5.5 + k * 0.25);
          return (
            <div key={m} style={{ display: 'flex', alignItems: 'center', gap: 18, height: 64, opacity: p, transform: `translateX(${(1 - p) * 16}px)` }}>
              <svg width={22} height={22}>
                <path d="M 3 12 L 9 18 L 20 5" fill="none" stroke={C.jev} strokeWidth={2} pathLength={1} strokeDasharray={`${p} 2`} strokeLinecap="round" />
              </svg>
              <Label size={22} color={C.text}>{m}</Label>
            </div>
          );
        })}
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 890, textAlign: 'center' }}>
        <Reveal p={ramp(t, 6.4, 7.1)} out={end}><Display size={54} weight={300} color={C.text2}>REASONING BECOMES</Display></Reveal>
        <Reveal p={ramp(t, 6.55, 7.25)} out={end}><Display size={54} weight={600}>A RESOURCE TO ALLOCATE.</Display></Reveal>
      </div>
    </AbsoluteFill>
  );
};
