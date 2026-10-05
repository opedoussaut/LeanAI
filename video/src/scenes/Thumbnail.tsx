import { AbsoluteFill } from 'remotion';
import { Background } from '../components/Background.tsx';
import { BoardView, findHoles } from '../components/BoardView.tsx';
import { Fonts } from '../components/Fonts.tsx';
import { Label } from '../components/Type.tsx';
import { C, FONT } from '../data/theme.ts';
import { END_T, laneView, reflexLanes } from '../simulation/playback.ts';
import { planning } from '../simulation/planPlayback.ts';
import type { Board } from '../simulation/core.ts';

// LinkedIn thumbnail. The point is the paradigm, not "small beats big":
// same models, the problem changes, the winner changes. Every board is a real end state from the film.
const CELL = 17;

const Mini: React.FC<{ title: string; sub: string; color: string; board: Board; value: string; unit: string; win: boolean; holes?: boolean; out?: boolean; id: string }> = ({
  title, sub, color, board, value, unit, win, holes, out, id,
}) => (
  <div style={{ width: CELL * 10 }}>
    <div style={{ fontFamily: FONT.display, fontSize: 24, fontWeight: 600, letterSpacing: '0.08em', color, whiteSpace: 'nowrap' }}>{title}</div>
    <Label size={16} color={C.text3} style={{ marginTop: 4, whiteSpace: 'nowrap' }}>{sub}</Label>
    <div style={{ marginTop: 14, position: 'relative' }}>
      <BoardView id={id} board={board} cell={CELL} color={color} dim={win ? 0 : 0.5} holes={holes ? findHoles(board) : []} holeOpacity={holes ? 1 : 0} />
      {out && (
        <div style={{ position: 'absolute', left: 0, top: 160, width: CELL * 10, textAlign: 'center' }}>
          <span style={{ fontFamily: FONT.mono, fontSize: 18, fontWeight: 500, letterSpacing: '0.16em', color: C.text, background: C.bg, padding: '6px 10px' }}>TOPPED OUT</span>
        </div>
      )}
    </div>
    <div style={{ marginTop: 12, display: 'flex', alignItems: 'baseline', gap: 10 }}>
      <span style={{ fontFamily: FONT.display, fontSize: 46, fontWeight: win ? 600 : 300, color: win ? C.text : C.text2, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
      <Label size={18} color={C.text3}>{unit}</Label>
    </div>
  </div>
);

export const Thumbnail: React.FC = () => {
  const lanes = reflexLanes();
  const jev = laneView(lanes[0], END_T);
  const opus = laneView(lanes[2], END_T);
  const P = planning();
  const localEnd = P.local[P.local.length - 1].boardAfter;
  const planEnd = P.policy[P.policy.length - 1].boardAfter;
  return (
    <AbsoluteFill>
      <Fonts />
      <Background />
      {/* headline */}
      <div style={{ position: 'absolute', left: 110, top: 78 }}>
        <div style={{ fontFamily: FONT.display, fontWeight: 700, fontSize: 108, lineHeight: 1.0, letterSpacing: '-0.035em', color: C.text }}>
          CHANGE THE PROBLEM.
        </div>
        <div style={{ fontFamily: FONT.display, fontWeight: 700, fontSize: 108, lineHeight: 1.0, letterSpacing: '-0.035em', color: C.text, marginTop: 6 }}>
          CHANGE THE <span style={{ color: C.jev }}>WIN</span><span style={{ color: C.opus }}>NER.</span>
        </div>
      </div>

      {/* panel 1 — reflex */}
      <div style={{ position: 'absolute', left: 110, top: 384, width: 760, height: 616, border: `1px solid ${C.line}`, borderRadius: 18, background: C.glass }}>
        <div style={{ position: 'absolute', left: 40, top: 30 }}>
          <Label size={20} color={C.text2}>test 01 · reflex</Label>
        </div>
        <div style={{ position: 'absolute', left: 40, top: 92, display: 'flex', gap: 60 }}>
          <Mini id="tj" title="JEV" sub="0.28 s per move" color={C.jev} board={jev.board} value={String(jev.lines)} unit="lines" win />
          <Mini id="to" title="OPUS 5.5" sub="5.99 s per move" color={C.opus} board={opus.board} value={String(opus.lines)} unit="lines" win={false} out />
        </div>
        <div style={{ position: 'absolute', left: 470, top: 250, width: 260 }}>
          <div style={{ fontFamily: FONT.display, fontSize: 42, fontWeight: 700, color: C.jev, lineHeight: 1.05, whiteSpace: 'nowrap' }}>SYSTEM 1<br />WINS</div>
          <Label size={17} color={C.text2} style={{ marginTop: 14, lineHeight: '26px' }}>speed is<br />the problem</Label>
        </div>
      </div>

      {/* arrow */}
      <svg width={120} height={60} style={{ position: 'absolute', left: 900, top: 662 }}>
        <line x1={6} y1={30} x2={104} y2={30} stroke={C.text2} strokeWidth={2} />
        <path d="M 92 18 L 106 30 L 92 42" fill="none" stroke={C.text2} strokeWidth={2} />
      </svg>

      {/* panel 2 — planning */}
      <div style={{ position: 'absolute', left: 1050, top: 384, width: 760, height: 616, border: `1px solid ${C.opus}55`, borderRadius: 18, background: 'rgba(158,220,255,0.03)' }}>
        <div style={{ position: 'absolute', left: 40, top: 30 }}>
          <Label size={20} color={C.opus}>test 02 · planning</Label>
        </div>
        <div style={{ position: 'absolute', left: 40, top: 92, display: 'flex', gap: 60 }}>
          <Mini id="tl" title="JEV ALONE" sub="sees 1 piece" color={C.trap} board={localEnd} value={String(P.localEnd.holes)} unit="holes" win={false} holes />
          <Mini id="tp" title="OPUS PLAN" sub="sees 8 · jev executes" color={C.opus} board={planEnd} value={String(P.policyEnd.holes)} unit="holes" win />
        </div>
        <div style={{ position: 'absolute', left: 470, top: 250, width: 260 }}>
          <div style={{ fontFamily: FONT.display, fontSize: 42, fontWeight: 700, color: C.opus, lineHeight: 1.05, whiteSpace: 'nowrap' }}>PLANNING<br />WINS</div>
          <Label size={17} color={C.text2} style={{ marginTop: 14, lineHeight: '26px' }}>context is<br />the problem</Label>
        </div>
      </div>
    </AbsoluteFill>
  );
};
