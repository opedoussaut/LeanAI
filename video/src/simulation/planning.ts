// TEST 02 — PLANNING. Same board, same 9-piece sequence, same deterministic executor.
// Only the information and the planning horizon change.
//
//  Branch LOCAL  : System 1 sees the current piece only (horizon 1, no hold). It plays the
//                  locally best placement under the same evaluator used in TEST 01.
//  Branch POLICY : a macro-policy, formed from the whole context (8-piece queue, hold, well,
//                  objective), constrains the SAME executor:
//                    PRESERVE RIGHT-SIDE WELL  -> never fill the well column with a non-I piece
//                    DEFER IMMEDIATE CLEAR     -> accept no partial clear that consumes the well
//                    RESERVE I-PIECE           -> hold the I piece until the well is ready, then drop it
//                    PROTECT FUTURE OPTIONS    -> otherwise: evaluator best placement
//  The LLM does not issue individual moves. It produces the policy; the executor executes it.

import {
  type Board, type PieceType, COLS, ROWS, SPAWN_COL, cloneBoard, collides, columnHeights, countHoles, dropRow,
  emptyBoard, lockPiece, mulberry32, PIECE_ID, PIECES, cells,
} from './core.ts';
import { reachablePlacements, type Placement } from './planner.ts';

export const WELL_COL = COLS - 1;

export type PlanStep = {
  piece: PieceType;
  held: boolean; // the step put this piece into hold instead of playing it
  fromHold: boolean; // the played piece came out of hold
  placement: Placement | null;
  boardBefore: Board;
  boardLocked: Board; // locked, before clear
  boardAfter: Board;
  cleared: number[];
  holdAfter: PieceType | null;
};

export type PlanScenario = { board: Board; queue: PieceType[] };

function lockNoClear(b: Board, p: PieceType, rot: number, row: number, col: number): Board {
  const nb = cloneBoard(b);
  for (const [r, c] of cells(p, rot)) if (row + r >= 0) nb[row + r][col + c] = PIECE_ID[p];
  return nb;
}

function play(b: Board, p: PieceType, pl: Placement, held: boolean, fromHold: boolean, hold: PieceType | null): PlanStep {
  const boardBefore = cloneBoard(b);
  const boardLocked = lockNoClear(b, p, pl.rot, pl.row, pl.col);
  const cleared = lockPiece(b, p, pl.rot, pl.row, pl.col);
  return { piece: p, held, fromHold, placement: pl, boardBefore, boardLocked, boardAfter: cloneBoard(b), cleared, holdAfter: hold };
}

export function localCandidates(b: Board, p: PieceType): Placement[] {
  return reachablePlacements(b, p, 0, SPAWN_COL).sort((x, y) => y.score - x.score);
}

/** Softmax probability of the best candidate (temperature 1, evaluator units). Shown as LOCAL POLICY CONFIDENCE. */
export function localConfidence(b: Board, p: PieceType, temperature = 1): number {
  const c = localCandidates(b, p);
  const m = c[0].score;
  const z = c.reduce((a, x) => a + Math.exp((x.score - m) / temperature), 0);
  return 1 / z;
}

export function runLocal(s: PlanScenario): PlanStep[] {
  const b = cloneBoard(s.board);
  const steps: PlanStep[] = [];
  for (const p of s.queue) {
    if (collides(b, p, 0, 0, SPAWN_COL)) break;
    const best = localCandidates(b, p)[0];
    steps.push(play(b, p, best, false, false, null));
  }
  return steps;
}

export function wellDepth(b: Board): number {
  // number of consecutive bottom-up rows whose only gap is the well column
  let d = 0;
  for (let r = b.length - 1; r >= 0; r--) {
    const row = b[r];
    if (row[WELL_COL] === 0 && row.every((x, c) => c === WELL_COL || x !== 0)) d++;
    else break;
  }
  return d;
}

function touchesWell(pl: Placement, p: PieceType): boolean {
  return cells(p, pl.rot).some(([, c]) => pl.col + c === WELL_COL);
}

export function runPolicy(s: PlanScenario): PlanStep[] {
  const b = cloneBoard(s.board);
  const steps: PlanStep[] = [];
  let hold: PieceType | null = null;
  const q = s.queue.slice();
  let nextFromHold = false;
  while (q.length) {
    const p = q.shift()!;
    const fromHold = nextFromHold;
    nextFromHold = false;
    // RESERVE I-PIECE: keep it in hold until the well is ready (depth >= 4)
    if (p === 'I' && wellDepth(b) < 4 && hold === null) {
      hold = 'I';
      steps.push({ piece: 'I', held: true, fromHold: false, placement: null, boardBefore: cloneBoard(b), boardLocked: cloneBoard(b), boardAfter: cloneBoard(b), cleared: [], holdAfter: hold });
      continue;
    }
    // Well ready and I reserved: swap. I is played now, the current piece waits in hold.
    if (hold === 'I' && p !== 'I' && wellDepth(b) >= 4) {
      const cand = localCandidates(b, 'I');
      const pick = cand.find((x) => x.rot % 2 === 1 && touchesWell(x, 'I')) ?? cand[0];
      if (collides(b, 'I', 0, 0, SPAWN_COL)) break;
      steps.push(play(b, 'I', pick, false, true, p));
      hold = null;
      q.unshift(p);
      nextFromHold = true;
      continue;
    }
    if (collides(b, p, 0, 0, SPAWN_COL)) break;
    const cand = localCandidates(b, p);
    let pick: Placement | undefined;
    if (p === 'I' && wellDepth(b) >= 4) pick = cand.find((x) => x.rot % 2 === 1 && touchesWell(x, p));
    // PRESERVE RIGHT-SIDE WELL / DEFER IMMEDIATE CLEAR / PROTECT FUTURE OPTIONS
    if (!pick) pick = cand.find((x) => !touchesWell(x, p)) ?? cand[0];
    steps.push(play(b, p, pick, false, fromHold, hold));
  }
  return steps;
}

export function boardMetrics(b: Board) {
  const h = columnHeights(b);
  return { maxHeight: Math.max(...h), holes: countHoles(b), wellDepth: wellDepth(b) };
}

/** Seeded scenario: a stack with a right-side well, a lumpy surface, and a 9-piece queue with one I. */
export function makeScenario(seed: number): PlanScenario {
  const rnd = mulberry32(seed);
  const board = emptyBoard(ROWS);
  const base = 3 + Math.floor(rnd() * 2); // 3..4 solid rows with the well open
  for (let r = ROWS - base; r < ROWS; r++) for (let c = 0; c < WELL_COL; c++) board[r][c] = 1 + Math.floor(rnd() * 7);
  // lumpy surface on top, no holes
  for (let c = 0; c < WELL_COL; c++) {
    const extra = Math.floor(rnd() * 3);
    for (let k = 0; k < extra; k++) board[ROWS - base - 1 - k][c] = 1 + Math.floor(rnd() * 7);
  }
  const others = PIECES.filter((p) => p !== 'I');
  const queue: PieceType[] = [];
  const iPos = 2 + Math.floor(rnd() * 3);
  for (let i = 0; i < 9; i++) queue.push(i === iPos ? 'I' : others[Math.floor(rnd() * others.length)]);
  return { board, queue };
}

export function analyse(s: PlanScenario) {
  const local = runLocal(s);
  const policy = runPolicy(s);
  const lastL = local[local.length - 1]?.boardAfter ?? s.board;
  const lastP = policy[policy.length - 1]?.boardAfter ?? s.board;
  const firstLocal = local[0];
  return {
    local, policy,
    localFirstUsesWell: !!firstLocal?.placement && touchesWell(firstLocal.placement, firstLocal.piece),
    localFirstClears: firstLocal?.cleared.length ?? 0,
    localEnd: boardMetrics(lastL),
    policyEnd: boardMetrics(lastP),
    localLines: local.reduce((a, x) => a + x.cleared.length, 0),
    policyLines: policy.reduce((a, x) => a + x.cleared.length, 0),
    policyMaxClear: Math.max(0, ...policy.map((x) => x.cleared.length)),
    confidence: localConfidence(s.board, s.queue[0]),
  };
}

export { dropRow };
