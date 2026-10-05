// Lightweight deterministic falling-block engine, built only for the film.
// Board: COLS × ROWS, row 0 is the top. Cells hold 0 (empty) or a piece id (1..7).

export const COLS = 10;
export const ROWS = 20;

export type PieceType = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L';
export const PIECES: PieceType[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
export const PIECE_ID: Record<PieceType, number> = { I: 1, O: 2, T: 3, S: 4, Z: 5, J: 6, L: 7 };

type Cell = [number, number]; // [row, col] offsets inside the piece box

// Spawn orientation (rotation 0) for each piece; rotations derived by turning clockwise.
const BASE: Record<PieceType, Cell[]> = {
  I: [[1, 0], [1, 1], [1, 2], [1, 3]],
  O: [[0, 1], [0, 2], [1, 1], [1, 2]],
  T: [[0, 1], [1, 0], [1, 1], [1, 2]],
  S: [[0, 1], [0, 2], [1, 0], [1, 1]],
  Z: [[0, 0], [0, 1], [1, 1], [1, 2]],
  J: [[0, 0], [1, 0], [1, 1], [1, 2]],
  L: [[0, 2], [1, 0], [1, 1], [1, 2]],
};
const BOX: Record<PieceType, number> = { I: 4, O: 4, T: 3, S: 3, Z: 3, J: 3, L: 3 };

function rotateCW(cells: Cell[], size: number): Cell[] {
  return cells.map(([r, c]) => [c, size - 1 - r] as Cell);
}

// Normalised so the top-most occupied row of every orientation is 0.
const SHAPES: Record<PieceType, Cell[][]> = (() => {
  const out = {} as Record<PieceType, Cell[][]>;
  for (const p of PIECES) {
    const rots: Cell[][] = [];
    let cur = BASE[p];
    for (let i = 0; i < 4; i++) {
      const minR = Math.min(...cur.map((x) => x[0]));
      rots.push(cur.map(([r, c]) => [r - minR, c] as Cell));
      cur = rotateCW(cur, BOX[p]);
    }
    out[p] = rots;
  }
  return out;
})();

export function cells(p: PieceType, rot: number): Cell[] {
  return SHAPES[p][((rot % 4) + 4) % 4];
}

export function uniqueRotations(p: PieceType): number[] {
  if (p === 'O') return [0];
  if (p === 'I' || p === 'S' || p === 'Z') return [0, 1];
  return [0, 1, 2, 3];
}

export const SPAWN_COL = 3;

export type Board = number[][];

export function emptyBoard(rows = ROWS): Board {
  return Array.from({ length: rows }, () => new Array(COLS).fill(0));
}

export function cloneBoard(b: Board): Board {
  return b.map((r) => r.slice());
}

export function collides(b: Board, p: PieceType, rot: number, row: number, col: number): boolean {
  for (const [r, c] of cells(p, rot)) {
    const rr = row + r;
    const cc = col + c;
    if (cc < 0 || cc >= COLS || rr >= b.length) return true;
    if (rr >= 0 && b[rr][cc] !== 0) return true;
  }
  return false;
}

export function dropRow(b: Board, p: PieceType, rot: number, row: number, col: number): number {
  let r = row;
  while (!collides(b, p, rot, r + 1, col)) r++;
  return r;
}

export function lockNoClear(b: Board, p: PieceType, rot: number, row: number, col: number): Board {
  const nb = cloneBoard(b);
  for (const [r, c] of cells(p, rot)) if (row + r >= 0) nb[row + r][col + c] = PIECE_ID[p];
  return nb;
}

/** Locks the piece and clears full rows. Returns indices (pre-clear) of cleared rows. */
export function lockPiece(b: Board, p: PieceType, rot: number, row: number, col: number): number[] {
  for (const [r, c] of cells(p, rot)) {
    const rr = row + r;
    if (rr >= 0) b[rr][col + c] = PIECE_ID[p];
  }
  const full: number[] = [];
  for (let r = 0; r < b.length; r++) if (b[r].every((x) => x !== 0)) full.push(r);
  if (full.length) {
    const keep = b.filter((_, i) => !full.includes(i));
    const fresh = full.map(() => new Array(COLS).fill(0));
    const next = [...fresh, ...keep];
    for (let r = 0; r < b.length; r++) b[r] = next[r];
  }
  return full;
}

export function columnHeights(b: Board): number[] {
  const h = new Array(COLS).fill(0);
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < b.length; r++) {
      if (b[r][c] !== 0) {
        h[c] = b.length - r;
        break;
      }
    }
  }
  return h;
}

export function countHoles(b: Board): number {
  let holes = 0;
  for (let c = 0; c < COLS; c++) {
    let seen = false;
    for (let r = 0; r < b.length; r++) {
      if (b[r][c] !== 0) seen = true;
      else if (seen) holes++;
    }
  }
  return holes;
}

// ---------------------------------------------------------------- RNG + bag
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard 7-bag sequence: every agent receives the identical sequence. */
export function bagSequence(seed: number, n: number): PieceType[] {
  const rnd = mulberry32(seed);
  const out: PieceType[] = [];
  while (out.length < n) {
    const bag = PIECES.slice();
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    out.push(...bag);
  }
  return out.slice(0, n);
}

export function gaussian(rnd: () => number): number {
  const u = Math.max(1e-9, rnd());
  const v = rnd();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
