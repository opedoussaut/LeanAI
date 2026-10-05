// Searches the reflex-simulation parameter space for a seeded configuration whose replay
// reproduces the reference benchmark outcome. Usage:
//   node --experimental-strip-types scripts/tune-reflex.ts [iterations]
//   node --experimental-strip-types scripts/tune-reflex.ts --check   (verify current config)

import { AGENTS, REFERENCE, REFLEX_PARAMS } from '../src/data/reflex.config.ts';
import { runReflex, type ReflexParams } from '../src/simulation/reflex.ts';
import { mulberry32 } from '../src/simulation/core.ts';

function score(p: ReflexParams) {
  const [j, h, o] = runReflex(p, AGENTS);
  const r = REFERENCE;
  let d = 0;
  d += Math.abs(j.lines - r.jev.lines) * 2 + Math.abs(j.tooLate - r.jev.tooLate) * 3 + (j.toppedOut ? 100 : 0);
  d += Math.abs(h.lines - r.haiku.lines) * 2 + Math.abs(h.tooLate - r.haiku.tooLate) * 3 + (h.toppedOut ? 0 : 100);
  d += Math.abs((h.topOutLevel ?? 99) - r.haiku.topOutLevel!) * 2;
  d += Math.abs(o.lines - r.opus.lines) * 2 + Math.abs(o.tooLate - r.opus.tooLate) * 3 + (o.toppedOut ? 0 : 100);
  d += Math.abs((o.topOutLevel ?? 99) - r.opus.topOutLevel!) * 2;
  return { d, j, h, o };
}

function fmt(p: ReflexParams) {
  const { d, j, h, o } = score(p);
  return `d=${d} | JEV lines ${j.lines} late ${j.tooLate} top ${j.topOutLevel} | HAIKU lines ${h.lines} late ${h.tooLate} top L${h.topOutLevel} | OPUS lines ${o.lines} late ${o.tooLate} top L${o.topOutLevel} | pieces ${j.events.length}/${h.events.length}/${o.events.length}`;
}

if (process.argv.includes('--check')) {
  console.log(fmt(REFLEX_PARAMS));
  process.exit(score(REFLEX_PARAMS).d === 0 ? 0 : 1);
}

const iters = Number(process.argv[2] ?? 3000);
const rnd = mulberry32(Number(process.env.TUNE_SEED ?? 20261005));
let best = { d: score(REFLEX_PARAMS).d, p: REFLEX_PARAMS };
const pick = (a: number, b: number) => a + rnd() * (b - a);
for (let i = 0; i < iters; i++) {
  const local = best.d < 40 && rnd() < 0.7;
  const base = local ? best.p : REFLEX_PARAMS;
  const jit = (v: number, lo: number, hi: number, digits: number) =>
    +(local ? Math.min(hi, Math.max(lo, v * (1 + (rnd() - 0.5) * 0.03))) : pick(lo, hi)).toFixed(digits);
  const p: ReflexParams = {
    ...base,
    seed: rnd() < (local ? 0.15 : 0.6) ? Math.floor(rnd() * 5000) : base.seed,
    latencySeed: rnd() < (local ? 0.3 : 0.6) ? Math.floor(rnd() * 5000) : base.latencySeed,
    levelSec: jit(base.levelSec, 4.2, 6.5, 2),
    gravity1: jit(base.gravity1, 3.05, 4.2, 2),
    gravityGrowth: jit(base.gravityGrowth, 1.08, 1.3, 3),
    gravityMax: jit(base.gravityMax, 18, 40, 1),
    jitterSigma: jit(base.jitterSigma, 0.12, 0.4, 2),
  };
  const s = score(p).d;
  if (s < best.d) {
    best = { d: s, p };
    console.log(i, fmt(p));
    console.log(JSON.stringify(p));
    if (s === 0) break;
  }
}
