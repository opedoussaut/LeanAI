// LIVE mode for the Industrial Recovery scenario:   GEMINI_API_KEY=... npm run start:live
// Starts the NovaRail MCP server, the four ADK specialists (each an A2A server) and a small HTTP endpoint the page
// calls with ?provider=live. Loopback only. Without a key it refuses to start and the page stays SIMULATED.
import { createServer } from 'node:http';
import { reduce } from '../src/scenarios/rail/evidence.js';
import { factsFrom } from '../src/scenarios/rail/recovery.js';
import { runRecovery } from '../src/scenarios/rail/orchestrator.js';
import { startRailMcpServer } from './rail-mcp-server.mjs';
import { createGeminiAdkProvider } from '../src/providers/gemini-adk.mjs';

const PORT = Number(process.env.RAIL_LIVE_PORT ?? 18800), HOST = '127.0.0.1';
if (!process.env.GEMINI_API_KEY && !process.env.GOOGLE_API_KEY) {
  console.error('GEMINI_API_KEY is not set. Live mode needs your own Gemini API key (see .env.example).\nThe page keeps working in SIMULATED mode.');
  process.exit(1);
}
const { evidence } = reduce();
const mcp = await startRailMcpServer({ ctx: { evidence, F: factsFrom(evidence) } });
const provider = await createGeminiAdkProvider({ mcpUrl: mcp.url, mcpLog: mcp.calls });
const json = (res, code, obj) => { res.writeHead(code, { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-allow-private-network': 'true' }); res.end(JSON.stringify(obj)); };
let busy = false;
createServer(async (req, res) => {
  if (req.method === 'OPTIONS') { res.writeHead(204, { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-private-network': 'true' }); res.end(); return; }
  if (req.url === '/rail/status') return json(res, 200, { live: true, ...provider.describe() });
  if (req.url === '/rail/run') {
    if (busy) return json(res, 409, { error: 'A run is in progress' });
    busy = true;
    try {
      const run = await runRecovery({ provider });
      const { governance, ...rest } = run;
      json(res, 200, { ...rest, governance: { state: governance?.state, history: governance?.history } });
    } catch (e) { json(res, 500, { error: e.message }); } finally { busy = false; }
    return;
  }
  json(res, 404, { error: 'not found' });
}).listen(PORT, HOST, () => console.log(`Industrial Recovery LIVE on http://${HOST}:${PORT}/rail/status · MCP ${mcp.url} · A2A ${Object.values(provider.cards).join(', ')}\nOpen the page with ?provider=live#recovery`));
