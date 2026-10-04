// The cinematic film's script data: timing and every on-screen figure, derived from railStory() — the same source as
// the interactive page. media/film-rail.html renders it; nothing numeric is written in the film itself (tested).
export const DURATION = 82;
/** Scene start times in seconds (storyboard: commitment, disruption, reduce, decide, reason, recovery, value, twist, governance, end). */
export const SCENES = { commitment: 0, disruption: 7, reduce: 15, decide: 24, reason: 31, recovery: 43, value: 51, twist: 60, governance: 69, end: 76 };

const kEur = v => `€${Math.round(v / 1000).toLocaleString('en-US')}K`;
const n = v => Math.round(v).toLocaleString('en-US');

export function filmFacts(story) {
  const s = story, e = s.economics, conflictTs = s.conflict?.trainset ?? null;
  const tsConfig = Object.fromEntries(s.affected.map(a => [a.id, a.config]));
  return {
    delayDays: s.disruption.delayDays,
    delayLine: `${s.disruption.delayDays} DAYS LATE`,
    component: 'CRITICAL COMPONENT',
    componentDetail: `${s.disruption.qty} traction inverter modules · ${s.disruption.part}`,
    affected: s.affected.map(a => a.id),
    atRisk: `${s.affected.length} PRODUCTS AT RISK`,
    rawRecords: s.reduce.rawRecords, rawLine: `${n(s.reduce.rawRecords)} SIGNALS`,
    evidenceItems: s.reduce.evidenceItems, evidenceLine: `${s.reduce.evidenceItems} EVIDENCE ITEMS`,
    reductionLine: `${s.reduce.reductionPercentage > 99 ? '>99' : Math.floor(s.reduce.reductionPercentage)}% LESS CONTEXT`,
    reductionExact: `${s.reduce.reductionPercentage.toFixed(1)} % fewer tokens than the raw data`,
    sources: s.sources.map(x => x.name),
    modelLine: `${n(s.decide.parameters)}-parameter decision model · ${s.decide.latencyMs < 1 ? '< 1 ms' : `${s.decide.latencyMs.toFixed(1)} ms`} · in the browser`,
    verdict: s.decide.verdict,
    verdictPre: s.decide.path === 'AGENTIC' ? 'COMPLEX CROSS-DOMAIN DECISION' : 'ROUTINE DECISION',
    specialists: ['PLANNING', 'SUPPLY', 'MANUFACTURING', 'COST + RISK'],
    systems: ['ERP', 'MES', 'Inventory', 'Configuration'],
    aiLine: `${s.ai.agentCalls} specialists · ${s.ai.a2aMessages} A2A messages · ${s.ai.toolCalls} MCP tool calls`,
    plan: s.plan.map(p => ({ trainset: p.trainset, kind: p.kind, protected: p.protected, short: { CONTINUE: 'Continue as planned', ALLOCATE_STOCK: 'Allocate existing inventory', RESEQUENCE_AND_SLACK: 'Resequence · use schedule slack' }[p.kind] ?? p.kind })),
    batchDay: s.disruption.newDay,
    deliveryProtected: e.deliveryProtected,
    values: [
      { big: `${s.disruption.delayDays} DAYS`, small: 'Original disruption' },
      { big: kEur(e.exposure), small: 'Business exposure' },
      { big: kEur(e.recoveryCost), small: 'Recovery cost' },
      { big: kEur(e.valueProtected), small: 'Value protected by the proposed recovery' }
    ],
    aiCost: `AI DECISION COST €${s.ai.costEur.toFixed(2)}`,
    aiCostNote: s.ai.estimated ? 'simulated provider · estimated tokens × Gemini Flash-tier price' : 'measured tokens',
    conflict: conflictTs ? { trainset: conflictTs, line: `${conflictTs} is ${tsConfig[conflictTs]} · the inverter in stock is validated for another configuration`, procedure: s.conflict.procedure } : null,
    finalState: s.states.afterEngineering,
    valueAfterEngineering: kEur(s.engineeringValidated.valueProtected)
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Second film — "Value first, built on Google's agentic stack" (media/film-google.html). Same story source.
import { tokenCostEur, PRICES, USD_TO_EUR } from '../../providers/prices.js';
export const GOOGLE_DURATION = 131;
export const GOOGLE_SCENES = { open: 0, company: 8, notice: 20, gate: 29, brute: 41, why: 57, adk: 71, a2a: 78, mcp: 86, contract: 94, savings: 101, twist: 114, end: 123 };

/**
 * Brute force vs curated context, computed — never run. Method (shown on screen):
 *  curated     = the specialists' tokens for this decision (same as the AI cost of the page);
 *  brute force = the same model turns, each also carrying every raw record (tokens ≈ characters ÷ 4);
 *  both priced at the Flash-tier list price (thinking billed as output).
 */
export function bruteForce(story) {
  const s = story, out = s.ai.outputTokens + s.ai.thinkingTokens;
  const curatedIn = s.ai.inputTokens, bruteIn = s.ai.inputTokens + s.ai.modelCalls * s.reduce.rawTokens;
  const curatedEur = tokenCostEur('flash', curatedIn, out), bruteEur = tokenCostEur('flash', bruteIn, out);
  return { turns: s.ai.modelCalls, rawPerTurn: s.reduce.rawTokens, evidenceTokens: s.reduce.evidenceTokens, curatedTokens: curatedIn + out, bruteTokens: bruteIn + out, curatedEur, bruteEur,
    factor: bruteEur / curatedEur, savedPct: (1 - curatedEur / bruteEur) * 100, relevantShare: s.reduce.evidenceItems / s.reduce.rawRecords * 100,
    price: `${PRICES.flash.label} list price $${PRICES.flash.inPerMUsd} in / $${PRICES.flash.outPerMUsd} out per M tokens · $1 = €${USD_TO_EUR}` };
}

const tok = v => v >= 1e6 ? `${(v / 1e6).toFixed(1)} M` : v >= 1e4 ? `${Math.round(v / 1000)} K` : n(v);
export function googleFilmFacts(story, stack) {
  const s = story, e = s.economics, b = bruteForce(s), c = s.company, r = s.decide.routine;
  const perEuro = e.valueProtected / s.ai.costEur;
  return {
    company: { name: c.name, product: c.product, trainsets: `${c.trainsetsInProduction} trainsets in production`, configurations: c.configurations, stations: c.stations, ld: `€${n(c.ldPerTrainsetDayEur)} per trainset per day late`, systems: `${c.systems} enterprise systems`, records: `${n(s.reduce.rawRecords)} records` },
    notice: { id: s.disruption.notice, qty: s.disruption.qty, part: s.disruption.part, line: `${s.disruption.qty} × ${s.disruption.part} · traction inverter modules`, delay: `${s.disruption.delayDays} days late`, affected: s.affected.map(a => a.id).join(' · '), trainsets: `${s.affected.length} trainsets` },
    routine: { line: `${r.qty} × ${r.part} · ${r.delayDays} day late`, margin: r.marginDays > 0 ? `Still arrives ${r.marginDays} days before ${r.trainset} needs it` : `Needed by ${r.trainset}`, impact: r.exposure > 0 ? `Exposure ${kEur(r.exposure)}` : 'No delivery at risk', aiCost: `€${r.aiCostEur.toFixed(2)}`, verdict: r.verdict, path: r.path },
    main: { atStake: kEur(e.exposure), lines: e.exposureLines.map(l => l.label.replace(/ TS-\d+$/, '')).filter((v, i, a) => a.indexOf(v) === i), verdict: s.decide.verdict, path: s.decide.path, model: `${n(s.decide.parameters)}-parameter decision model · in the browser · no LLM call` },
    ground: { raw: n(s.reduce.rawRecords), evidence: String(s.reduce.evidenceItems), pct: `${s.reduce.reductionPercentage.toFixed(1)} %` },
    brute: { turns: b.turns, rawPerTurn: tok(b.rawPerTurn), evidenceTokens: tok(b.evidenceTokens), bruteTokens: tok(b.bruteTokens), curatedTokens: tok(b.curatedTokens), bruteEur: `€${b.bruteEur.toFixed(2)}`, curatedEur: `€${b.curatedEur.toFixed(2)}`, ratio: b.curatedTokens / b.bruteTokens, factor: `${Math.round(b.factor)}×`, savedPct: `${b.savedPct.toFixed(1)} %`, share: `${b.relevantShare.toFixed(1)} %`, price: b.price,
      per1000: { brute: `€${n(b.bruteEur * 1000)}`, curated: `€${n(b.curatedEur * 1000)}` } },
    agents: Object.entries(stack.a2a).map(([id, c]) => ({ id, name: c.name, protocol: c.protocolVersion, tools: c.skills.filter(k => k.name !== 'model').map(k => k.name), transport: c.preferredTransport })),
    tools: stack.mcp.tools.map(t => ({ name: t.name, system: (t.description.match(/^\[([^\]]+)\]/) ?? [])[1] ?? '' })),
    sample: stack.mcp.sampleCall,
    packages: stack.packages, model: stack.model,
    plan: s.plan.map(p => ({ trainset: p.trainset, kind: p.kind, protected: p.protected })),
    values: { protected: kEur(e.valueProtected), cost: kEur(e.recoveryCost), exposure: kEur(e.exposure), residual: kEur(e.residualExposure) },
    ai: { cost: `€${s.ai.costEur.toFixed(2)}`, calls: s.ai.modelCalls, tools: s.ai.toolCalls, messages: s.ai.a2aMessages, estimated: s.ai.estimated },
    perEuro: perEuro >= 1e6 ? `${(perEuro / 1e6).toFixed(1)} million` : n(perEuro),
    conflict: s.conflict ? { trainset: s.conflict.trainset, procedure: s.conflict.procedure } : null,
    states: s.states
  };
}
