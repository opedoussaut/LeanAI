// Records real artifacts of the Google agentic stack used by the Industrial Recovery scenario, without an API key:
// the MCP server's tool list (official MCP SDK client), the four specialists' A2A agent cards (served by Google ADK
// toA2a) and the package versions. Output: evidence/google/stack.json (read by the Google-stack film).
//   node scripts/record-google-stack.mjs        (needs the optional dependencies: npm install)
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { reduce } from '../src/scenarios/rail/evidence.js';
import { factsFrom } from '../src/scenarios/rail/recovery.js';
import { startRailMcpServer } from '../server/rail-mcp-server.mjs';
import { createGeminiAdkProvider } from '../src/providers/gemini-adk.mjs';
import { SPECIALISTS } from '../src/scenarios/rail/agents.js';

const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
const { StreamableHTTPClientTransport } = await import('@modelcontextprotocol/sdk/client/streamableHttp.js');
const ver = async p => JSON.parse(await readFile(new URL(`../node_modules/${p}/package.json`, import.meta.url), 'utf8')).version;
const { evidence } = reduce();
const mcp = await startRailMcpServer({ ctx: { evidence, F: factsFrom(evidence) }, port: 18871 });
const client = new Client({ name: 'leanai-recorder', version: '1.0.0' });
await client.connect(new StreamableHTTPClientTransport(new URL(mcp.url)));
const tools = (await client.listTools()).tools.map(t => ({ name: t.name, description: t.description, required: t.inputSchema?.required ?? [] }));
const sample = await client.callTool({ name: 'checkConfiguration', arguments: { part: 'TIM-3300-A', configuration: 'C-3' } });
await client.close();
const p = await createGeminiAdkProvider({ mcpUrl: mcp.url, requireKey: false, basePort: 18872 });
const cards = {};
for (const a of SPECIALISTS) { const c = await (await fetch(`${p.cards[a.id]}/.well-known/agent-card.json`)).json(); cards[a.id] = c; }
await p.close(); await mcp.close();
const out = {
  recordedAt: new Date().toISOString(), note: 'Recorded without a Gemini API key: no model call was made. Tool list and agent cards are the real responses of the servers.',
  packages: { '@google/adk': await ver('@google/adk'), '@google/genai': await ver('@google/genai'), '@a2a-js/sdk': await ver('@a2a-js/sdk'), '@modelcontextprotocol/sdk': await ver('@modelcontextprotocol/sdk') },
  model: process.env.GEMINI_MODEL ?? 'gemini-flash-latest',
  mcp: { server: 'novarail-enterprise-systems', transport: 'Streamable HTTP', tools, sampleCall: { tool: 'checkConfiguration', arguments: { part: 'TIM-3300-A', configuration: 'C-3' }, structuredContent: sample.structuredContent } },
  a2a: Object.fromEntries(Object.entries(cards).map(([id, c]) => [id, c]))
};
await mkdir(new URL('../evidence/google/', import.meta.url), { recursive: true });
await writeFile(new URL('../evidence/google/stack.json', import.meta.url), JSON.stringify(out, null, 2));
console.log(`evidence/google/stack.json · ${tools.length} MCP tools · ${Object.keys(cards).length} A2A agent cards`);
process.exit(0);
