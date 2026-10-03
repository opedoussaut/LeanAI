// LIVE provider — Gemini through Google's Agent Development Kit (ADK for TypeScript), Node only.
//   • each specialist is an ADK LlmAgent whose tools are an MCPToolset on the NovaRail MCP server (agent ↔ tool)
//   • each specialist is exposed as an A2A server with ADK's toA2a; the LeanAI orchestrator (code) reaches it with the
//     official A2A client (agent ↔ agent)
//   • token usage is read from the model responses (usageMetadata), not estimated
// Requires GEMINI_API_KEY (or GOOGLE_API_KEY) and the optional dependencies @google/adk, @a2a-js/sdk,
// @modelcontextprotocol/sdk. Never runs in the browser; the published site always uses the simulated provider.
import { MODES } from './provider.js';
import { SPECIALISTS } from '../scenarios/rail/agents.js';

const instructionFor = a => [
  `You are the ${a.name} specialist of NovaRail's recovery team (a fictional rail manufacturer; all data is synthetic).`,
  a.mission,
  'Use ONLY facts returned by your tools. Never invent a part, lot, quantity, date, cost or rule. If a tool fails, say so.',
  'Do not explain your reasoning. Reply with ONE JSON object and nothing else, with these keys:',
  JSON.stringify(Object.fromEntries(Object.entries(a.output.properties).map(([k, v]) => [k, v.type ?? 'any']))),
  `Required keys: ${a.output.required.join(', ')}. "summary" is one short factual sentence.`
].join('\n');

/** Pull the first JSON object out of whatever text the A2A response carries. */
export function extractJson(result) {
  const texts = [];
  const walk = v => { if (!v || typeof v !== 'object') return; if (v.$case === 'text' && typeof v.value === 'string') texts.push(v.value); if (typeof v.text === 'string') texts.push(v.text); for (const x of Object.values(v)) walk(x); };
  walk(result);
  for (const t of texts.reverse()) { const m = t.match(/\{[\s\S]*\}/); if (m) { try { return JSON.parse(m[0]); } catch { /* keep looking */ } } }
  throw new Error('No JSON object in the specialist response');
}

export async function createGeminiAdkProvider({ apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY, model = process.env.GEMINI_MODEL ?? 'gemini-flash-latest', mcpUrl, mcpLog = [], host = '127.0.0.1', basePort = 18810, requireKey = true } = {}) {
  if (requireKey && !apiKey) throw new Error('GEMINI_API_KEY is not set — the live provider cannot run. Use the simulated provider.');
  const { LlmAgent, MCPToolset, Gemini, toA2a } = await import('@google/adk');
  const { ClientFactory } = await import('@a2a-js/sdk/client');
  const usage = Object.fromEntries(SPECIALISTS.map(a => [a.id, []]));
  const servers = [], cards = {};
  const llm = new Gemini({ model, apiKey: apiKey ?? 'not-set' });

  for (const [i, a] of SPECIALISTS.entries()) {
    const agent = new LlmAgent({
      name: `novarail_${a.id}`, description: a.mission, model: llm, instruction: instructionFor(a),
      tools: [new MCPToolset({ type: 'StreamableHTTPConnectionParams', url: mcpUrl }, a.tools)],
      afterModelCallback: ({ response }) => { if (response?.usageMetadata) usage[a.id].push(response.usageMetadata); return undefined; }
    });
    const port = basePort + i;
    const app = await toA2a(agent, { host, port, allowUnauthenticated: true });   // local, loopback-only demo surface
    const srv = await new Promise(r => { const s = app.listen(port, host, () => r(s)); });
    servers.push(srv);
    cards[a.id] = `http://${host}:${port}`;
  }
  const factory = new ClientFactory();
  const clients = {};
  const clientFor = async id => (clients[id] ??= await factory.createFromUrl(cards[id]));

  return {
    id: 'gemini-adk', label: `Gemini (${model}) via Google ADK`, mode: MODES.LIVE, model,
    cards, servers,
    describe: () => ({ mode: MODES.LIVE, provider: 'Google ADK + Gemini API', model, a2a: cards, mcp: mcpUrl, note: 'Specialists are ADK agents served over A2A; their tools come from the NovaRail MCP server. Token usage is reported by the API.' }),
    async agentCard(id) { const c = await clientFor(id); return c.getAgentCard ? c.getAgentCard() : null; },
    async runSpecialist({ agent, input = {} }) {
      const client = await clientFor(agent.id);
      const before = usage[agent.id].length, callsBefore = mcpLog.length, t0 = Date.now();
      const text = `Task: ${input.task ?? 'analyse'}\nInputs: ${JSON.stringify(input)}`;
      const result = await client.sendMessage({ message: { messageId: crypto.randomUUID(), role: 1, parts: [{ content: { $case: 'text', value: text } }], contextId: '', taskId: '', metadata: {}, extensions: [], referenceTaskIds: [] } });
      const u = usage[agent.id].slice(before);
      return {
        output: extractJson(result),
        usage: { inputTokens: u.reduce((s, x) => s + (x.promptTokenCount ?? 0), 0), outputTokens: u.reduce((s, x) => s + (x.candidatesTokenCount ?? 0), 0), thinkingTokens: u.reduce((s, x) => s + (x.thoughtsTokenCount ?? 0), 0), estimated: false },
        latencyMs: Date.now() - t0, modelCalls: u.length,
        toolCalls: mcpLog.slice(callsBefore).map(c => ({ tool: c.tool, system: c.system, args: c.args, records: c.records }))
      };
    },
    async close() { await Promise.all(servers.map(s => new Promise(r => s.close(r)))); }
  };
}
