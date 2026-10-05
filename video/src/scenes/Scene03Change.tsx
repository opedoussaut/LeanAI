import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { Background } from '../components/Background.tsx';
import { BoardView } from '../components/BoardView.tsx';
import { MiniPiece } from '../components/MiniPiece.tsx';
import { Display, Label, Num, Reveal } from '../components/Type.tsx';
import { EASE_IN_OUT, lerp, ramp } from '../components/motion.ts';
import { C, FONT } from '../data/theme.ts';
import { FPS } from '../data/timeline.ts';
import { PLANNING } from '../data/planning.config.ts';
import { laneView, reflexLanes, END_T } from '../simulation/playback.ts';
import { planning } from '../simulation/planPlayback.ts';

// Board placement at the end of scene 02 (Jev isolated) and at the start of scene 04.
// lane container at x=630 scaled 1.06 about (0,600): board top-left (-235,318) -> (630-249.1, 600-(282*1.06))
export const FROM = { x: 630 - 235 * 1.06, y: 600 - 282 * 1.06, cell: 28 * 1.06 };
export const MID = { x: 960 - 5 * 23, y: 540 - 10 * 23, cell: 23 };
export const TO = { x: 420, y: 290, cell: 30 };

export const Scene03Change: React.FC = () => {
  const t = useCurrentFrame() / FPS;
  const jev = reflexLanes()[0];
  const frozen = laneView(jev, END_T).board;
  const plan = planning();
  const pull = ramp(t, 0.35, 1.7, EASE_IN_OUT);
  const toNext = ramp(t, 4.25, 5.0, EASE_IN_OUT);
  const cell = lerp(lerp(FROM.cell, MID.cell, pull), TO.cell, toNext);
  const x = lerp(lerp(FROM.x, MID.x, pull), TO.x, toNext);
  const y = lerp(lerp(FROM.y, MID.y, pull), TO.y, toNext);
  const swap = ramp(t, 1.9, 2.7, EASE_IN_OUT);
  const panels = (k: number) => ramp(t, 1.05 + k * 0.22, 1.75 + k * 0.22) * (1 - toNext);
  const queue = plan.scenario.queue.slice(1, 1 + PLANNING.horizon);
  // History: Jev's cleared-lines trace through the whole reflex run
  const hist = jev.events.filter((_, i) => i % 3 === 0).map((e) => e.linesAfter);
  const maxH = Math.max(...hist, 1);
  const path = hist.map((v, i) => `${i === 0 ? 'M' : 'L'} ${(i / (hist.length - 1)) * 260} ${60 - (v / maxH) * 56}`).join(' ');
  return (
    <AbsoluteFill>
      <Background />
      {/* board: frozen reflex state cross-fades into the planning state */}
      <div style={{ position: 'absolute', left: x, top: y }}>
        <div style={{ position: 'absolute', opacity: 1 - swap }}>
          <BoardView id="s3a" board={frozen} cell={cell} color={C.jev} />
        </div>
        <div style={{ position: 'absolute', opacity: swap }}>
          <BoardView id="s3b" board={plan.scenario.board} cell={cell} color={C.jev} />
        </div>
      </div>
      {/* NEXT */}
      <div style={{ position: 'absolute', left: 1200, top: 300, opacity: panels(0) }}>
        <Label size={18} color={C.text2}>next</Label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 66px)', rowGap: 6, columnGap: 10, marginTop: 14 }}>
          {queue.map((p, i) => (
            <div key={i} style={{ opacity: ramp(t, 1.2 + i * 0.07, 1.6 + i * 0.07) }}>
              <MiniPiece type={p} cell={15} color={C.text} opacity={0.8 - i * 0.05} />
            </div>
          ))}
        </div>
      </div>
      {/* HOLD + HORIZON */}
      <div style={{ position: 'absolute', left: 1490, top: 300, opacity: panels(1) }}>
        <Label size={18} color={C.text2}>hold</Label>
        <div style={{ marginTop: 14, width: 118, height: 74, border: `1px dashed ${C.line2}`, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Label size={15} color={C.text3}>available</Label>
        </div>
      </div>
      <div style={{ position: 'absolute', left: 1490, top: 530, opacity: panels(2) }}>
        <Label size={18} color={C.text2}>horizon</Label>
        <div style={{ marginTop: 6 }}>
          <Num size={64} weight={200}>{PLANNING.horizon}</Num>
          <span style={{ fontFamily: FONT.mono, fontSize: 18, color: C.text2, marginLeft: 10, letterSpacing: '0.14em' }}>PIECES</span>
        </div>
      </div>
      {/* OBJECTIVE */}
      <div style={{ position: 'absolute', right: 1920 - 690, top: 320, textAlign: 'right', opacity: panels(3) }}>
        <Label size={18} color={C.text2}>objective</Label>
        {PLANNING.objective.map((o) => (
          <div key={o} style={{ fontFamily: FONT.display, fontSize: 28, fontWeight: 600, color: C.text, marginTop: 10, letterSpacing: '0.02em' }}>{o}</div>
        ))}
      </div>
      {/* HISTORY */}
      <div style={{ position: 'absolute', right: 1920 - 690, top: 560, textAlign: 'right', opacity: panels(4) }}>
        <Label size={18} color={C.text2}>history</Label>
        <svg width={260} height={64} style={{ marginTop: 12 }}>
          <path d={path} fill="none" stroke={C.jev} strokeWidth={1.5} opacity={0.8} strokeDasharray={600} strokeDashoffset={600 * (1 - panels(4))} />
        </svg>
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 856, textAlign: 'center' }}>
        <Reveal p={ramp(t, 2.3, 3.0)} out={toNext}>
          <Display size={64} weight={600}>THEN THE PROBLEM CHANGES.</Display>
        </Reveal>
      </div>
    </AbsoluteFill>
  );
};
