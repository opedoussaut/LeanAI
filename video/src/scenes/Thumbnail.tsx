import { AbsoluteFill } from 'remotion';
import { Background } from '../components/Background.tsx';
import { BoardView } from '../components/BoardView.tsx';
import { Fonts } from '../components/Fonts.tsx';
import { Label } from '../components/Type.tsx';
import { C, FONT } from '../data/theme.ts';
import { REFERENCE } from '../data/reflex.config.ts';
import { END_T, laneView, reflexLanes } from '../simulation/playback.ts';

// LinkedIn thumbnail: final state of TEST 01, straight from the seeded replay.
const CELL = 24;
const LANES = [
  { ref: REFERENCE.jev, color: C.jev },
  { ref: REFERENCE.haiku, color: C.haiku },
  { ref: REFERENCE.opus, color: C.opus },
];

export const Thumbnail: React.FC = () => {
  const lanes = reflexLanes();
  return (
    <AbsoluteFill>
      <Fonts />
      <Background />
      {/* glow behind Jev */}
      <div style={{ position: 'absolute', left: 1010, top: 260, width: 420, height: 640, background: `radial-gradient(closest-side, ${C.jev}22, transparent)` }} />
      {/* headline */}
      <div style={{ position: 'absolute', left: 110, top: 150, width: 860 }}>
        <Label size={24} color={C.jev}>leanai · same game · same rules</Label>
        <div style={{ fontFamily: FONT.display, fontWeight: 700, fontSize: 138, lineHeight: 0.98, letterSpacing: '-0.035em', color: C.text, marginTop: 34 }}>
          THE BIGGEST<br />MODEL<br /><span style={{ color: C.opus }}>LOST.</span>
        </div>
        <div style={{ fontFamily: FONT.display, fontWeight: 300, fontSize: 50, color: C.text2, marginTop: 44, letterSpacing: '-0.01em' }}>
          Until the problem changed.
        </div>
      </div>
      {/* three lanes, final replay state */}
      {LANES.map((l, i) => {
        const v = laneView(lanes[i], END_T);
        const x = 1010 + i * 290;
        const isJev = i === 0;
        return (
          <div key={i} style={{ position: 'absolute', left: x, top: 200, width: 240, opacity: isJev ? 1 : 0.92 }}>
            <div style={{ fontFamily: FONT.display, fontSize: 26, fontWeight: 600, letterSpacing: '0.1em', color: l.color, whiteSpace: 'nowrap' }}>
              {l.ref.label.replace(' · HIGH', '')}
            </div>
            <div style={{ fontFamily: FONT.display, fontSize: 64, fontWeight: isJev ? 400 : 200, color: l.color, fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>
              {l.ref.latency.toFixed(2)}<span style={{ fontSize: 30, opacity: 0.7, marginLeft: 4 }}>s</span>
            </div>
            <div style={{ marginTop: 18, position: 'relative' }}>
              <BoardView id={`th${i}`} board={v.board} cell={CELL} color={l.color} dim={v.toppedOut ? 0.55 : 0} />
              {v.toppedOut && (
                <div style={{ position: 'absolute', left: 0, top: 200, width: 240, textAlign: 'center' }}>
                  <span style={{ fontFamily: FONT.mono, fontSize: 22, fontWeight: 500, letterSpacing: '0.18em', color: C.text, background: C.bg, padding: '8px 12px' }}>TOPPED OUT</span>
                </div>
              )}
            </div>
            <div style={{ marginTop: 18, display: 'flex', alignItems: 'baseline', gap: 12 }}>
              <span style={{ fontFamily: FONT.display, fontSize: 52, fontWeight: isJev ? 600 : 300, color: isJev ? C.text : C.text2, fontVariantNumeric: 'tabular-nums' }}>{v.lines}</span>
              <Label size={20} color={C.text3}>lines</Label>
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
