import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { Background } from '../components/Background.tsx';
import { BoardView, findHoles } from '../components/BoardView.tsx';
import { MiniPiece } from '../components/MiniPiece.tsx';
import { Display, Label, Num, Reveal } from '../components/Type.tsx';
import { EASE_IN, EASE_IN_OUT, clamp01, lerp, ramp } from '../components/motion.ts';
import { C, FONT } from '../data/theme.ts';
import { FPS, PLANNING_BEATS as B } from '../data/timeline.ts';
import { PLANNING } from '../data/planning.config.ts';
import { SPAWN_COL, columnHeights } from '../simulation/core.ts';
import { WELL_COL } from '../simulation/planning.ts';
import { planning, stepsView } from '../simulation/planPlayback.ts';
import { TO } from './Scene03Change.tsx';

const CELL = TO.cell;
const BX = TO.x;
const BY = TO.y;
const BW = CELL * 10;

const Row: React.FC<{ label: string; value: string; p: number; color?: string }> = ({ label, value, p, color = C.text }) => (
  <Reveal p={p}>
    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'baseline', gap: 26, height: 44 }}>
      <Label size={18} color={C.text2}>{label}</Label>
      <span style={{ fontFamily: FONT.display, fontSize: 30, fontWeight: 600, color, minWidth: 150, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  </Reveal>
);

export const Scene04Planning: React.FC = () => {
  const t = useCurrentFrame() / FPS;
  const P = planning();
  const s0 = P.scenario.board;
  const first = P.local[0];
  const fp = first.placement!;
  const exit = ramp(t, 16.6, 17.0, EASE_IN_OUT);

  // ---------------------------------------------------------------- board state machine
  let board = s0;
  let active: Parameters<typeof BoardView>[0]['active'] = null;
  let ghosts: NonNullable<Parameters<typeof BoardView>[0]['ghosts']> = [];
  let flashRows: number[] = [];
  let flash = 0;
  let color = C.jev;
  let holeOp = 0;
  let holes: Array<[number, number]> = [];
  const preview = t >= B.futureStart && t < B.rewind;
  if (t < B.localDrop) {
    active = t > B.candidate - 0.6 ? { type: first.piece, rot: 0, row: 0, col: SPAWN_COL, opacity: ramp(t, B.candidate - 0.6, B.candidate - 0.2) } : null;
    const g = ramp(t, B.candidate, B.candidate + 0.4);
    if (g > 0) ghosts = [{ type: first.piece, rot: fp.rot, row: fp.row, col: fp.col, glow: g * (0.6 + 0.4 * Math.sin(t * 7)), opacity: g, color: C.jev }];
  } else if (t < B.futureStart) {
    const u = clamp01((t - B.localDrop) / 0.35);
    if (u < 1) {
      const k = EASE_IN(u);
      active = { type: first.piece, rot: fp.rot, row: lerp(0, fp.row, k), col: lerp(SPAWN_COL, fp.col, Math.min(1, u * 2.5)) };
    } else {
      const f = 1 - clamp01((t - B.localDrop - 0.35) / 0.45);
      if (f > 0 && first.cleared.length) {
        board = first.boardLocked;
        flashRows = first.cleared;
        flash = f;
      } else board = first.boardAfter;
    }
  } else if (preview) {
    const v = stepsView(P.local.slice(1), first.boardAfter, t, B.futureStart, B.futureStep);
    board = v.board;
    flashRows = v.flashRows;
    flash = v.flash;
    if (v.active) ghosts = [{ ...v.active, color: C.text, opacity: 0.85 }];
    color = '#8FA6A0';
    holes = findHoles(board);
    holeOp = ramp(t, B.futureStart + 0.5, B.futureStart + 1.2);
  } else if (t < B.executeStart) {
    const back = ramp(t, B.rewind, B.rewind + 0.45, EASE_IN_OUT);
    const last = P.local[P.local.length - 1].boardAfter;
    board = back < 0.5 ? last : s0;
    holes = back < 0.5 ? findHoles(last) : [];
    holeOp = 1 - back * 2;
    color = back < 0.5 ? '#8FA6A0' : C.jev;
  } else {
    const v = stepsView(P.policy, s0, t, B.executeStart, B.executeStep);
    board = v.board;
    active = v.active;
    flashRows = v.flashRows;
    flash = v.flash;
  }

  // ---------------------------------------------------------------- overlays
  const expand = ramp(t, B.expand, B.expand + 0.8, EASE_IN_OUT);
  const panelOut = ramp(t, B.verdict - 0.5, B.verdict, EASE_IN_OUT);
  const panel = expand * (1 - panelOut);
  const nStrat = PLANNING.strategy.length;
  const collapse = ramp(t, B.collapse, B.collapse + 0.45, EASE_IN_OUT);
  const queue = P.scenario.queue.slice(1, 1 + PLANNING.horizon);
  const heights = columnHeights(s0);
  const localEnd = P.localEnd;
  const policyEnd = P.policyEnd;
  const iStep = P.policy.findIndex((s) => s.piece === 'I' && s.cleared.length === 4);
  const iTime = B.executeStart + iStep * B.executeStep + B.executeStep * 0.62;
  const iPlayed = t >= iTime;
  const reserved = ramp(t, B.strategyStart + 2 * B.strategyStep, B.strategyStart + 2 * B.strategyStep + 0.4) * (1 - ramp(t, iTime, iTime + 0.3));
  const fourLine = ramp(t, iTime, iTime + 0.3) * (1 - ramp(t, B.verdict - 0.3, B.verdict));

  // reasoning pulse path through the context elements
  const pulse = ramp(t, B.expand + 0.6, B.strategyStart + 0.3, EASE_IN_OUT);
  const pathD = 'M 900 330 L 1560 330 L 1650 330 L 1650 470 L 1500 470 L 1150 470 L 960 470 L 960 600';
  const pathLen = 660 + 90 + 140 + 150 + 350 + 190 + 130;

  const captionOp = ramp(t, B.localDrop + 0.5, B.localDrop + 0.9) * (1 - ramp(t, B.futureStart - 0.1, B.futureStart + 0.2));
  const trapOp = ramp(t, B.futureStart + 1.6, B.futureStart + 2.1) * (1 - ramp(t, B.rewind, B.rewind + 0.3));

  return (
    <AbsoluteFill style={{ opacity: 1 - exit }}>
      <Background />
      {/* title */}
      <div style={{ position: 'absolute', left: 120, top: 70 }}>
        <Reveal p={ramp(t, 0.1, 0.8)}><Label size={20} color={C.opus}>test 02</Label></Reveal>
        <Reveal p={ramp(t, 0.25, 0.95)}><Display size={64} weight={700}>PLANNING</Display></Reveal>
      </div>
      <div style={{ position: 'absolute', right: 120, top: 70, opacity: 1 - expand * 0.65 }}>
        <Row label="temporal dependency" value="HIGH" p={ramp(t, 0.6, 1.2)} />
        <Row label="look-ahead" value={`${PLANNING.horizon} PIECES`} p={ramp(t, 0.85, 1.45)} />
        <Row label="local policy confidence" value={`${Math.round(P.confidence * 100)}%`} p={ramp(t, 1.1, 1.7)} color={C.haiku} />
      </div>

      {/* board header */}
      <div style={{ position: 'absolute', left: BX, top: BY - 66, width: 460 }}>
        <div style={{ opacity: 1 - ramp(t, B.collapse, B.collapse + 0.3) }}>
          <Label size={18} color={C.jev}>jev · system 1</Label>
          <Label size={17} color={C.text3} style={{ marginTop: 6 }}>horizon · 1 piece</Label>
        </div>
        <div style={{ position: 'absolute', top: 0, opacity: ramp(t, B.collapse + 0.2, B.collapse + 0.6) }}>
          <Label size={18} color={C.jev}>executor · jev</Label>
          <Label size={17} color={C.opus} style={{ marginTop: 6 }}>policy · opus 5.5</Label>
        </div>
      </div>

      {/* board */}
      <div style={{ position: 'absolute', left: BX, top: BY }}>
        <BoardView id="plan" board={board} cell={CELL} color={color} active={active} ghosts={ghosts} flashRows={flashRows} flash={flash}
          holes={holes} holeOpacity={holeOp} wellCol={WELL_COL} wellOpacity={ramp(t, B.expand + 0.8, B.expand + 1.3) * (1 - ramp(t, B.verdict, B.verdict + 0.4)) * (iPlayed ? 0.3 : 1)} />
      </div>

      {/* LOCAL BEST MOVE annotation */}
      <div style={{ position: 'absolute', left: BX + BW + 24, top: BY + fp.row * CELL + 10, opacity: ramp(t, B.candidate + 0.2, B.candidate + 0.6) * (1 - ramp(t, B.localDrop + 0.3, B.localDrop + 0.6)) }}>
        <svg width={60} height={2} style={{ position: 'absolute', left: -24, top: 13 }}><line x1={0} x2={60} y1={1} y2={1} stroke={C.jev} /></svg>
        <div style={{ marginLeft: 46 }}>
          <Label size={20} color={C.jev}>local best move</Label>
          <Label size={17} color={C.text2} style={{ marginTop: 6 }}>clears a line now</Label>
        </div>
      </div>
      <div style={{ position: 'absolute', left: BX + BW + 48, top: BY + 300, opacity: captionOp }}>
        <Label size={20} color={C.text}>correct</Label>
        <Label size={17} color={C.text2} style={{ marginTop: 6 }}>for what it can see</Label>
      </div>
      {/* preview label + FUTURE TRAP */}
      <div style={{ position: 'absolute', left: BX + BW + 48, top: BY + 40, opacity: ramp(t, B.futureStart, B.futureStart + 0.3) * (1 - ramp(t, B.rewind, B.rewind + 0.3)) }}>
        <Label size={18} color={C.text2}>preview · next 8 pieces · same local policy</Label>
      </div>
      <div style={{ position: 'absolute', left: BX + BW + 48, top: BY + 330, opacity: trapOp }}>
        <svg width={40} height={2} style={{ position: 'absolute', left: -48, top: 14 }}><line x1={0} x2={40} y1={1} y2={1} stroke={C.trap} /></svg>
        <Label size={24} color={C.trap}>future trap</Label>
        <Label size={18} color={C.text2} style={{ marginTop: 10 }}>{`${localEnd.holes} buried holes · height ${localEnd.maxHeight}`}</Label>
        <Label size={18} color={C.text2} style={{ marginTop: 6 }}>well consumed · I-piece wasted</Label>
      </div>

      {/* ------------------------------------------------ reasoning layer */}
      <div style={{ position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, opacity: panel }}>
        <svg width={1920} height={1080} style={{ position: 'absolute' }}>
          <line x1={BX + BW + 30} y1={BY + 20} x2={lerp(BX + BW + 30, 880, expand)} y2={BY + 20} stroke={C.line2} />
          <path d={pathD} fill="none" stroke={C.opus} strokeOpacity={0.12} strokeWidth={1} />
          <path d={pathD} fill="none" stroke={C.opus} strokeWidth={2} strokeLinecap="round"
            strokeDasharray={`120 ${pathLen}`} strokeDashoffset={120 - pulse * (pathLen + 120)} opacity={pulse > 0 && pulse < 1 ? 0.95 : 0} />
        </svg>
        {/* NEXT queue */}
        <div style={{ position: 'absolute', left: 900, top: 252 }}>
          <Label size={18} color={C.text2}>{`next · ${PLANNING.horizon}`}</Label>
          <div style={{ display: 'flex', gap: 14, marginTop: 12 }}>
            {queue.map((p, i) => {
              const lit = clamp01(1 - Math.abs(pulse * 8.5 - i) / 1.4);
              return (
                <div key={i} style={{ width: 66, borderBottom: `1px solid ${p === 'I' && reserved > 0 ? C.opus : C.line}`, paddingBottom: 6, position: 'relative' }}>
                  <MiniPiece type={p} cell={14} color={p === 'I' ? C.opus : C.text} opacity={0.55 + 0.45 * lit} box={4.6} />
                  {p === 'I' && (
                    <div style={{ position: 'absolute', top: 54, left: -20, width: 106, textAlign: 'center', opacity: reserved, whiteSpace: 'nowrap' }}>
                      <Label size={14} color={C.opus}>reserved</Label>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        {/* HOLD */}
        <div style={{ position: 'absolute', left: 1600, top: 252 }}>
          <Label size={18} color={C.text2}>hold</Label>
          <div style={{ marginTop: 12, width: 120, height: 64, border: `1px dashed ${C.line2}`, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Label size={15} color={C.text3}>available</Label>
          </div>
        </div>
        {/* horizon / topology / constraints */}
        <div style={{ position: 'absolute', left: 900, top: 420, display: 'flex', gap: 64 }}>
          <div>
            <Label size={18} color={C.text2}>horizon</Label>
            <Num size={44} weight={300} style={{ display: 'block', marginTop: 4 }}>{`${PLANNING.horizon} PIECES`}</Num>
          </div>
          <div>
            <Label size={18} color={C.text2}>board topology</Label>
            <svg width={200} height={56} style={{ marginTop: 10 }}>
              {heights.map((h, c) => (
                <rect key={c} x={c * 20 + 2} y={56 - h * 6} width={16} height={h * 6} fill={c === WELL_COL ? C.opus : C.text} fillOpacity={c === WELL_COL ? 0.9 : 0.35} />
              ))}
              {heights[WELL_COL] === 0 && <rect x={WELL_COL * 20 + 2} y={54} width={16} height={2} fill={C.opus} />}
            </svg>
          </div>
          <div>
            <Label size={18} color={C.text2}>constraint</Label>
            <div style={{ fontFamily: FONT.display, fontSize: 26, fontWeight: 600, color: C.text, marginTop: 10 }}>{`WELL · DEPTH ${P.scenario.board.filter((r) => r[WELL_COL] === 0 && r.every((x, c) => c === WELL_COL || x)).length}`}</div>
          </div>
        </div>
        {/* strategy formation */}
        <div style={{ position: 'absolute', left: 900, top: 586 }}>
          <Label size={18} color={C.opus} style={{ opacity: ramp(t, B.strategyStart - 0.3, B.strategyStart) }}>opus 5.5 · strategy layer</Label>
          <div style={{ marginTop: 18, position: 'relative', height: 250 }}>
            {PLANNING.strategy.map((line, i) => {
              const p = ramp(t, B.strategyStart + i * B.strategyStep, B.strategyStart + i * B.strategyStep + 0.5);
              const y = lerp(i * 58, 0, collapse);
              return (
                <div key={line} style={{ position: 'absolute', top: y, left: 0, opacity: Math.pow(1 - collapse, 3), display: 'flex', gap: 22, alignItems: 'baseline', whiteSpace: 'nowrap' }}>
                  <Reveal p={p}><Label size={18} color={C.text3}>{`0${i + 1}`}</Label></Reveal>
                  <Reveal p={p}><span style={{ fontFamily: FONT.display, fontSize: 38, fontWeight: 600, color: C.text, letterSpacing: '0.01em' }}>{line}</span></Reveal>
                </div>
              );
            })}
            <div style={{ position: 'absolute', top: 0, left: 0, opacity: ramp(t, B.collapse + 0.25, B.collapse + 0.6),
              border: `1px solid ${C.opus}`, borderRadius: 999, padding: '14px 30px', display: 'flex', gap: 18, alignItems: 'center', whiteSpace: 'nowrap' }}>
              <div style={{ width: 9, height: 9, borderRadius: 9, background: C.opus }} />
              <span style={{ fontFamily: FONT.display, fontSize: 32, fontWeight: 600, color: C.text, letterSpacing: '0.06em' }}>MACRO POLICY GENERATED</span>
            </div>
            <div style={{ position: 'absolute', top: 96, left: 4, whiteSpace: 'nowrap', opacity: ramp(t, B.collapse + 0.45, B.collapse + 0.8) }}>
              <Label size={17} color={C.text2}>{`${nStrat} rules · handed to the deterministic executor`}</Label>
            </div>
          </div>
        </div>
      </div>

      {/* 4-line clear + result */}
      <div style={{ position: 'absolute', left: BX + BW + 24, top: BY + 16 * CELL + 30, opacity: fourLine }}>
        <Label size={24} color={C.opus}>4-line clear</Label>
      </div>
      {/* verdict */}
      <div style={{ position: 'absolute', left: 900, top: 300 }}>
        <Reveal p={ramp(t, B.verdict, B.verdict + 0.7)}><Display size={104} weight={700}>PLANNING</Display></Reveal>
        <Reveal p={ramp(t, B.verdict + 0.12, B.verdict + 0.82)}><Display size={104} weight={700} color={C.opus}>WINS.</Display></Reveal>
        <div style={{ display: 'flex', gap: 48, marginTop: 34, opacity: ramp(t, B.verdict + 0.3, B.verdict + 0.8) }}>
          <div>
            <Label size={17} color={C.text3}>local branch</Label>
            <Label size={20} color={C.trap} style={{ marginTop: 6 }}>{`${localEnd.holes} holes · height ${localEnd.maxHeight}`}</Label>
          </div>
          <div>
            <Label size={17} color={C.text3}>planned branch</Label>
            <Label size={20} color={C.jev} style={{ marginTop: 6 }}>{`${policyEnd.holes} holes · height ${policyEnd.maxHeight}`}</Label>
          </div>
        </div>
        <div style={{ marginTop: 64 }}>
          <Reveal p={ramp(t, B.context, B.context + 0.6)}><Display size={46} weight={300} color={C.text2}>WHEN CONTEXT CHANGES,</Display></Reveal>
          <Reveal p={ramp(t, B.context + 0.15, B.context + 0.75)}><Display size={46} weight={600}>THE RIGHT MODEL CHANGES.</Display></Reveal>
        </div>
      </div>
    </AbsoluteFill>
  );
};
