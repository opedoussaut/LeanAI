// Provider abstraction. Business logic (the orchestrator) only ever calls
//   provider.runSpecialist({ agent, input, callTool, evidenceBrief })
//     → { output, usage: { inputTokens, outputTokens, thinkingTokens, estimated }, latencyMs, modelCalls }
// and never depends on a vendor's prompt behaviour. Two implementations:
//   SIMULATED — deterministic replay of each specialist's tool-grounded behaviour (works everywhere, no secrets)
//   LIVE      — Gemini through Google ADK (Node only, needs GEMINI_API_KEY): src/providers/gemini-adk.mjs
// Models are replaceable; the business architecture is not.
export const MODES = { SIMULATED: 'SIMULATED', LIVE: 'LIVE' };

/** Contract check used by the tests and by the orchestrator before trusting a provider. */
export function assertProvider(p) {
  for (const k of ['id', 'label', 'mode', 'runSpecialist', 'describe']) if (!(k in p)) throw new Error(`Provider is missing "${k}"`);
  if (!Object.values(MODES).includes(p.mode)) throw new Error(`Unknown provider mode ${p.mode}`);
  return p;
}
