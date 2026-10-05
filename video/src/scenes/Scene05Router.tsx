import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { Background } from '../components/Background.tsx';
import { Display, Label, Num, Reveal } from '../components/Type.tsx';
import { EASE, EASE_IN_OUT, clamp01, lerp, ramp } from '../components/motion.ts';
import { C, FONT, LANE_COLOR } from '../data/theme.ts';
import { FPS, ROUTER_BEATS as RB } from '../data/timeline.ts';
import { DECISIONS, DWELL, ROUTER_MIX, ROUTES, TRAVEL_OUT, type Decision } from '../data/router.config.ts';

const CX = 820;
const CY = 540;
const R = 128;
const IN_X = 150;
const NODE_X = 1290;
const TRAVEL_IN = 0.5;

export function spawnTime(i: number): number {
  const W = 6.0;
  return RB.flowStart + W * Math.pow(i / 99, 0.72);
}

function route(d: Decision) {
  return ROUTES.find((r) => r.id === d.route)!;
}

// cubic from router edge to the destination node
function outPoint(y: number, u: number): [number, number] {
  const x0 = CX + R;
  const y0 = CY;
  const x3 = NODE_X;
  const y3 = y;
  const x1 = x0 + 160;
  const y1 = y0;
  const x2 = x3 - 200;
  const y2 = y3;
  const a = 1 - u;
  return [
    a * a * a * x0 + 3 * a * a * u * x1 + 3 * a * u * u * x2 + u * u * u * x3,
    a * a * a * y0 + 3 * a * a * u * y1 + 3 * a * u * u * y2 + u * u * u * y3,
  ];
}

type Phase = { d: Decision; x: number; y: number; stage: 'in' | 'router' | 'out' | 'done'; dwellU: number; arrive: number };

function phaseAt(d: Decision, t: number): Phase | null {
  const s = spawnTime(d.i);
  if (t < s) return null;
  const tIn = s + TRAVEL_IN;
  const tDw = tIn + DWELL[d.route];
  const tOut = tDw + TRAVEL_OUT[d.route];
  const ry = route(d).y;
  if (t < tIn) {
    const u = EASE((t - s) / TRAVEL_IN);
    return { d, x: lerp(IN_X, CX - R, u), y: CY, stage: 'in', dwellU: 0, arrive: tOut };
  }
  if (t < tDw) return { d, x: CX, y: CY, stage: 'router', dwellU: (t - tIn) / DWELL[d.route], arrive: tOut };
  if (t < tOut) {
    const [x, y] = outPoint(ry, EASE((t - tDw) / TRAVEL_OUT[d.route]));
    return { d, x, y, stage: 'out', dwellU: 1, arrive: tOut };
  }
  return { d, x: NODE_X, y: ry, stage: 'done', dwellU: 1, arrive: tOut };
}

const TELEMETRY: Array<{ key: keyof Decision | 'cost'; label: string; angle: number; fmt: (d: Decision) => string; norm: (d: Decision) => number }> = [
  { key: 'latencyMs', label: 'latency', angle: -155, fmt: (d) => (d.latencyMs >= 1000 ? `${(d.latencyMs / 1000).toFixed(1)} s` : `${d.latencyMs} ms`), norm: (d) => Math.min(1, Math.log10(d.latencyMs / 50) / 2.4) },
  { key: 'ambiguity', label: 'ambiguity', angle: -112, fmt: (d) => d.ambiguity.toFixed(2), norm: (d) => d.ambiguity },
  { key: 'horizon', label: 'horizon', angle: -66, fmt: (d) => `${d.horizon} step${d.horizon > 1 ? 's' : ''}`, norm: (d) => d.horizon / 8 },
  { key: 'confidence', label: 'confidence', angle: 155, fmt: (d) => d.confidence.toFixed(2), norm: (d) => d.confidence },
  { key: 'valueAtRisk', label: 'value at risk', angle: 112, fmt: (d) => (d.valueAtRisk > 0.7 ? 'high' : d.valueAtRisk > 0.3 ? 'medium' : 'low'), norm: (d) => d.valueAtRisk },
  { key: 'cost', label: 'cost of reasoning', angle: 66, fmt: (d) => (d.cost > 0.8 ? 'high' : d.cost > 0.1 ? 'low' : '≈ 0'), norm: (d) => d.cost },
];

export const Scene05Router: React.FC = () => {
  const t = useCurrentFrame() / FPS;
  const enter = ramp(t, 0, 0.8);
  const exit = ramp(t, 13.5, 14, EASE_IN_OUT);
  const phases = DECISIONS.map((d) => phaseAt(d, t)).filter(Boolean) as Phase[];
  // decision currently in (or last through) the router drives the telemetry
  const inRouter = phases.filter((p) => p.stage === 'router');
  const current = inRouter.length ? inRouter[inRouter.length - 1].d : [...phases].reverse().find((p) => p.stage !== 'in')?.d ?? null;
  const deliberating = inRouter.find((p) => p.d.route === 'opus');
  const counts = { jev: 0, haiku: 0, opus: 0 };
  for (const p of phases) if (p.stage === 'done') counts[p.d.route]++;
  const reveal = ramp(t, RB.reveal, RB.reveal + 0.8);
  const lastPass = phases.filter((p) => p.stage !== 'in').map((p) => spawnTime(p.d.i) + TRAVEL_IN).reduce((a, x) => Math.max(a, x), -9);
  const ringPulse = clamp01(1 - (t - lastPass) / 0.35);
  const flowFade = 1 - ramp(t, RB.reveal - 0.2, RB.reveal + 0.4);
  return (
    <AbsoluteFill style={{ opacity: enter * (1 - exit) }}>
      <Background />
      <div style={{ position: 'absolute', left: 120, top: 70 }}>
        <Reveal p={ramp(t, 0.1, 0.8)}><Label size={20} color={C.text2}>the architecture</Label></Reveal>
      </div>
      <svg width={1920} height={1080} style={{ position: 'absolute' }}>
        {/* input */}
        <line x1={IN_X} y1={CY} x2={CX - R} y2={CY} stroke={C.line2} strokeWidth={1} strokeDasharray={`${ramp(t, 0.2, 1.0) * 700} 2000`} />
        <circle cx={IN_X} cy={CY} r={4} fill={C.text2} opacity={ramp(t, 0.2, 0.5)} />
        {/* routes */}
        {ROUTES.map((r, k) => {
          const pts = Array.from({ length: 41 }, (_, i) => outPoint(r.y, i / 40));
          const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'} ${x} ${y}`).join(' ');
          const w = 1.1 + counts[r.id] * (r.id === 'jev' ? 0.03 : 0.12);
          return (
            <g key={r.id}>
              <path d={d} fill="none" stroke={LANE_COLOR[r.id]} strokeOpacity={0.35 + 0.25 * reveal} strokeWidth={w} pathLength={1} strokeDasharray={`${ramp(t, 0.6 + k * 0.15, 1.4 + k * 0.15)} 2`} />
              <circle cx={NODE_X} cy={r.y} r={6} fill={LANE_COLOR[r.id]} opacity={ramp(t, 1.0 + k * 0.15, 1.4 + k * 0.15)} />
            </g>
          );
        })}
        {/* router ring */}
        <circle cx={CX} cy={CY} r={R} fill="rgba(255,255,255,0.02)" stroke={C.line2} strokeWidth={1.2} pathLength={1} strokeDasharray={`${ramp(t, 0.3, 1.2)} 2`} />
        <circle cx={CX} cy={CY} r={R + 18 + 26 * (1 - ringPulse)} fill="none" stroke={current ? LANE_COLOR[current.route] : C.text} strokeOpacity={0.35 * ringPulse * flowFade} />
        {deliberating && (
          <circle cx={CX} cy={CY} r={R - 10} fill="none" stroke={C.opus} strokeWidth={2.5} pathLength={1}
            strokeDasharray={`${deliberating.dwellU} 2`} transform={`rotate(-90 ${CX} ${CY})`} />
        )}
        {/* decisions */}
        {phases.filter((p) => p.stage !== 'done').map((p) => {
          const col = p.stage === 'in' ? C.text : LANE_COLOR[p.d.route];
          const r = p.d.route === 'opus' && p.stage !== 'in' ? 7 : p.d.route === 'haiku' && p.stage !== 'in' ? 5.5 : 4.5;
          return <circle key={p.d.i} cx={p.x} cy={p.y} r={r} fill={col} opacity={0.95 * flowFade} />;
        })}
      </svg>
      {/* router label */}
      <div style={{ position: 'absolute', left: CX - 120, width: 240, top: CY - 30, textAlign: 'center', opacity: ramp(t, 0.6, 1.2) }}>
        <div style={{ fontFamily: FONT.display, fontSize: 22, fontWeight: 600, letterSpacing: '0.18em', color: C.text, lineHeight: '30px' }}>COMPLEXITY<br />ROUTER</div>
      </div>
      {/* telemetry */}
      {TELEMETRY.map((m, k) => {
        const a = (m.angle * Math.PI) / 180;
        const x = CX + Math.cos(a) * 262;
        const y = CY + Math.sin(a) * 236;
        const right = Math.cos(a) < 0;
        const op = ramp(t, 0.9 + k * 0.1, 1.5 + k * 0.1) * (1 - reveal * 0.6);
        const v = current ? m.norm(current) : 0;
        const col = current ? LANE_COLOR[current.route] : C.text;
        return (
          <div key={m.label} style={{ position: 'absolute', left: right ? x - 230 : x, top: y - 30, width: 230, textAlign: right ? 'right' : 'left', opacity: op }}>
            <Label size={17} color={C.text2}>{m.label}</Label>
            <div style={{ display: 'flex', flexDirection: right ? 'row-reverse' : 'row', alignItems: 'center', gap: 12, marginTop: 6 }}>
              <div style={{ width: 90, height: 3, background: C.line, position: 'relative' }}>
                <div style={{ position: 'absolute', [right ? 'right' : 'left']: 0, top: 0, height: 3, width: `${v * 100}%`, background: col, opacity: 0.85 }} />
              </div>
              <span style={{ fontFamily: FONT.mono, fontSize: 19, color: C.text, minWidth: 92, textAlign: right ? 'right' : 'left' }}>{current ? m.fmt(current) : '—'}</span>
            </div>
          </div>
        );
      })}
      {/* destinations */}
      {ROUTES.map((r, k) => {
        const op = ramp(t, 1.0 + k * 0.15, 1.5 + k * 0.15);
        const pct = ROUTER_MIX[r.id];
        return (
          <div key={r.id}>
            <div style={{ position: 'absolute', left: NODE_X + 34, top: r.y - 34, opacity: op }}>
              <div style={{ fontFamily: FONT.display, fontSize: 30, fontWeight: 600, letterSpacing: '0.1em', color: LANE_COLOR[r.id] }}>{r.name}</div>
              <Label size={17} color={C.text2} style={{ marginTop: 2 }}>{r.role}</Label>
            </div>
            <div style={{ position: 'absolute', right: 96, top: r.y - 64, textAlign: 'right', opacity: op }}>
              <div style={{ opacity: 1 - reveal, position: 'absolute', right: 0, top: 30 }}>
                <Num size={44} weight={300} color={C.text}>{counts[r.id]}</Num>
              </div>
              <div style={{ opacity: reveal, transform: `translateY(${(1 - EASE(reveal)) * 16}px)` }}>
                <Num size={r.id === 'jev' ? 128 : 96} weight={r.id === 'jev' ? 300 : 200} color={LANE_COLOR[r.id]}>{`${pct}%`}</Num>
              </div>
            </div>
          </div>
        );
      })}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 880, textAlign: 'center' }}>
        <Reveal p={ramp(t, RB.message, RB.message + 0.7)}><Display size={48} weight={600}>EXPENSIVE REASONING IS THE EXCEPTION,</Display></Reveal>
        <Reveal p={ramp(t, RB.message + 0.15, RB.message + 0.85)}><Display size={48} weight={300} color={C.text2}>NOT THE DEFAULT.</Display></Reveal>
      </div>
      <div style={{ position: 'absolute', right: 120, top: 76, opacity: ramp(t, 1.4, 2.0) }}>
        <Label size={16} color={C.text3}>illustrative routing mix · 100 simulated decisions</Label>
      </div>
    </AbsoluteFill>
  );
};
