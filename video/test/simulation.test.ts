import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AGENTS, REFERENCE, REFLEX_PARAMS } from '../src/data/reflex.config.ts';
import { runReflex } from '../src/simulation/reflex.ts';
import { analyse, makeScenario } from '../src/simulation/planning.ts';
import { PLANNING } from '../src/data/planning.config.ts';
import { DECISIONS, ROUTER_MIX } from '../src/data/router.config.ts';
import { TOTAL_FRAMES, FPS } from '../src/data/timeline.ts';

test('reflex replay is deterministic', () => {
  const a = runReflex(REFLEX_PARAMS, AGENTS).map((l) => [l.lines, l.tooLate, l.events.length]);
  const b = runReflex(REFLEX_PARAMS, AGENTS).map((l) => [l.lines, l.tooLate, l.events.length]);
  assert.deepEqual(a, b);
});

test('reflex replay reproduces the reference outcome (Jev too-late: documented 0 vs 1)', () => {
  const [j, h, o] = runReflex(REFLEX_PARAMS, AGENTS);
  assert.equal(j.lines, REFERENCE.jev.lines);
  assert.equal(j.toppedOut, false);
  assert.ok(Math.abs(j.tooLate - REFERENCE.jev.tooLate) <= 1);
  assert.equal(h.lines, REFERENCE.haiku.lines);
  assert.equal(h.tooLate, REFERENCE.haiku.tooLate);
  assert.equal(h.topOutLevel, REFERENCE.haiku.topOutLevel);
  assert.equal(o.lines, REFERENCE.opus.lines);
  assert.equal(o.tooLate, REFERENCE.opus.tooLate);
  assert.equal(o.topOutLevel, REFERENCE.opus.topOutLevel);
});

test('planning scenario: local optimum != global optimum, same executor', () => {
  const a = analyse(makeScenario(PLANNING.seed));
  assert.ok(a.localFirstUsesWell && a.localFirstClears >= 1, 'local best move uses the well and clears now');
  assert.ok(a.localEnd.holes > a.policyEnd.holes);
  assert.ok(a.localEnd.maxHeight > a.policyEnd.maxHeight);
  assert.equal(a.policyMaxClear, 4);
});

test('router mix and film length', () => {
  const c = { jev: 0, haiku: 0, opus: 0 };
  for (const d of DECISIONS) c[d.route]++;
  assert.deepEqual(c, ROUTER_MIX);
  assert.equal(TOTAL_FRAMES / FPS, 75);
});
