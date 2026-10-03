// Industrial Recovery (NovaRail) — data, REDUCE, economics, VALIDATE, ENGINEER.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateRailDataset, countRecords, DISRUPTION, INVERTER_LOTS } from '../src/scenarios/rail/dataset.js';
import { reduce } from '../src/scenarios/rail/evidence.js';
import { factsFrom, baseline, buildPlan, economics, validate, deviationAssessment, availableStock } from '../src/scenarios/rail/recovery.js';

const run = () => { const { evidence, telemetry } = reduce(); const F = factsFrom(evidence); return { evidence, telemetry, F }; };

test('data: the synthetic dataset is deterministic and has ~18,400 structured records from nine systems', () => {
  const a = generateRailDataset(), b = generateRailDataset();
  assert.equal(JSON.stringify(a), JSON.stringify(b));
  const n = countRecords(a);
  assert.equal(n, 18_404);
  assert.deepEqual(Object.keys(a).sort(), ['configuration', 'cost', 'erp', 'inventory', 'logistics', 'mes', 'planning', 'quality', 'supplier']);
  for (const [k, list] of Object.entries(a)) assert.ok(list.length > 300, `${k} has ${list.length}`);
  // consistency: the delayed PO line, its pegging and its notice exist and agree
  const po = a.erp.find(r => r.po === DISRUPTION.po && r.material === DISRUPTION.part);
  const notice = a.supplier.find(r => r.entry === 'NOTICE');
  assert.equal(po.pegging, DISRUPTION.peggedTo.join(','));
  assert.equal(notice.po_ref, po.po);
  for (const l of INVERTER_LOTS) assert.ok(a.inventory.some(r => r.lot === l.lot && r.item === l.part && r.on_hand === l.qty));
});

test('REDUCE: ~18,400 records become 60–80 evidence items, >99 % less context, computed not typed in', () => {
  const { evidence, telemetry } = run();
  assert.equal(telemetry.rawRecords, 18_404);
  assert.equal(telemetry.evidenceItems, evidence.length);
  assert.ok(evidence.length >= 60 && evidence.length <= 80, `${evidence.length}`);
  assert.ok(telemetry.reductionPercentage > 99, `${telemetry.reductionPercentage}`);
  assert.equal(telemetry.reductionPercentage, (1 - telemetry.evidenceTokens / telemetry.rawTokens) * 100);
  assert.ok(telemetry.processingTime >= 0);
  for (const e of evidence) assert.ok(e.src && e.method && e.type, e.id);
});

test('REDUCE keeps the evidence the decision depends on (and every inverter variant, not only the ordered one)', () => {
  const { evidence } = run();
  const has = (type, pred = () => true) => evidence.some(e => e.type === type && pred(e));
  assert.ok(has('DISRUPTION', e => e.v.delayDays === 8 && e.v.qty === 18));
  for (const ts of ['TS-47', 'TS-48', 'TS-49']) assert.ok(has('TRAINSET', e => e.keys.trainset === ts));
  for (const l of INVERTER_LOTS) assert.ok(has('STOCK_LOT', e => e.keys.lot === l.lot), l.lot);
  assert.ok(has('CONFIG_RULE', e => e.keys.part === 'TIM-3300-A' && e.keys.configuration === 'C-3' && e.v.status === 'NOT_APPROVED'));
  assert.ok(has('QUALITY_HOLD', e => e.keys.lot === 'L-7745'));
  assert.ok(has('DEVIATION_PROCEDURE'));
  assert.ok(!has('OPERATION', e => e.keys.trainset === 'TS-47'), 'kitted trainset needs no trace');
});

test('economics: exposure, recovery cost, residual and value protected are derived and consistent', () => {
  const { F } = run();
  const base = baseline(F), plan = buildPlan(F), e = economics(F, plan, base);
  assert.equal(e.exposure, base.lines.reduce((a, l) => a + l.eur, 0));
  assert.equal(e.recoveryCost, plan.costs.reduce((a, c) => a + c.eur, 0));
  assert.equal(e.valueProtected, e.exposure - e.recoveryCost - e.residualExposure);
  assert.ok(e.exposure > 380_000 && e.exposure < 460_000, `${e.exposure}`);
  assert.ok(e.recoveryCost > 25_000 && e.recoveryCost < 40_000, `${e.recoveryCost}`);
  assert.equal(e.residualExposure, 0);
  assert.equal(e.deliveryProtected, true);
  assert.equal(e.disruptionDays, 8);
  assert.equal(e.affected, 3);
});

test('the recovery plan emerges from the data: TS-47 continues, TS-48 uses existing stock, TS-49 resequences and uses slack', () => {
  const { F } = run();
  const a = Object.fromEntries(buildPlan(F).actions.map(x => [x.trainset, x]));
  assert.equal(a['TS-47'].kind, 'CONTINUE');
  assert.equal(a['TS-48'].kind, 'ALLOCATE_STOCK');
  assert.deepEqual(a['TS-48'].allocations.map(x => x.lot).sort(), ['L-7690', 'L-7731']);
  assert.equal(a['TS-49'].kind, 'RESEQUENCE_AND_SLACK');
  assert.ok(a['TS-49'].slackUsed > 0);
});

test('tools/inventory: held, service-reserved and kitted stock is never offered', () => {
  const { F } = run();
  const lots = availableStock(F).map(l => l.lot);
  assert.ok(!lots.includes('L-7745'), 'quality hold');
  assert.ok(!lots.includes('L-7702'), 'service reserve');
  assert.ok(!lots.includes('L-7752'), 'kitted for other trainsets');
});

test('VALIDATE: an infeasible plan (held stock, late arrival) is rejected deterministically', () => {
  const { F } = run();
  const plan = buildPlan(F);
  const bad = structuredClone(plan);
  bad.allocations.push({ lot: 'L-7745', part: 'TIM-3300-B', location: 'WH-N1', qty: 2, readyDay: 0, trainset: 'TS-48' });
  bad.allocations.push({ lot: 'L-7731', part: 'TIM-3300-B', location: 'WH-N1', qty: 9, readyDay: 7, trainset: 'TS-49' });
  const v = validate(F, bad);
  assert.equal(v.verdict, 'INVALID');
  assert.ok(v.blocking.some(c => c.id === 'free-L-7745'));
  assert.ok(v.blocking.some(c => c.id.startsWith('exists-L-7731')));
  assert.ok(v.blocking.some(c => c.id.startsWith('date-L-7731')));
});

test('ENGINEER: the variant from another validated configuration triggers engineering review, not approval', () => {
  const { F } = run();
  const v = validate(F, buildPlan(F));
  assert.equal(v.verdict, 'ENGINEERING_REVIEW');
  assert.deepEqual(v.engineering.map(c => c.id), ['config-L-7690-TS-48']);
  assert.equal(v.blocking.length, 0);
  const d = deviationAssessment(F, v.engineering);
  assert.equal(d.fitsInSlot, true);
  assert.equal(d.extraCostEur, 0);
});

test('ENGINEER (rejected): the approved-variants-only fallback is valid, costs more and leaves residual exposure', () => {
  const { F } = run();
  const base = baseline(F), first = economics(F, buildPlan(F), base);
  const fb = buildPlan(F, { approvedVariantsOnly: true }), e = economics(F, fb, base);
  assert.equal(validate(F, fb).verdict, 'VALID');
  assert.ok(fb.allocations.every(a => a.part === 'TIM-3300-B'));
  assert.ok(e.residualExposure > 0 && e.recoveryCost > first.recoveryCost);
  assert.ok(e.valueProtected < first.valueProtected);
});
