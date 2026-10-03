// Industrial Recovery — provider abstraction, simulated mode, end-to-end orchestration, and live plumbing (no key).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runRecovery, resolveEngineering } from '../src/scenarios/rail/orchestrator.js';
import { createSimulatedProvider } from '../src/providers/simulated.js';
import { assertProvider, MODES } from '../src/providers/provider.js';
import { reduce } from '../src/scenarios/rail/evidence.js';
import { factsFrom } from '../src/scenarios/rail/recovery.js';

const has = async m => { try { await import(m); return true; } catch { return false; } };

test('provider: the orchestrator accepts any provider that honours the contract, and labels its mode', async () => {
  assert.throws(() => assertProvider({ id: 'x' }), /missing/);
  const sim = assertProvider(createSimulatedProvider());
  assert.equal(sim.mode, MODES.SIMULATED);
  // a different (fake) provider plugs in without touching business logic, and its outputs are still validated
  const other = { id: 'other', label: 'Another model', mode: 'LIVE', model: 'any', describe: () => ({ mode: 'LIVE', provider: 'Another' }),
    runSpecialist: (args) => createSimulatedProvider().runSpecialist(args).then(r => ({ ...r, usage: { ...r.usage, estimated: false } })) };
  const run = await runRecovery({ provider: other });
  assert.equal(run.provider.provider, 'Another');
  assert.equal(run.validation.verdict, 'ENGINEERING_REVIEW');
  const broken = { ...other, runSpecialist: async () => ({ output: { summary: 'I think it is fine' }, usage: {}, latencyMs: 1, modelCalls: 1 }) };
  await assert.rejects(() => runRecovery({ provider: broken }), /breaks its contract/);
});

test('orchestration (simulated): agents run only after the model routes AGENTIC; every conclusion is tool-grounded and verified', async () => {
  const run = await runRecovery();
  assert.equal(run.routed, 'AGENTIC');
  assert.equal(run.provider.mode, 'SIMULATED');
  assert.ok(run.telemetry.tokensEstimated);
  assert.deepEqual(run.agreement, { exposure: true, recoveryCost: true, valueProtected: true });
  assert.ok(run.toolCalls.length >= 10);
  assert.ok(run.toolCalls.every(c => ['ERP', 'MES', 'Inventory', 'Planning', 'Configuration', 'Cost/Risk'].includes(c.system)));
  assert.equal(run.messages.length, 8);                           // 4 requests + 4 replies over A2A
  assert.ok(run.messages.every(m => m.envelope.method === 'message/send'));
  assert.equal(run.governance.state, 'ENGINEERING_REVIEW_REQUIRED');
  assert.ok(run.specialists.configuration.conflict);
  assert.ok(run.telemetry.aiCostEur > 0 && run.telemetry.aiCostEur < 1);
  assert.equal(run.telemetry.modelCalls, run.modelCalls.reduce((a, m) => a + m.calls, 0));
});

test('orchestration (simulated): the routine notice is handled without any agent or model call', async () => {
  const run = await runRecovery({ notice: 'SN-26-0409' });
  assert.equal(run.routed, 'DIRECT');
  assert.equal(run.telemetry.modelCalls, 0);
  assert.equal(run.telemetry.toolCalls, 0);
  assert.equal(run.telemetry.aiCostEur, 0);
});

test('engineering loop: validate → approval possible; reject → approved-variants replan, lower value', async () => {
  const v = resolveEngineering(await runRecovery(), 'validate');
  assert.equal(v.governance.state, 'AWAITING_HUMAN_APPROVAL');
  const r = resolveEngineering(await runRecovery(), 'reject');
  assert.equal(r.governance.state, 'AWAITING_HUMAN_APPROVAL');
  assert.ok(r.economics.valueProtected < v.economics.valueProtected);
  assert.ok(r.plan.allocations.every(a => a.part === 'TIM-3300-B'));
});

test('live plumbing without a key: real MCP server (official SDK) and ADK specialists exposed over A2A', { skip: !(await has('@modelcontextprotocol/sdk/client/index.js')) || !(await has('@google/adk')) }, async () => {
  const { startRailMcpServer } = await import('../server/rail-mcp-server.mjs');
  const { createGeminiAdkProvider } = await import('../src/providers/gemini-adk.mjs');
  const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
  const { StreamableHTTPClientTransport } = await import('@modelcontextprotocol/sdk/client/streamableHttp.js');
  const { evidence } = reduce();
  const mcp = await startRailMcpServer({ ctx: { evidence, F: factsFrom(evidence) }, port: 18891 });
  try {
    const client = new Client({ name: 'leanai-test', version: '1.0.0' });
    await client.connect(new StreamableHTTPClientTransport(new URL(mcp.url)));
    const { tools } = await client.listTools();
    assert.ok(tools.some(t => t.name === 'checkConfiguration'));
    const res = await client.callTool({ name: 'checkConfiguration', arguments: { part: 'TIM-3300-A', configuration: 'C-3' } });
    assert.equal(res.structuredContent.status, 'NOT_APPROVED');
    await client.close();
    const p = await createGeminiAdkProvider({ mcpUrl: mcp.url, requireKey: false, basePort: 18892 });
    try {
      assert.equal(p.mode, 'LIVE');
      for (const id of ['supply', 'planning', 'cost', 'configuration']) {
        const card = await (await fetch(`${p.cards[id]}/.well-known/agent-card.json`)).json();
        assert.match(card.name, new RegExp(`novarail_${id}`));
      }
    } finally { await p.close(); }
  } finally { await mcp.close(); }
});
