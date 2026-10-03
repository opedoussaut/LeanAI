// LIVE mode — the NovaRail simulated enterprise systems served as a real MCP server (Streamable HTTP, stateless),
// built with the official MCP TypeScript SDK. The tool definitions and handlers are exactly those of
// src/scenarios/rail/tools.js, answering from the evidence pack, so a Gemini/ADK agent sees the same facts the
// simulated provider uses. Optional dependency: @modelcontextprotocol/sdk.
import { createServer } from 'node:http';
import { RAIL_SERVERS } from '../src/scenarios/rail/tools.js';

export async function startRailMcpServer({ ctx, port = 18801, host = '127.0.0.1' } = {}) {
  const { Server } = await import('@modelcontextprotocol/sdk/server/index.js');
  const { StreamableHTTPServerTransport } = await import('@modelcontextprotocol/sdk/server/streamableHttp.js');
  const { ListToolsRequestSchema, CallToolRequestSchema } = await import('@modelcontextprotocol/sdk/types.js');
  const tools = RAIL_SERVERS.flatMap(s => s.tools.map(t => ({ ...t, system: s.system })));
  const calls = [];

  const build = () => {
    const server = new Server({ name: 'novarail-enterprise-systems', title: 'NovaRail enterprise systems (simulated)', version: '1.0.0' }, { capabilities: { tools: {} } });
    server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: tools.map(t => ({ name: t.name, description: `[${t.system}] ${t.description}`, inputSchema: t.inputSchema, annotations: { readOnlyHint: true, openWorldHint: false } })) }));
    server.setRequestHandler(CallToolRequestSchema, async req => {
      const t = tools.find(x => x.name === req.params.name);
      if (!t) return { content: [{ type: 'text', text: `Unknown tool ${req.params.name}` }], isError: true };
      try {
        const { data, summary, records } = t.run(req.params.arguments ?? {}, ctx);
        calls.push({ tool: t.name, system: t.system, args: req.params.arguments ?? {}, records, at: Date.now() });
        return { content: [{ type: 'text', text: `${summary}\n${JSON.stringify(data)}` }], structuredContent: data };
      } catch (e) { return { content: [{ type: 'text', text: `Tool failed: ${e.message}` }], isError: true }; }
    });
    return server;
  };

  const http = createServer(async (req, res) => {
    if (!req.url.startsWith('/mcp')) { res.writeHead(404).end(); return; }
    let body = '';
    for await (const chunk of req) body += chunk;
    const server = build();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on('close', () => { transport.close(); server.close(); });
    await server.connect(transport);
    await transport.handleRequest(req, res, body ? JSON.parse(body) : undefined);
  });
  await new Promise(r => http.listen(port, host, r));
  return { url: `http://${host}:${port}/mcp`, calls, close: () => new Promise(r => http.close(r)) };
}
