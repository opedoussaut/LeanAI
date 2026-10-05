// Scene 05 — COMPLEXITY ROUTER. ILLUSTRATIVE: 100 simulated decisions, not measured traffic.
// The mix (91 / 7 / 2) is the illustrative split requested for the film. Each decision's telemetry
// is generated (seeded) to be consistent with the route the policy below would choose:
//   route = OPUS  if ambiguity >= 0.7 and horizon >= 6 and value at risk is high
//           HAIKU if confidence < 0.8 (System 1 not sure) but the problem stays short-horizon
//           JEV   otherwise (confident, local, latency-bound)
import { mulberry32 } from '../simulation/core.ts';

export type Route = 'jev' | 'haiku' | 'opus';
export type Decision = {
  i: number;
  route: Route;
  latencyMs: number; // latency budget
  ambiguity: number; // 0..1
  horizon: number; // pieces / steps of look-ahead required
  confidence: number; // System 1 confidence 0..1
  valueAtRisk: number; // 0..1
  cost: number; // relative cost of reasoning on the chosen route 0..1
};

export const ROUTER_MIX = { jev: 91, haiku: 7, opus: 2 };
export const ROUTES = [
  { id: 'jev' as const, name: 'JEV', role: 'SYSTEM 1', y: 300 },
  { id: 'haiku' as const, name: 'HAIKU', role: 'FAST REASONING', y: 540 },
  { id: 'opus' as const, name: 'OPUS', role: 'DEEP REASONING', y: 780 },
];
export const DWELL = { jev: 0.06, haiku: 0.4, opus: 1.15 }; // seconds held in the router (deliberation)
export const TRAVEL_OUT = { jev: 0.34, haiku: 0.6, opus: 0.9 };

const HAIKU_AT = [6, 19, 28, 47, 58, 66, 83];
const OPUS_AT = [37, 74];

export const DECISIONS: Decision[] = (() => {
  const rnd = mulberry32(44);
  const out: Decision[] = [];
  for (let i = 0; i < 100; i++) {
    const route: Route = OPUS_AT.includes(i) ? 'opus' : HAIKU_AT.includes(i) ? 'haiku' : 'jev';
    const r = () => rnd();
    if (route === 'jev') out.push({ i, route, latencyMs: 80 + Math.round(r() * 120), ambiguity: 0.04 + r() * 0.18, horizon: 1, confidence: 0.86 + r() * 0.13, valueAtRisk: 0.05 + r() * 0.25, cost: 0.02 });
    else if (route === 'haiku') out.push({ i, route, latencyMs: 700 + Math.round(r() * 900), ambiguity: 0.35 + r() * 0.25, horizon: 2 + Math.floor(r() * 2), confidence: 0.5 + r() * 0.25, valueAtRisk: 0.3 + r() * 0.3, cost: 0.25 });
    else out.push({ i, route, latencyMs: 6000 + Math.round(r() * 4000), ambiguity: 0.75 + r() * 0.2, horizon: 8, confidence: 0.3 + r() * 0.15, valueAtRisk: 0.82 + r() * 0.15, cost: 0.95 });
  }
  return out;
})();
