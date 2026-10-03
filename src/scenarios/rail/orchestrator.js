// The Industrial Recovery pipeline: REDUCE → DECIDE → REASON → VALIDATE → ACT → ENGINEER.
// The orchestrator is deterministic code. It talks to the specialists over A2A (agent ↔ agent), the specialists reach
// enterprise systems over MCP (agent ↔ tool), a provider supplies the model (simulated or Gemini/ADK), and every
// proposal goes through deterministic validation and explicit governance states before a person can approve it.
import { generateRailDataset, DISRUPTION } from './dataset.js';
import { reduce } from './evidence.js';
import { factsFrom, baseline, buildPlan, economics, validate, deviationAssessment } from './recovery.js';
import { railFeatures } from './features.js';
import { decideJs } from './decision.js';
import { RAIL_SERVERS, findRailTool } from './tools.js';
import { SPECIALISTS, ORCHESTRATOR, specialist, checkOutput } from './agents.js';
import { createDecision } from './governance.js';
import { createMcpClient, inProcessMcpTransport } from '../../adapters/mcp.js';
import { createA2AClient, inProcessA2ATransport } from '../../adapters/a2a.js';
import { createSimulatedProvider } from '../../providers/simulated.js';
import { assertProvider } from '../../providers/provider.js';
import { tokenCostEur } from '../../providers/prices.js';
import { estimateTokens } from '../../lib/util.js';

const short = v => JSON.parse(JSON.stringify(v));

export async function runRecovery({ provider = createSimulatedProvider(), notice = DISRUPTION.id, decide = decideJs, dataset = generateRailDataset(), mcpTransport, a2aTransport } = {}) {
  assertProvider(provider);
  const events = [];
  let clock = 0;
  const log = (kind, e) => { events.push({ t: clock, kind, ...e }); };

  // REDUCE
  const red = reduce(dataset, { notice });
  const F = factsFrom(red.evidence);
  clock += red.telemetry.processingTime;
  log('reduce', { text: `${red.telemetry.rawRecords.toLocaleString('en-US')} records → ${red.telemetry.evidenceItems} evidence items`, data: red.telemetry });

  // DECIDE
  const feats = railFeatures(F);
  const decision = await decide(feats.vector);
  clock += decision.inferenceMs;
  log('decide', { text: decision.gate.verdict, data: { path: decision.gate.path, agents: decision.gate.agents } });

  const base = baseline(F);
  const ctx = { evidence: red.evidence, F };
  const mcp = createMcpClient({ servers: RAIL_SERVERS, transport: mcpTransport ?? inProcessMcpTransport(RAIL_SERVERS, () => ctx) });
  const inbox = [];
  const a2a = createA2AClient({ transportMs: 35, transport: a2aTransport ?? inProcessA2ATransport((to, m) => inbox.push({ to, m })) });
  const toolCalls = [], messages = [], modelCalls = [];

  const result = { notice, provider: provider.describe(), reduce: { telemetry: red.telemetry, stages: red.stages }, evidence: red.evidence, facts: F, features: feats, decision, baseline: base, events, toolCalls, messages, modelCalls };

  if (decision.gate.path !== 'AGENTIC') {
    // No agents: deterministic rules (or a person) handle it. Show what the rules conclude.
    const plan = buildPlan(F), eco = economics(F, plan, base);
    log('rules', { text: decision.gate.path === 'DIRECT' ? `Handled by deterministic rules: ${plan.actions.map(a => `${a.trainset} ${a.kind.toLowerCase().replaceAll('_', ' ')}`).join('; ')}` : 'Routed to a person for review' });
    return { ...result, routed: decision.gate.path, plan, economics: eco, telemetry: totals() };
  }

  // REASON — specialists over A2A, tools over MCP
  const brief = { notice: F.disruption.notice, part: F.disruption.part, delayDays: F.disruption.delayDays, pegged: F.pegged.map(p => p.id), evidenceItems: red.evidence.length };
  async function ask(agentId, intent, text, input = {}) {
    const agent = specialist(agentId);
    const req = await a2a.send({ from: 'orchestrator', to: agentId, intent: 'request', text, data: { task: intent, ...compact(input) } });
    messages.push(req); clock += req.latencyMs;
    log('a2a', { from: 'orchestrator', to: agentId, text, data: { intent } });
    agent.status.forEach(s => log('status', { agent: agentId, text: s }));
    const callTool = async (name, args) => {
      if (!agent.tools.includes(name)) throw new Error(`${agent.name} is not allowed to call ${name}`);
      const { server } = findRailTool(name);
      const r = await mcp.callTool(server.id, name, args);
      const rec = { agent: agentId, server: server.id, system: server.system, tool: name, args, records: r.records, payloadBytes: r.payloadBytes, latencyMs: r.latencyMs, summary: r.summary };
      toolCalls.push(rec); clock += r.latencyMs;
      log('mcp', { agent: agentId, text: `${server.system} · ${name}`, data: { summary: r.summary } });
      return r;
    };
    const res = await provider.runSpecialist({ agent, input: { ...input, task: intent }, callTool, evidenceBrief: brief, toolDefs: RAIL_SERVERS.flatMap(sv => sv.tools.map(({ name, description, inputSchema }) => ({ name, description, inputSchema }))) });
    for (const c of res.toolCalls ?? []) {   // live provider: the agent called the MCP server itself
      toolCalls.push({ agent: agentId, server: findRailTool(c.tool)?.server.id, system: c.system, tool: c.tool, args: c.args, records: c.records, payloadBytes: null, latencyMs: null, summary: '' });
      log('mcp', { agent: agentId, text: `${c.system} · ${c.tool}` });
    }
    const errs = checkOutput(agent, res.output);
    if (errs.length) throw new Error(`${agent.name} returned an output that breaks its contract: ${errs.join(', ')}`);
    const costEur = tokenCostEur(agent.model, res.usage.inputTokens, res.usage.outputTokens + (res.usage.thinkingTokens ?? 0));
    modelCalls.push({ agent: agentId, model: provider.mode === 'LIVE' ? provider.model : agent.model, ...res.usage, latencyMs: res.latencyMs, costEur, calls: res.modelCalls });
    clock += res.latencyMs;
    const back = await a2a.send({ from: agentId, to: 'orchestrator', intent: 'inform', text: res.output.summary.slice(0, 300), data: { keys: Object.keys(res.output) } });
    messages.push(back); clock += back.latencyMs;
    log('a2a', { from: agentId, to: 'orchestrator', text: res.output.summary });
    return res.output;
  }

  const supply = await ask('supply', 'stock-for-delayed-batch', `${F.disruption.part} ${F.disruption.delayDays} days late. Which units can reach the line before each slot?`);
  const planning = await ask('planning', 'protect-delivery', `Stock covers ${supply.allocations.length ? [...new Set(supply.allocations.map(a => a.trainset))].join(', ') : 'nothing'}; ${supply.uncovered.join(', ') || 'none'} must wait. Protect the delivery commitments.`, { uncovered: supply.uncovered });
  const cost = await ask('cost', 'recovery-economics', 'Quantify exposure and the economics of the candidate plan.');

  // ACT (candidate) — assemble the plan from the specialists' structured outputs
  const plan = {
    actions: planning.actions.map(a => ({ ...a, allocations: supply.allocations.filter(x => x.trainset === a.trainset) })),
    allocations: supply.allocations, costs: cost.costLines, bayUse: planning.bayUse, approvedVariantsOnly: false
  };
  const ref = buildPlan(F);
  plan.actions = plan.actions.map(a => ({ ...a, text: ref.actions.find(r => r.trainset === a.trainset)?.text ?? a.kind }));
  const eco = economics(F, plan, base);
  const agreement = { exposure: cost.exposure === eco.exposure, recoveryCost: cost.recoveryCost === eco.recoveryCost, valueProtected: cost.valueProtected === eco.valueProtected };
  log('candidate', { text: 'Recovery plan found', data: { valueProtected: eco.valueProtected, deliveryProtected: eco.deliveryProtected } });

  // VALIDATE — the configuration specialist and the deterministic validator
  const config = await ask('configuration', 'validate-configuration', 'Check the proposed components against each product configuration.', { allocations: supply.allocations.map(a => ({ trainset: a.trainset, lot: a.lot, part: a.part })) });
  const validation = validate(F, plan);
  const gov = createDecision();
  gov.validate(validation);
  log('validate', { text: validation.verdict === 'ENGINEERING_REVIEW' ? 'CONFIGURATION CONFLICT — ENGINEERING REVIEW REQUIRED' : validation.verdict, data: { verdict: validation.verdict, state: gov.state } });
  const deviation = validation.engineering.length ? deviationAssessment(F, validation.engineering) : null;

  return { ...result, routed: 'AGENTIC', specialists: { supply, planning, cost, configuration: config }, plan, economics: eco, agreement, validation, deviation, governance: gov, telemetry: totals() };

  function totals() {
    const sum = (l, k) => l.reduce((a, x) => a + (x[k] ?? 0), 0);
    return {
      rawRecords: red.telemetry.rawRecords, evidenceItems: red.telemetry.evidenceItems, reductionPercentage: red.telemetry.reductionPercentage, processingTime: red.telemetry.processingTime,
      decisionModel: { parameters: decision.parameters, latencyMs: decision.inferenceMs, confidence: decision.decisions.reasoning_required.confidence, verdict: decision.gate.verdict, runtime: decision.runtime },
      agentCalls: new Set(modelCalls.map(m => m.agent)).size, modelCalls: sum(modelCalls, 'calls'), inputTokens: sum(modelCalls, 'inputTokens'), outputTokens: sum(modelCalls, 'outputTokens'), thinkingTokens: sum(modelCalls, 'thinkingTokens'),
      toolCalls: toolCalls.length, a2aMessages: messages.length, coordinationEvents: messages.length,
      totalLatencyMs: Math.round(clock), aiCostEur: sum(modelCalls, 'costEur'), tokensEstimated: modelCalls.some(m => m.estimated), provider: provider.describe()
    };
  }
}

const compact = input => { const o = {}; for (const [k, v] of Object.entries(input)) o[k] = Array.isArray(v) && v.length > 4 ? `${v.length} items` : v; return o; };

/** The engineer's decision on a configuration conflict. Validate → deviation recorded; reject → operations replans with approved variants only. */
export function resolveEngineering(run, outcome, { note = '' } = {}) {
  const { F, gov } = { F: run.facts, gov: run.governance };
  if (outcome === 'validate') {
    gov.apply('engineering_validate', { actor: 'engineer', note: note || `Deviation ${run.deviation.procedure} accepted: ${run.deviation.steps.join('; ')}`, engineering: run.deviation });
    gov.apply('submit', { actor: 'validator', note: 'Engineering-validated plan submitted for approval' });
    const extra = run.deviation.extraCostEur ? [{ id: 'deviation', label: `Deviation ${run.deviation.procedure}`, eur: run.deviation.extraCostEur, formula: 'S50 hours beyond the spare slot time' }] : [];
    const plan = { ...run.plan, costs: [...run.plan.costs, ...extra] };
    return { ...run, plan, economics: economics(F, plan, run.baseline), outcome };
  }
  gov.apply('engineering_reject', { actor: 'engineer', note: note || 'Deviation not accepted — use approved variants only' });
  const plan = buildPlan(F, { approvedVariantsOnly: true });
  const v = validate(F, plan);
  gov.validate(v);
  return { ...run, plan, validation: v, economics: economics(F, plan, run.baseline), outcome };
}

export { SPECIALISTS, ORCHESTRATOR, short, estimateTokens };
