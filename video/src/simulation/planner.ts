// Local placement policy shared by all three agents in TEST 01.
// Same evaluator for every agent: the only difference in REFLEX is decision latency.
// Weights: the published El-Tetris linear evaluator (aggregate height, lines, holes, bumpiness).

import {
  type Board, type PieceType, cloneBoard, collides, columnHeights, countHoles, dropRow, lockPiece, uniqueRotations, COLS,
} from './core.ts';

export const WEIGHTS = { height: -0.510066, lines: 0.760666, holes: -0.35663, bumpiness: -0.184483 };

export type Placement = { rot: number; col: number; row: number; score: number; lines: number };

export function evaluate(b: Board, lines: number): number {
  const h = columnHeights(b);
  const agg = h.reduce((a, x) => a + x, 0);
  let bump = 0;
  for (let c = 0; c < COLS - 1; c++) bump += Math.abs(h[c] - h[c + 1]);
  return WEIGHTS.height * agg + WEIGHTS.lines * lines + WEIGHTS.holes * countHoles(b) + WEIGHTS.bumpiness * bump;
}

/**
 * Placements reachable from (row, col, rot): rotate in place, slide horizontally at that row,
 * then hard drop. A piece that has already fallen deep into the well has fewer options —
 * this is how latency degrades the quality of an otherwise good decision.
 */
export function reachablePlacements(b: Board, p: PieceType, row: number, col: number): Placement[] {
  const out: Placement[] = [];
  for (const rot of uniqueRotations(p)) {
    // rotation must be possible at the current position (simple, no wall kicks)
    let ok = true;
    for (let k = 1; k <= rot; k++) if (collides(b, p, k, row, col)) ok = false;
    if (!ok) continue;
    for (const dir of [0, -1, 1]) {
      let c = col;
      if (dir !== 0) c += dir;
      while (c >= -3 && c <= COLS) {
        if (collides(b, p, rot, row, c)) break;
        const r = dropRow(b, p, rot, row, c);
        const nb = cloneBoard(b);
        const lines = lockPiece(nb, p, rot, r, c).length;
        out.push({ rot, col: c, row: r, lines, score: evaluate(nb, lines) });
        if (dir === 0) break;
        c += dir;
      }
    }
  }
  // de-duplicate
  const seen = new Set<string>();
  return out.filter((x) => {
    const k = `${x.rot}:${x.col}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function bestPlacement(b: Board, p: PieceType, row: number, col: number): Placement | null {
  const all = reachablePlacements(b, p, row, col);
  if (!all.length) return null;
  return all.reduce((a, x) => (x.score > a.score ? x : a));
}
