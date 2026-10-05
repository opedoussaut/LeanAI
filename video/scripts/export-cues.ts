// Exports the sound-design cue sheet (seconds, film time) from the same simulation and timeline
// the picture uses, so every lock / clear / late decision / top-out sound lands on its frame.
//   node --experimental-strip-types scripts/export-cues.ts > audio/cues.json
import { writeFileSync } from 'node:fs';
import { Easing } from 'remotion';
import { FPS, PLANNING_BEATS as PB, REFLEX_PLAYBACK, ROUTER_BEATS as RB, scene } from '../src/data/timeline.ts';
import { frameAtSim, reflexLanes } from '../src/simulation/playback.ts';
import { planning } from '../src/simulation/planPlayback.ts';
import { DECISIONS, DWELL } from '../src/data/router.config.ts';
import { HYBRID_ESCALATIONS as ESCALATIONS } from '../src/data/timeline.ts';

type Cue = { t: number; type: string; pan?: number; gain?: number; dur?: number; pitch?: number };
const cues: Cue[] = [];
const add = (c: Cue) => cues.push({ ...c, t: +c.t.toFixed(4) });

const S1 = scene('question').from / FPS;
const S2 = scene('reflex').from / FPS;
const S3 = scene('change').from / FPS;
const S4 = scene('planning').from / FPS;
const S5 = scene('router').from / FPS;
const S6 = scene('hybrid').from / FPS;
const S7 = scene('final').from / FPS;
const TOTAL = S7 + scene('final').dur / FPS;

// 01 — question
add({ t: S1 + 0.55, type: 'sub', gain: 0.9 });
[1.0, 1.45, 1.9].forEach((x) => add({ t: S1 + x, type: 'tick', gain: 0.5 }));
[2.55, 2.73, 2.91].forEach((x, i) => add({ t: S1 + x, type: 'counter', pan: [-0.5, 0, 0.5][i] }));
add({ t: S1 + 3.85, type: 'swell', dur: 2.2, gain: 0.5 });

// 02 — reflex
add({ t: S2, type: 'pulse_bed', dur: 15.4, gain: 0.55 });
const pans = [-0.55, 0, 0.55];
reflexLanes().forEach((lane, li) => {
  let lastLock = -1;
  let lastClear = -1;
  for (const e of lane.events) {
    const ft = S2 + frameAtSim(e.lockT) / FPS;
    if (ft > S2 + REFLEX_PLAYBACK.endSec + 0.1) break;
    if (ft - lastLock > 0.11) {
      add({ t: ft, type: 'lock', pan: pans[li], gain: li === 0 ? 0.55 : 0.45 });
      lastLock = ft;
    }
    if (e.clearedRows.length && ft - lastClear > 0.3) {
      add({ t: ft + 0.01, type: 'clear', pan: pans[li], gain: 0.5 + 0.1 * e.clearedRows.length });
      lastClear = ft;
    }
    if (e.late) add({ t: S2 + frameAtSim(e.landT) / FPS, type: 'late', pan: pans[li], gain: 0.5 });
  }
  if (lane.toppedOut && lane.topOutT !== null) add({ t: S2 + frameAtSim(lane.topOutT) / FPS, type: 'topout', pan: pans[li] });
});
add({ t: S2 + REFLEX_PLAYBACK.isolateSec + 0.6, type: 'resolve', dur: 3.5, gain: 0.55 });

// 03 — the problem changes (silence, then pull back)
add({ t: S3, type: 'silence', dur: 0.4 });
add({ t: S3 + 0.35, type: 'whoosh', dur: 1.5, gain: 0.5 });
[1.05, 1.27, 1.49, 1.71, 1.93].forEach((x) => add({ t: S3 + x, type: 'tick', gain: 0.35 }));
add({ t: S3 + 2.3, type: 'sub', gain: 0.55 });

// 04 — planning
const P = planning();
add({ t: S4 + PB.candidate, type: 'glow', gain: 0.45 });
add({ t: S4 + PB.localDrop + 0.35, type: 'lock', gain: 0.6 });
add({ t: S4 + PB.localDrop + 0.36, type: 'clear', gain: 0.5 });
add({ t: S4 + PB.futureStart, type: 'tension', dur: PB.rewind - PB.futureStart + 0.2, gain: 0.6 });
P.local.slice(1).forEach((_, k) => add({ t: S4 + PB.futureStart + k * PB.futureStep + PB.futureStep * 0.62, type: 'ghostlock', gain: 0.4 }));
add({ t: S4 + PB.futureStart + 1.6, type: 'trap', gain: 0.6 });
add({ t: S4 + PB.rewind, type: 'rewind', dur: 0.5, gain: 0.45 });
add({ t: S4 + PB.expand + 0.6, type: 'shimmer', dur: 1.6, gain: 0.4 });
for (let k = 0; k < 4; k++) add({ t: S4 + PB.strategyStart + k * PB.strategyStep, type: 'tick', gain: 0.45, pitch: 1 + k * 0.12 });
add({ t: S4 + PB.collapse + 0.25, type: 'chord', dur: 2.2, gain: 0.45 });
P.policy.forEach((s, k) => {
  const ft = S4 + PB.executeStart + k * PB.executeStep + PB.executeStep * 0.62;
  add({ t: ft, type: 'lock', gain: 0.5 });
  if (s.cleared.length === 4) add({ t: ft + 0.01, type: 'success', dur: 2.6, gain: 0.7 });
});
add({ t: S4 + PB.verdict, type: 'hit', gain: 0.5 });

// 05 — router
add({ t: S5 + 0.2, type: 'swell', dur: 1.6, gain: 0.35 });
add({ t: S5 + RB.flowStart, type: 'pulse_bed', dur: RB.reveal - RB.flowStart, gain: 0.4 });
const spawn = (i: number) => RB.flowStart + 6.0 * Math.pow(i / 99, 0.72);
for (const d of DECISIONS) {
  const tIn = S5 + spawn(d.i) + 0.5;
  if (d.route === 'jev') add({ t: tIn, type: 'blip', pitch: 1.6, gain: 0.22 });
  if (d.route === 'haiku') add({ t: tIn, type: 'blip', pitch: 1.0, gain: 0.35 });
  if (d.route === 'opus') add({ t: tIn, type: 'deliberate', dur: DWELL.opus, gain: 0.5 });
}
add({ t: S5 + RB.reveal, type: 'hit', gain: 0.6 });
add({ t: S5 + RB.message, type: 'chord', dur: 2.2, gain: 0.35 });

// 06 — hybrid: an escalation ping where the hybrid curve escalates
const ease = Easing.bezier(0.65, 0, 0.35, 1);
for (const x of ESCALATIONS) {
  let lo = 2.6;
  let hi = 5.4;
  for (let i = 0; i < 40; i++) {
    const m = (lo + hi) / 2;
    if (ease((m - 2.6) / 2.8) < x) lo = m;
    else hi = m;
  }
  add({ t: S6 + lo, type: 'ping', gain: 0.45 });
}
add({ t: S6 + 0.3, type: 'pad', dur: 8.4, gain: 0.7 });
[4.9, 5.15, 5.4, 5.65].forEach((x) => add({ t: S6 + x, type: 'tick', gain: 0.35 }));

// 07 — final
add({ t: S7 + 1.2, type: 'sub', gain: 0.6 });
[2.5, 3.0, 3.5].forEach((x) => add({ t: S7 + x, type: 'tick', gain: 0.3 }));
add({ t: S7 + 4.3, type: 'final', dur: 3.6, gain: 0.85 });

cues.sort((a, b) => a.t - b.t);
const out = { fps: FPS, duration: TOTAL, cues };
writeFileSync(new URL('../audio/cues.json', import.meta.url), JSON.stringify(out, null, 1));
console.log(`cues: ${cues.length}, duration ${TOTAL}s`);
