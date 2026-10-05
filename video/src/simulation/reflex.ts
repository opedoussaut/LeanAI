// TEST 01 — REFLEX. Deterministic latency-bound control loop.
//
// Rules (identical for every agent):
//  - Same seeded 7-bag piece sequence, same gravity curve, same placement evaluator.
//  - A piece spawns and immediately starts falling under the current level's gravity.
//  - The agent's decision arrives after its latency (seeded, mean-preserving jitter).
//  - If the piece has already landed before the decision arrives -> TOO LATE:
//    it locks wherever gravity put it (spawn column / spawn rotation).
//  - Otherwise the agent picks the best placement still reachable from the row the piece
//    has fallen to (deeper = fewer options), then the executor moves and hard-drops it.
//  - The game clock never waits for the agent. Level rises every `levelSec` seconds.

import {
  type Board, type PieceType, ROWS, SPAWN_COL, bagSequence, cloneBoard, collides, dropRow, emptyBoard, gaussian, lockPiece,
  mulberry32, lockNoClear,
} from './core.ts';
import { bestPlacement } from './planner.ts';

export type ReflexParams = {
  seed: number;
  latencySeed: number;
  levelSec: number;
  levels: number; // scenario length in levels
  gravity1: number; // rows / s at level 1
  gravityGrowth: number; // multiplicative per level
  gravityMax: number; // rows / s cap
  jitterSigma: number; // lognormal sigma of decision latency
  execSec: number; // executor: move + hard drop
  lockDelaySec: number;
  spawnDelaySec: number;
  clearDelaySec: number;
};

export type AgentSpec = { id: string; latency: number };

export type PieceEvent = {
  index: number;
  piece: PieceType;
  spawnT: number;
  gravity: number; // rows / s during this piece
  latency: number;
  decisionT: number;
  late: boolean;
  decisionRow: number; // row reached when the decision arrived (late: landing row)
  target: { rot: number; col: number; row: number };
  lockT: number;
  clearedRows: number[];
  boardAfter: Board; // after lock and clear
  boardLocked: Board; // locked, before clear
  landRow: number; // landing row at spawn column (no decision)
  landT: number;
  boardBefore: Board; // before this piece locks
  linesAfter: number;
  tooLateAfter: number;
  level: number;
};

export type LaneResult = {
  agent: AgentSpec;
  events: PieceEvent[];
  lines: number;
  tooLate: number;
  toppedOut: boolean;
  topOutT: number | null;
  topOutLevel: number | null;
  endT: number;
  meanLatency: number;
};

export function levelAt(p: ReflexParams, t: number): number {
  return Math.min(p.levels, 1 + Math.floor(t / p.levelSec));
}

export function gravityAt(p: ReflexParams, level: number): number {
  return Math.min(p.gravityMax, p.gravity1 * Math.pow(p.gravityGrowth, level - 1));
}

export function runLane(p: ReflexParams, agent: AgentSpec, agentIndex: number): LaneResult {
  const endT = p.levelSec * p.levels;
  const seq = bagSequence(p.seed, 2000);
  const rnd = mulberry32(p.latencySeed * 7919 + agentIndex * 104729);
  const board = emptyBoard();
  const events: PieceEvent[] = [];
  let t = 0;
  let lines = 0;
  let tooLate = 0;
  let toppedOut = false;
  let topOutT: number | null = null;
  let topOutLevel: number | null = null;
  let latSum = 0;

  for (let i = 0; i < seq.length && t < endT; i++) {
    const piece = seq[i];
    const level = levelAt(p, t);
    const g = gravityAt(p, level);
    if (collides(board, piece, 0, 0, SPAWN_COL)) {
      toppedOut = true;
      topOutT = t;
      topOutLevel = level;
      break;
    }
    const s = p.jitterSigma;
    const latency = agent.latency * Math.exp(s * gaussian(rnd) - (s * s) / 2);
    latSum += latency;
    const landRow = dropRow(board, piece, 0, 0, SPAWN_COL);
    const landT = t + landRow / g;
    const boardBefore = cloneBoard(board);
    let late = false;
    let target = { rot: 0, col: SPAWN_COL, row: landRow };
    let decisionRow = landRow;
    let lockT: number;
    if (t + latency >= landT) {
      late = true;
      tooLate++;
      lockT = landT + p.lockDelaySec;
    } else {
      decisionRow = Math.min(landRow, Math.floor(latency * g));
      const best = bestPlacement(board, piece, decisionRow, SPAWN_COL);
      if (best) target = { rot: best.rot, col: best.col, row: best.row };
      lockT = t + latency + p.execSec;
    }
    const boardLocked = lockNoClear(board, piece, target.rot, target.row, target.col);
    const cleared = lockPiece(board, piece, target.rot, target.row, target.col);
    lines += cleared.length;
    events.push({
      index: i, piece, spawnT: t, gravity: g, latency, decisionT: t + latency, late, decisionRow, target, lockT,
      clearedRows: cleared, boardAfter: cloneBoard(board), boardBefore, boardLocked, landRow, landT, linesAfter: lines, tooLateAfter: tooLate, level,
    });
    t = lockT + p.spawnDelaySec + (cleared.length ? p.clearDelaySec : 0);
  }
  return {
    agent, events, lines, tooLate, toppedOut, topOutT, topOutLevel, endT,
    meanLatency: events.length ? latSum / events.length : agent.latency,
  };
}

export function runReflex(p: ReflexParams, agents: AgentSpec[]): LaneResult[] {
  return agents.map((a, i) => runLane(p, a, i));
}

export { ROWS };
