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
