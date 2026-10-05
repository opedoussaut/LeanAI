// Finds a seeded TEST 02 scenario where local optimisation != global optimisation:
//  - System 1's locally best first move uses the well and clears line(s) immediately (attractive)
//  - with the full queue, that branch ends with more holes / a higher stack (future trap)
//  - the macro-policy branch (same executor) keeps the well, lands a 4-line clear, ends with no holes
// Usage: node --experimental-strip-types scripts/tune-planning.ts [--check]

import { analyse, makeScenario } from '../src/simulation/planning.ts';
import { PLANNING } from '../src/data/planning.config.ts';

function report(seed: number) {
  const a = analyse(makeScenario(seed));
  return { seed, ...a, local: undefined, policy: undefined, queue: makeScenario(seed).queue.join('') };
}

if (process.argv.includes('--check')) {
  const r = report(PLANNING.seed);
  console.log(JSON.stringify(r));
  const ok = r.localFirstUsesWell && r.localFirstClears >= 1 && r.policyMaxClear === 4 && r.policyEnd.holes === 0 && r.localEnd.holes >= 3;
  process.exit(ok ? 0 : 1);
}

let best: { seed: number; v: number } | null = null;
for (let seed = 1; seed < 20000; seed++) {
  const a = analyse(makeScenario(seed));
  if (!a.localFirstUsesWell || a.localFirstClears < 1) continue;
  if (a.policyMaxClear !== 4 || a.policyEnd.holes !== 0) continue;
  if (a.localEnd.holes < 3 || a.localEnd.maxHeight <= a.policyEnd.maxHeight) continue;
  const v = a.localEnd.holes * 2 + (a.localEnd.maxHeight - a.policyEnd.maxHeight) - Math.abs(a.confidence - 0.43) * 20;
  if (!best || v > best.v) {
    best = { seed, v };
    console.log(JSON.stringify(report(seed)));
  }
}
