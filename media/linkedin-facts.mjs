// Figures for the LinkedIn film, computed by the same engine and engineering model as the app (nothing typed in).
// node media/linkedin-facts.mjs > media/linkedin-facts.json
import { DemoEngine } from '../src/engine/engine.js';
import { scenario } from '../src/scenarios/ai-factory/scenario.js';
import { computeMetrics, computeNaive } from '../src/engine/telemetry.js';
import { study } from '../src/engineering/evaluate.js';
const e = new DemoEngine(scenario); await e.runInstant();
const run = e.run, m = computeMetrics(run, scenario), n = computeNaive(run, scenario, m);
const checks = run.mcpCalls.filter(c => c.tool === scenario.loop.verifyTool).map(c => c.data);
const d = run.system1.decisions, st = study();
const pass = id => st.verification[id].filter(r => r.verdict === 'PASS').length;
process.stdout.write(JSON.stringify({
  rackKw: Math.round(checks[0].targetKw / (1 + scenario.incident.allowancePct / 100)), allowancePct: scenario.incident.allowancePct,
  p95Kw: checks[0].p95HeatKw, targetKw: checks[0].targetKw, head1: checks[0].headroomKw, head2: checks.at(-1).headroomKw,
  rawRecords: m.context.rawRecords, evidenceRecords: m.context.evidenceRecords, reductionPct: m.context.reduction * 100,
  rawTokens: m.context.rawTokens, evidenceTokens: m.context.evidenceTokens,
  leanCost: m.totals.totalCost, bruteCost: n.totals.totalCost,
  s1: { risk: d.capacity_risk.label, reasoning: d.reasoning_required.label, route: d.preferred_route.label, agents: d.agents_required.selected.length },
  approvals: run.humanActions.filter(h => h.type === 'approve' || h.type === 'sign-off').length,
  futureKw: st.scenarios[3].loadKw, cap1: st.v1.capacityKw, cap2: st.v2.capacityKw,
  margin1: st.v1.scenarios[3].marginPct, margin2: st.v2.scenarios[3].marginPct,
  req: { v1: pass('v1'), v2: pass('v2'), total: st.verification.v1.length },
  options: st.options.list.filter(o => o.id !== 'D').length
}, null, 1) + '\n');
