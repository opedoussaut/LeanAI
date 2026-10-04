// The single source of the Industrial Recovery story figures. The interactive page and the cinematic film both call
// railStory(); neither hard-codes a number. If the scenario economics change, both change with them (tested).
import { runRecovery, resolveEngineering } from './orchestrator.js';
import { COMPANY, fmtDay } from './dataset.js';
import { SOURCES } from './dataset.js';

export async function railStory(opts = {}) {
  const run = await runRecovery(opts);
  const validated = resolveEngineering(await runRecovery(opts), 'validate');
  const rejected = resolveEngineering(await runRecovery(opts), 'reject');
  const routine = await runRecovery({ ...opts, notice: 'SN-26-0409' });
  const e = run.economics, t = run.telemetry, F = run.facts;
  const conflict = run.validation.engineering[0];
  return {
    company: COMPANY,
    disruption: { part: F.disruption.part, qty: F.disruption.qty, delayDays: F.disruption.delayDays, supplier: F.disruption.supplier, notice: F.disruption.notice, originalDay: F.disruption.originalDay, newDay: F.disruption.newDay, newDate: fmtDay(F.disruption.newDay) },
    affected: F.pegged.map(p => ({ id: p.id, config: p.config, kitted: p.kitted, s30Day: p.s30Day, slack: p.slack })),
    sources: SOURCES,
    reduce: { rawRecords: t.rawRecords, evidenceItems: t.evidenceItems, reductionPercentage: t.reductionPercentage, processingTime: t.processingTime, stages: run.reduce.stages },
    decide: { parameters: t.decisionModel.parameters, latencyMs: t.decisionModel.latencyMs, confidence: t.decisionModel.confidence, verdict: t.decisionModel.verdict, path: run.decision.gate.path, domains: run.decision.gate.agents, features: run.features.values, routine: { verdict: routine.decision.gate.verdict, path: routine.decision.gate.path, part: routine.facts.disruption.part, delayDays: routine.facts.disruption.delayDays, exposure: routine.baseline.total, aiCostEur: routine.telemetry.aiCostEur } },
    plan: run.plan.actions.map(a => ({ trainset: a.trainset, kind: a.kind, text: a.text, delay: a.delay, slip: a.slip, protected: a.protected })),
    economics: { exposure: e.exposure, recoveryCost: e.recoveryCost, residualExposure: e.residualExposure, valueProtected: e.valueProtected, deliveryProtected: e.deliveryProtected, exposureLines: e.exposureLines, costLines: e.costLines },
    ai: { costEur: t.aiCostEur, modelCalls: t.modelCalls, agentCalls: t.agentCalls, toolCalls: t.toolCalls, a2aMessages: t.a2aMessages, inputTokens: t.inputTokens, outputTokens: t.outputTokens, thinkingTokens: t.thinkingTokens, latencyMs: t.totalLatencyMs, estimated: t.tokensEstimated, provider: t.provider },
    conflict: conflict ? { trainset: conflict.id.split('-').slice(-2).join('-'), detail: conflict.detail, procedure: run.deviation?.procedure, steps: run.deviation?.steps, fitsInSlot: run.deviation?.fitsInSlot, extraCostEur: run.deviation?.extraCostEur } : null,
    states: { afterValidation: run.governance.state, afterEngineering: validated.governance.state },
    engineeringValidated: { valueProtected: validated.economics.valueProtected, recoveryCost: validated.economics.recoveryCost, residualExposure: validated.economics.residualExposure },
    engineeringRejected: { valueProtected: rejected.economics.valueProtected, recoveryCost: rejected.economics.recoveryCost, residualExposure: rejected.economics.residualExposure }
  };
}
