// Maps film time to simulation time and derives what each lane shows at that instant.
import { AGENTS, REFLEX_PARAMS } from '../data/reflex.config.ts';
import { FPS, REFLEX_PLAYBACK } from '../data/timeline.ts';
import { SPAWN_COL, type Board, emptyBoard } from './core.ts';
import { levelAt, runReflex, type LaneResult, type PieceEvent } from './reflex.ts';
import type { ActivePiece, Ghost } from '../components/BoardView.tsx';

let cache: LaneResult[] | null = null;
export function reflexLanes(): LaneResult[] {
  if (!cache) cache = runReflex(REFLEX_PARAMS, AGENTS);
  return cache;
}

// The sim runs until the end of level 20; a piece spawned just before that still completes.
export const END_T = Math.max(
  REFLEX_PARAMS.levelSec * REFLEX_PARAMS.levels,
  ...reflexLanes().map((l) => (l.events.length ? l.events[l.events.length - 1].lockT + 0.05 : 0)),
);

// ------------------------------------------------------------ film time -> sim time
// speed(t) = 1 until realtimeUntil, smooth ramp to cruise until rampUntil, then cruise.
// cruise is solved numerically so that sim time reaches END_T exactly at endSec.
const STEP = 1 / (FPS * 4);
function integrate(cruise: number, upTo: number): number {
  const P = REFLEX_PLAYBACK;
  let t = P.startSec;
  let sim = 0;
  while (t < upTo - 1e-9) {
    const u = Math.max(0, Math.min(1, (t - P.realtimeUntilSec) / (P.rampUntilSec - P.realtimeUntilSec)));
    const s = 1 + (cruise - 1) * (u * u * (3 - 2 * u));
    const dt = Math.min(STEP, upTo - t);
    sim += s * dt;
    t += dt;
  }
  return sim;
}
const CRUISE = (() => {
  let lo = 1;
  let hi = 200;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    if (integrate(mid, REFLEX_PLAYBACK.endSec) < END_T) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
})();
export const CRUISE_SPEED = CRUISE;

const SIM_TABLE: number[] = (() => {
  const out: number[] = [];
  const n = Math.ceil(REFLEX_PLAYBACK.endSec * FPS) + 2;
  let sim = 0;
  let t = REFLEX_PLAYBACK.startSec;
  for (let f = 0; f <= n; f++) {
    const sec = f / FPS;
    if (sec <= REFLEX_PLAYBACK.startSec) out.push(0);
    else {
      sim += integrate(CRUISE, sec) - integrate(CRUISE, t);
      t = sec;
      out.push(Math.min(END_T, sim));
    }
  }
  return out;
})();

/** Simulation time at scene-local seconds (sub-frame precision by interpolation). */
export function simTimeAt(sceneSec: number): number {
  const f = sceneSec * FPS;
  if (f <= 0) return 0;
  const i = Math.floor(f);
  if (i >= SIM_TABLE.length - 1) return END_T;
  const u = f - i;
  return SIM_TABLE[i] * (1 - u) + SIM_TABLE[i + 1] * u;
}

export function speedAt(sceneSec: number): number {
  const P = REFLEX_PLAYBACK;
  if (sceneSec < P.startSec || sceneSec > P.endSec) return 0;
  const u = Math.max(0, Math.min(1, (sceneSec - P.realtimeUntilSec) / (P.rampUntilSec - P.realtimeUntilSec)));
  return 1 + (CRUISE - 1) * (u * u * (3 - 2 * u));
}

/** Inverse: scene-local frame at which sim time T is reached. */
export function frameAtSim(T: number): number {
  let lo = 0;
  let hi = SIM_TABLE.length - 1;
  while (lo < hi) {
    const m = (lo + hi) >> 1;
    if (SIM_TABLE[m] < T) lo = m + 1;
    else hi = m;
  }
  return lo;
}

// ------------------------------------------------------------ lane state at sim time
export type LaneView = {
  board: Board;
  active: ActivePiece | null;
  ghost: Ghost | null;
  flashRows: number[];
  flash: number;
  thinking: number | null; // 0..1 progress of the pending decision
  lateFlash: number; // 0..1 "TOO LATE" pulse
  lines: number;
  tooLate: number;
  level: number;
  toppedOut: boolean;
  pieces: number;
};

function lastIndexBefore(events: PieceEvent[], T: number): number {
  let lo = 0;
  let hi = events.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const m = (lo + hi) >> 1;
    if (events[m].spawnT <= T) {
      ans = m;
      lo = m + 1;
    } else hi = m - 1;
  }
  return ans;
}

const easeIn = (u: number) => u * u;
const easeOut = (u: number) => 1 - (1 - u) * (1 - u);

export function laneView(lane: LaneResult, T: number, flashSec = 0.18): LaneView {
  const ev = lane.events;
  const i = lastIndexBefore(ev, T);
  const base: LaneView = {
    board: emptyBoard(), active: null, ghost: null, flashRows: [], flash: 0, thinking: null, lateFlash: 0,
    lines: 0, tooLate: 0, level: levelAt(REFLEX_PARAMS, T), toppedOut: false, pieces: 0,
  };
  if (lane.toppedOut && lane.topOutT !== null && T >= lane.topOutT) {
    const last = ev[ev.length - 1];
    return { ...base, board: last.boardAfter, lines: last.linesAfter, tooLate: last.tooLateAfter, level: lane.topOutLevel!, toppedOut: true, pieces: ev.length };
  }
  if (i < 0) return base;
  const e = ev[i];
  const prev = i > 0 ? ev[i - 1] : null;
  const v: LaneView = { ...base, lines: prev?.linesAfter ?? 0, tooLate: prev?.tooLateAfter ?? 0, pieces: i };
  if (T < e.lockT) {
    v.board = e.boardBefore;
    if (prev && prev.clearedRows.length && T < prev.lockT + flashSec) {
      // previous clear still flashing: show its pre-clear board
      v.board = prev.boardLocked;
      v.flashRows = prev.clearedRows;
      v.flash = 1 - (T - prev.lockT) / flashSec;
    }
    const dt = T - e.spawnT;
    if (e.late) {
      const row = Math.min(e.landRow, dt * e.gravity);
      v.active = { type: e.piece, rot: 0, row, col: SPAWN_COL };
      if (T < e.landT) v.thinking = Math.min(1, dt / e.latency);
      else {
        v.thinking = Math.min(1, dt / e.latency);
        v.lateFlash = 1;
        v.tooLate = e.tooLateAfter;
      }
    } else if (T < e.decisionT) {
      v.active = { type: e.piece, rot: 0, row: Math.min(e.landRow, dt * e.gravity), col: SPAWN_COL };
      v.thinking = dt / e.latency;
    } else {
      const u = (T - e.decisionT) / (e.lockT - e.decisionT);
      const tg = e.target;
      v.ghost = { type: e.piece, rot: tg.rot, row: tg.row, col: tg.col };
      if (u < 0.45) {
        const k = easeOut(u / 0.45);
        v.active = { type: e.piece, rot: u > 0.15 ? tg.rot : 0, row: e.decisionRow, col: SPAWN_COL + (tg.col - SPAWN_COL) * k };
      } else {
        const k = easeIn((u - 0.45) / 0.55);
        v.active = { type: e.piece, rot: tg.rot, row: e.decisionRow + (tg.row - e.decisionRow) * k, col: tg.col };
      }
    }
  } else {
    v.lines = e.linesAfter;
    v.tooLate = e.tooLateAfter;
    v.pieces = i + 1;
    if (e.clearedRows.length && T < e.lockT + flashSec) {
      v.board = e.boardLocked;
      v.flashRows = e.clearedRows;
      v.flash = 1 - (T - e.lockT) / flashSec;
    } else v.board = e.boardAfter;
    if (e.late && T < e.lockT + 0.3) v.lateFlash = 1 - (T - e.lockT) / 0.3;
  }
  return v;
}
