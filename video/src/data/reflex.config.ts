// TEST 01 — REFLEX parameters.
//
// REFERENCE values are the results of the LeanAI / Jev Level-20 benchmark supplied by the author.
// The film does NOT re-measure them: it replays a deterministic, seeded simulation whose
// parameters (below) were selected with `npm run tune` so that the replay reproduces the
// reference outcome under one set of rules that is identical for every agent.

import type { AgentSpec, ReflexParams } from '../simulation/reflex.ts';

export const REFERENCE = {
  jev: { label: 'JEV', role: 'System 1', latency: 0.28, tooLate: 1, lines: 73, topOutLevel: null as number | null },
  haiku: { label: 'HAIKU 4.5', role: 'Fast LLM', latency: 0.74, tooLate: 9, lines: 16, topOutLevel: 13 },
  opus: { label: 'OPUS 5.5 · HIGH', role: 'Frontier LLM · high effort', latency: 5.99, tooLate: 11, lines: 0, topOutLevel: 7 },
};

export const AGENTS: AgentSpec[] = [
  { id: 'jev', latency: REFERENCE.jev.latency },
  { id: 'haiku', latency: REFERENCE.haiku.latency },
  { id: 'opus', latency: REFERENCE.opus.latency },
];

// Selected by scripts/tune-reflex.ts (see README). Edit and re-run `npm run tune` to verify.
export const REFLEX_PARAMS: ReflexParams = {
  seed: 1561,
  latencySeed: 1,
  levelSec: 5.04,
  levels: 20,
  gravity1: 3.43,
  gravityGrowth: 1.172,
  gravityMax: 20.4,
  jitterSigma: 0.25,
  execSec: 0.12,
  lockDelaySec: 0.5, // guideline lock delay: a piece that lands on its own waits 0.5 s before locking
  spawnDelaySec: 0.08,
  clearDelaySec: 0.2,
};
