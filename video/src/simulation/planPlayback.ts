import { PLANNING } from '../data/planning.config.ts';
import type { ActivePiece } from '../components/BoardView.tsx';
import type { Board } from './core.ts';
import { analyse, makeScenario, type PlanStep } from './planning.ts';

let cache: ReturnType<typeof build> | null = null;
function build() {
  const scenario = makeScenario(PLANNING.seed);
  const a = analyse(scenario);
  return { scenario, ...a };
}
export function planning() {
  if (!cache) cache = build();
  return cache;
}

export type StepView = { board: Board; active: ActivePiece | null; flashRows: number[]; flash: number; k: number; done: boolean };

/** Replays plan steps from `start` (scene seconds), one every `step` seconds. */
export function stepsView(steps: PlanStep[], initial: Board, t: number, start: number, step: number): StepView {
  if (t < start) return { board: initial, active: null, flashRows: [], flash: 0, k: -1, done: false };
  const k = Math.floor((t - start) / step);
  if (k >= steps.length) {
    return { board: steps[steps.length - 1]?.boardAfter ?? initial, active: null, flashRows: [], flash: 0, k: steps.length, done: true };
  }
  const s = steps[k];
  const u = (t - start - k * step) / step;
  if (s.held || !s.placement) return { board: s.boardBefore, active: null, flashRows: [], flash: 0, k, done: false };
  const pl = s.placement;
  const fall = 0.62;
  if (u < fall) {
    const v = u / fall;
    const row = -2 + (pl.row + 2) * v * v;
    return { board: s.boardBefore, active: { type: s.piece, rot: pl.rot, col: pl.col, row }, flashRows: [], flash: 0, k, done: false };
  }
  if (s.cleared.length) {
    const f = 1 - (u - fall) / (1 - fall);
    return { board: s.boardLocked, active: null, flashRows: s.cleared, flash: f, k, done: false };
  }
  return { board: s.boardAfter, active: null, flashRows: [], flash: 0, k, done: false };
}
