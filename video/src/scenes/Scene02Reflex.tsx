import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { Background } from '../components/Background.tsx';
import { BoardView } from '../components/BoardView.tsx';
import { Display, Label, Num, Reveal } from '../components/Type.tsx';
import { EASE_IN_OUT, ramp } from '../components/motion.ts';
import { C, FONT } from '../data/theme.ts';
import { FPS, REFLEX_PLAYBACK } from '../data/timeline.ts';
import { REFERENCE } from '../data/reflex.config.ts';
import { laneView, reflexLanes, simTimeAt, speedAt } from '../simulation/playback.ts';
import { LANE_X } from './Scene01Question.tsx';

const CELL = 28;
const BOARD_TOP = 318;
const META = [
  { key: 'jev', ref: REFERENCE.jev, color: C.jev },
  { key: 'haiku', ref: REFERENCE.haiku, color: C.haiku },
  { key: 'opus', ref: REFERENCE.opus, color: C.opus },
] as const;

const Metric: React.FC<{ label: string; value: string; color?: string; accent?: number }> = ({ label, value, color = C.text, accent = 0 }) => (
  <div style={{ marginBottom: 22 }}>
    <Label size={18} color={C.text3}>{label}</Label>
    <Num size={40} weight={300} color={accent > 0 ? C.trap : color} style={{ display: 'block', marginTop: 2 }}>{value}</Num>
  </div>
);

export const Lane: React.FC<{ i: number; t: number; T: number; flashSec: number; showMetrics?: number }> = ({ i, t, T, flashSec, showMetrics = 1 }) => {
  const m = META[i];
  const lane = reflexLanes()[i];
  const v = laneView(lane, T, flashSec);
  const appear = ramp(t, 0.15 + i * 0.12, 0.9 + i * 0.12);
  const topped = v.toppedOut ? ramp(T - (lane.topOutT ?? 0), 0, 1.2) : 0;
  return (
    <div style={{ position: 'absolute', left: -235, top: 0, width: 470 }}>
      {/* header */}
      <div style={{ position: 'absolute', top: 200, left: 0, width: 470, opacity: appear }}>
        <div style={{ fontFamily: FONT.display, fontSize: 30, fontWeight: 600, letterSpacing: '0.1em', color: m.color }}>{m.ref.label}</div>
        <Label size={17} color={C.text2} style={{ marginTop: 4 }}>{m.ref.role}</Label>
      </div>
      {/* decision timer */}
      <div style={{ position: 'absolute', top: 292, left: 0, width: 280, height: 2, background: C.line, opacity: appear }}>
        <div style={{ height: 2, width: `${Math.min(1, v.thinking ?? 0) * 100}%`, background: v.lateFlash > 0 ? C.trap : m.color, opacity: v.thinking === null ? 0 : 0.9 }} />
      </div>
      {/* board */}
      <div style={{ position: 'absolute', top: BOARD_TOP, left: 0, opacity: appear }}>
        <BoardView id={`lane${i}`} board={v.board} cell={CELL} color={m.color} active={v.active} ghosts={v.ghost ? [{ ...v.ghost, opacity: 0.6 }] : []}
          flashRows={v.flashRows} flash={v.flash} dim={topped * 0.62} />
        {v.lateFlash > 0 && !v.toppedOut && (
          <div style={{ position: 'absolute', top: 18, left: 0, width: 280, textAlign: 'center', opacity: v.lateFlash }}>
            <Label size={18} color={C.trap}>too late</Label>
          </div>
        )}
        {v.toppedOut && (
          <div style={{ position: 'absolute', top: 250, left: 0, width: 280, textAlign: 'center', opacity: topped }}>
            <Label size={20} color={C.text}>topped out</Label>
            <Label size={17} color={C.text2} style={{ marginTop: 8 }}>{`level ${v.level}`}</Label>
          </div>
        )}
      </div>
      {/* metrics */}
      <div style={{ position: 'absolute', top: BOARD_TOP - 6, left: 302, width: 168, opacity: appear * showMetrics }}>
        <Metric label="decision" value={`${m.ref.latency.toFixed(2)} s`} color={m.color} />
        <Metric label="too late" value={String(v.tooLate)} accent={v.lateFlash} />
        <Metric label="lines" value={String(v.lines)} />
        <Metric label="level" value={String(v.level)} />
      </div>
    </div>
  );
};

export const Scene02Reflex: React.FC = () => {
  const t = useCurrentFrame() / FPS;
  const P = REFLEX_PLAYBACK;
  const T = simTimeAt(t);
  const speed = speedAt(t);
  const flashSec = 0.2 * Math.max(1, speed * 0.7);
  const iso = ramp(t, P.isolateSec, P.isolateSec + 1.1, EASE_IN_OUT);
  const enter = ramp(t, 0, 0.6);
  const exit = ramp(t, 15.55, 16, EASE_IN_OUT);
  return (
    <AbsoluteFill>
      <Background />
      {/* title */}
      <div style={{ position: 'absolute', left: 120, top: 70, opacity: (1 - iso * 0.75) * (1 - exit) }}>
        <Reveal p={ramp(t, 0.1, 0.8)}><Label size={20} color={C.jev}>test 01</Label></Reveal>
        <Reveal p={ramp(t, 0.25, 0.95)}><Display size={64} weight={700}>REFLEX</Display></Reveal>
      </div>
      <div style={{ position: 'absolute', right: 120, top: 78, textAlign: 'right', opacity: (1 - iso) * (1 - exit) }}>
        {['local state', 'low ambiguity', 'high decision frequency'].map((x, k) => (
          <Reveal key={x} p={ramp(t, 0.5 + k * 0.15, 1.2 + k * 0.15)}><Label size={18} color={C.text2} style={{ lineHeight: '30px' }}>{x}</Label></Reveal>
        ))}
      </div>
      {/* lanes */}
      {[0, 1, 2].map((i) => {
        const isJev = i === 0;
        const x = isJev ? LANE_X[0] + iso * 230 : LANE_X[i] + iso * 220;
        const op = isJev ? 1 : 1 - iso;
        const sc = isJev ? 1 + iso * 0.06 : 1;
        return (
          <div key={i} style={{ position: 'absolute', left: x, top: 0, opacity: op * enter * (1 - exit * (isJev ? 0 : 1)), transform: `scale(${sc})`, transformOrigin: '0px 600px' }}>
            <Lane i={i} t={t} T={T} flashSec={flashSec} />
          </div>
        );
      })}
      {/* verdict */}
      <div style={{ position: 'absolute', left: 1130, top: 410, opacity: 1 - exit }}>
        <Reveal p={ramp(t, P.isolateSec + 0.6, P.isolateSec + 1.4)}><Display size={104} weight={700}>SYSTEM 1</Display></Reveal>
        <Reveal p={ramp(t, P.isolateSec + 0.75, P.isolateSec + 1.55)}><Display size={104} weight={700} color={C.jev}>WINS.</Display></Reveal>
        <div style={{ display: 'flex', gap: 34, marginTop: 40 }}>
          {['fast', 'deterministic', 'cheap'].map((w, k) => (
            <Reveal key={w} p={ramp(t, P.isolateSec + 1.5 + k * 0.22, P.isolateSec + 2.2 + k * 0.22)}>
              <Label size={22} color={C.text2}>{w}</Label>
            </Reveal>
          ))}
        </div>
      </div>
      {/* footer */}
      <div style={{ position: 'absolute', left: 120, bottom: 62, opacity: ramp(t, 1.0, 1.6) * (1 - iso) }}>
        <Label size={16} color={C.text3}>seeded replay · same pieces · same rules · same evaluator · only latency differs</Label>
      </div>
      <div style={{ position: 'absolute', right: 120, bottom: 62, opacity: ramp(t, 1.0, 1.6) * (1 - exit), textAlign: 'right' }}>
        <Label size={16} color={C.text3}>{speed > 0 ? `replay ×${speed < 1.05 ? '1' : Math.round(speed)}` : 'replay complete'}</Label>
      </div>
    </AbsoluteFill>
  );
};
