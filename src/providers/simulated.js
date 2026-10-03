// SIMULATED provider — deterministic, labelled, no network, no secrets.
// It runs each specialist's tool-grounded behaviour (agents.js → simulate) through the real MCP client, so every
// conclusion still comes from enterprise tools. Tokens are ESTIMATED from the actual context the specialist would
// receive (instruction + task + tool results, ≈ 4 characters per token) plus a stated thinking budget.
import { estimateTokens } from '../lib/util.js';
import { MODES } from './provider.js';

export const THINKING_BUDGET = 256;   // assumed thinking tokens per model turn (stated estimate)
export const LATENCY = { ttftMs: 450, prefillTps: 9_000, decodeTps: 180 };   // illustrative Flash-tier latency profile

export function createSimulatedProvider() {
  return {
    id: 'simulated', label: 'Simulated provider (deterministic replay)', mode: MODES.SIMULATED, model: 'flash',
    describe: () => ({ mode: MODES.SIMULATED, provider: 'Simulated provider', model: 'Gemini Flash tier (priced, not called)', note: 'No model is called. Specialist outputs are produced deterministically from the same MCP tools; tokens are estimated.' }),
    async runSpecialist({ agent, input = {}, callTool, evidenceBrief, toolDefs }) {
      const toolResults = [];
      const call = async (name, args) => { const r = await callTool(name, args); toolResults.push({ tool: name, data: r.data }); return r; };
      const output = await agent.simulate(call, input);
      // A tool-using model works in turns: each tool call is one model turn that re-reads the instruction, the tool
      // declarations, the task and every tool result so far; a final turn writes the structured output.
      const fixed = estimateTokens({ instruction: agent.mission, tools: (toolDefs ?? []).filter(t => agent.tools.includes(t.name)), task: input.task ?? null, brief: evidenceBrief ?? null, inputs: input });
      const turns = toolResults.length + 1;
      let inputTokens = 0;
      for (let k = 0; k < turns; k++) inputTokens += fixed + estimateTokens(toolResults.slice(0, k));
      const outputTokens = estimateTokens(output) + toolResults.length * 40;      // final output + function-call requests
      const thinkingTokens = THINKING_BUDGET * turns;
      const latencyMs = Math.round(turns * LATENCY.ttftMs + inputTokens / LATENCY.prefillTps * 1000 + (outputTokens + thinkingTokens) / LATENCY.decodeTps * 1000);
      return { output, usage: { inputTokens, outputTokens, thinkingTokens, estimated: true }, latencyMs, modelCalls: turns };
    }
  };
}
