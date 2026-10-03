// Industrial Recovery — enterprise tools (MCP) and governance states.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reduce } from '../src/scenarios/rail/evidence.js';
import { factsFrom, buildPlan, validate } from '../src/scenarios/rail/recovery.js';
import { RAIL_SERVERS } from '../src/scenarios/rail/tools.js';
import { createMcpClient, inProcessMcpTransport } from '../src/adapters/mcp.js';
import { createDecision } from '../src/scenarios/rail/governance.js';

const ctx = () => { const { evidence } = reduce(); return { evidence, F: factsFrom(evidence) }; };

test('tools: enterprise systems answer over MCP JSON-RPC from the evidence, and reject what they do not know', async () => {
  const c = ctx(), mcp = createMcpClient({ servers: RAIL_SERVERS, transport: inProcessMcpTransport(RAIL_SERVERS, () => c) });
  const d = await mcp.callTool('erp', 'getDisruption', {});
  assert.equal(d.data.delayDays, 8);
  const stock = await mcp.callTool('inventory', 'findStock', { family: 'TIM-3300' });
  assert.equal(stock.data.lots.find(l => l.lot === 'L-7745').usable, false);
  const cfg = await mcp.callTool('configuration', 'checkConfiguration', { part: 'TIM-3300-A', configuration: 'C-3' });
  assert.equal(cfg.data.status, 'NOT_APPROVED');
  await assert.rejects(() => mcp.callTool('inventory', 'checkLot', { lot: 'L-0000' }), /not found/);
  await assert.rejects(() => mcp.callTool('inventory', 'findStock', { family: 'BRK-1000' }), /out of scope/);
  await assert.rejects(() => mcp.callTool('erp', 'inventStock', {}), /Unknown tool/);
});

test('governance: a plan cannot reach APPROVED without validation, engineering sign-off and a person', () => {
  const { F } = ctx();
  const v = validate(F, buildPlan(F));
  const d = createDecision();
  assert.throws(() => d.apply('approve', { actor: 'approver' }), /not allowed/);         // still PROPOSED
  d.validate(v);
  assert.equal(d.state, 'ENGINEERING_REVIEW_REQUIRED');
  assert.throws(() => d.apply('approve', { actor: 'approver' }), /not allowed/);
  assert.throws(() => d.apply('engineering_validate', { actor: 'agent' }), /cannot perform/);   // an agent cannot authorise itself
  d.apply('engineering_validate', { actor: 'engineer' });
  assert.equal(d.state, 'ENGINEERING_VALIDATED');
  assert.throws(() => d.apply('approve', { actor: 'approver' }), /not allowed/);
  d.apply('submit', { actor: 'validator' });
  assert.throws(() => d.apply('approve', { actor: 'agent' }), /cannot perform/);
  d.apply('approve', { actor: 'approver' });
  d.apply('execute', { actor: 'system' });
  assert.equal(d.state, 'EXECUTED_SIMULATED');
  assert.deepEqual(d.history.map(h => h.state), ['PROPOSED', 'ENGINEERING_REVIEW_REQUIRED', 'ENGINEERING_VALIDATED', 'AWAITING_HUMAN_APPROVAL', 'APPROVED', 'EXECUTED_SIMULATED']);
});

test('governance: engineering rejection sends the plan back to operations; an invalid plan is rejected by validation', () => {
  const { F } = ctx();
  const d = createDecision().validate(validate(F, buildPlan(F)));
  d.apply('engineering_reject', { actor: 'engineer' });
  assert.equal(d.state, 'PROPOSED');
  d.validate(validate(F, buildPlan(F, { approvedVariantsOnly: true })));
  assert.equal(d.state, 'AWAITING_HUMAN_APPROVAL');
  const bad = buildPlan(F); bad.allocations.push({ lot: 'L-7745', part: 'TIM-3300-B', qty: 2, readyDay: 0, trainset: 'TS-48' });
  assert.equal(createDecision().validate(validate(F, bad)).state, 'REJECTED');
});
