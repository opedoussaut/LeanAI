// Industrial Recovery — DECIDE: the shipped model, its parity with ONNX, and routing produced by the model.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { evaluate, decideJs, MODEL_CARD } from '../src/scenarios/rail/decision.js';
import { railFeatures } from '../src/scenarios/rail/features.js';
import { reduce } from '../src/scenarios/rail/evidence.js';
import { factsFrom } from '../src/scenarios/rail/recovery.js';

const featuresFor = notice => railFeatures(factsFrom(reduce(undefined, { notice }).evidence));

test('DECIDE: the ONNX file is the one in the model card, small, and the JS evaluator reproduces its golden outputs', () => {
  const bytes = readFileSync(new URL('../models/rail-system1/decision-mlp.onnx', import.meta.url));
  assert.equal(bytes.length, MODEL_CARD.onnx.bytes);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), MODEL_CARD.onnx.sha256);
  assert.ok(MODEL_CARD.parameters < 2_000);
  const golden = JSON.parse(readFileSync(new URL('../models/rail-system1/golden.json', import.meta.url), 'utf8'));
  golden.inputs.forEach((x, i) => { const p = evaluate(x); for (const k of Object.keys(golden.outputs)) p[k].forEach((v, j) => assert.ok(Math.abs(v - golden.outputs[k][i][j]) < 1e-4, `${k}[${i}][${j}]`)); });
  for (const k of ['reasoning_required_accuracy', 'route_accuracy', 'domains_exact_match']) assert.ok(MODEL_CARD.holdout[k] > 0.97, k);
});

test('DECIDE: the inverter disruption is routed to agentic reasoning by the model, with all four domains', () => {
  const { vector } = featuresFor('SN-26-0412');
  const d = decideJs(vector);
  assert.equal(d.gate.path, 'AGENTIC');
  assert.equal(d.gate.verdict, 'AGENTIC REASONING REQUIRED');
  assert.deepEqual(d.gate.agents, ['PLANNING', 'SUPPLY', 'CONFIGURATION', 'COST_RISK']);
  assert.ok(d.decisions.reasoning_required.confidence > 0.9);
});

test('DECIDE: the routine notice received the same day needs no agents', () => {
  const { vector } = featuresFor('SN-26-0409');
  const d = decideJs(vector);
  assert.equal(d.gate.path, 'DIRECT');
  assert.deepEqual(d.gate.agents, []);
});

test('DECIDE: the route follows the inputs, not a label — remove the cross-domain signals and agents are no longer needed', () => {
  const { vector } = featuresFor('SN-26-0412');
  const covered = [...vector]; covered[2] = 1;                 // exact-variant stock covers the need
  assert.equal(decideJs(covered).gate.path, 'DIRECT');
  const absorbed = [...vector]; absorbed[4] = 0.9;             // 9 days of slack absorb an 8-day delay
  assert.equal(decideJs(absorbed).gate.path, 'DIRECT');
});
