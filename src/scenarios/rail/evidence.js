// REDUCE — the evidence engine. Deterministic code turns ~18,400 enterprise records into a few dozen evidence
// items before any model is involved. Every item keeps its source system and the method that produced it.
// Nothing here calls a model; every count and percentage in the UI and the film is measured here.
import { generateRailDataset, countRecords, dayOf, D0, DAY } from './dataset.js';
import { estimateTokens, jsonBytes, now } from '../../lib/util.js';

const fromErp = s => dayOf(`${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`);
const fromEpoch = s => Math.floor((s * 1000 - D0) / DAY);
const isWeekend = d => ((d % 7) + 7) % 7 >= 5;

/** Run the six reduction stages. Returns evidence, stage counts and telemetry. */
export function reduce(dataset = generateRailDataset(), { horizonDays = 12, notice = 'SN-26-0412' } = {}) {
  const t0 = now();
  const rawRecords = countRecords(dataset);
  const rawBytes = jsonBytes(dataset);
  const stages = [];
  const ev = [];
  const add = (type, src, keys, v, method) => ev.push({ id: `E-${String(ev.length + 1).padStart(3, '0')}`, type, src, keys, v, method });

  // 1 · TRIGGER — supplier notices received today; the delayed PO line and what it is pegged to.
  const notices = dataset.supplier.filter(r => r.entry === 'NOTICE' && dayOf(r.received) === 0);
  const n = notices.find(r => r.notice === notice);
  if (!n) throw new Error('No supplier notice received today');
  const po = dataset.erp.find(r => r.record_type === 'PO_LINE' && r.po === n.po_ref && r.material === n.item);
  const delay = dayOf(n.new_date) - dayOf(n.old_date);
  add('DISRUPTION', 'supplier', { notice: n.notice, supplier: n.supplier }, { part: n.item, qty: n.qty, originalDay: dayOf(n.old_date), newDay: dayOf(n.new_date), delayDays: delay, reason: n.reason }, 'Supplier notice received today; dates normalised to working-day offsets.');
  add('PO_LINE', 'erp', { po: po.po, line: po.line }, { part: po.material, qty: po.qty, dueDay: fromErp(po.due_date), pegging: po.pegging.split(',') }, 'ERP purchase-order line matched on PO and material; YYYYMMDD due date normalised.');
  stages.push({ id: 'trigger', label: 'Trigger', what: 'Today’s supplier notice and the PO line it changes', recordsIn: rawRecords, recordsOut: 2 });

  // 2 · SCOPE — trainsets pegged to the delayed line, with configuration and kit status.
  const pegged = po.pegging.split(',');
  const sched = dataset.planning.filter(r => r.kind === 'SCHEDULE');
  const family = n.item.replace(/-[A-Z]$/, '');                       // part family without the variant letter (TIM-3300)
  const kits = dataset.inventory.filter(r => r.status === 'KITTED' && r.item.startsWith(family) && r.kitted_for);
  for (const ts of pegged) {
    const s30 = sched.find(r => r.trainset === ts && r.station === 'S30');
    const kit = kits.find(k => k.kitted_for.split(',').includes(ts));
    add('TRAINSET', 'planning', { trainset: ts }, { configuration: s30.configuration, s30Day: dayOf(s30.start), kitted: Boolean(kit), kitLot: kit?.lot ?? null }, 'Pegging from ERP joined with the planning schedule and line-side kits.');
  }
  stages.push({ id: 'scope', label: 'Scope', what: 'Trainsets pegged to the late batch', recordsIn: dataset.planning.length + dataset.inventory.length, recordsOut: pegged.length });

  // 3 · TRACE — operations that consume the delayed part, for trainsets not already kitted.
  const notKitted = pegged.filter(ts => !kits.some(k => k.kitted_for.split(',').includes(ts)));
  const ops = dataset.mes.filter(r => r.rec === 'OPERATION' && r.material === n.item && notKitted.includes(r.unit));
  for (const o of ops) add('OPERATION', 'mes', { order: o.order, trainset: o.unit, station: o.ws }, { text: o.text, day: fromEpoch(o.planned_start), stdHours: o.std_hours }, 'MES operations whose material is the delayed part; epoch timestamps normalised.');
  stages.push({ id: 'trace', label: 'Trace', what: 'Operations that need the delayed part', recordsIn: dataset.mes.length, recordsOut: ops.length });

  // 4 · SCHEDULE & CAPACITY — S30 sequence around the window, milestones with slack, S30 capacity and weekend overtime.
  const firstS30 = Math.min(...pegged.map(ts => dayOf(sched.find(r => r.trainset === ts && r.station === 'S30').start)));
  const window = [firstS30 - 2, firstS30 + horizonDays];
  const s30 = sched.filter(r => r.station === 'S30' && dayOf(r.start) >= window[0] && dayOf(r.start) <= window[0] + 12);
  for (const r of s30) add('S30_SLOT', 'planning', { trainset: r.trainset }, { configuration: r.configuration, startDay: dayOf(r.start), endDay: dayOf(r.end) }, 'Planned S30 (electrical integration) slot; single bay.');
  const inSeq = new Set(s30.map(r => r.trainset));
  const ms = dataset.planning.filter(r => r.kind === 'MILESTONE' && inSeq.has(r.trainset));
  for (const m of ms.filter(x => x.milestone === 'DELIVERY')) add('MILESTONE', 'planning', { trainset: m.trainset, contract: m.contract }, { plannedDay: dayOf(m.planned), contractualDay: dayOf(m.contractual), slackDays: dayOf(m.contractual) - dayOf(m.planned) }, 'Delivery milestone; slack = contractual − planned (working days).');
  for (const m of ms.filter(x => x.milestone === 'ACCEPTANCE_BOARD' && notKitted.includes(x.trainset))) add('ACCEPTANCE', 'planning', { trainset: m.trainset, contract: m.contract }, { boardDay: dayOf(m.planned) }, 'Monthly acceptance board that triggers the milestone payment.');
  const cap = dataset.planning.filter(r => r.kind === 'CAPACITY' && r.station === 'S30' && dayOf(r.date) >= 0 && dayOf(r.date) < horizonDays);
  for (let d = 0; d < horizonDays; d++) {
    const rows = cap.filter(r => dayOf(r.date) === d);
    add('S30_CAPACITY', 'planning', { day: d }, { bays: rows[0]?.bays ?? 0, crewShifts: rows.filter(r => r.crew_available > 0).length, weekend: isWeekend(d) }, 'Shift capacity rows aggregated per day for the S30 bay.');
  }
  const ot = dataset.planning.filter(r => r.kind === 'CAPACITY' && ['S40', 'S50'].includes(r.station) && r.weekend_overtime_possible && dayOf(r.date) >= 0 && dayOf(r.date) < 3 * horizonDays);
  for (const st of ['S40', 'S50']) add('OVERTIME', 'planning', { station: st }, { weekendShifts: ot.filter(r => r.station === st).map(r => dayOf(r.date)) }, 'Weekend shifts where overtime is possible, per station.');
  stages.push({ id: 'schedule', label: 'Schedule', what: 'S30 sequence, slack and capacity in the window', recordsIn: dataset.planning.length, recordsOut: ev.length - 2 - pegged.length - ops.length });

  // 5 · SUPPLY — every lot of the part family (all variants), logistics lanes, supplier options and history, quality holds.
  const before5 = ev.length;
  const lots = dataset.inventory.filter(r => r.item.startsWith(family));
  for (const l of lots) add('STOCK_LOT', 'inventory', { lot: l.lot, location: l.loc }, { part: l.item, qty: l.on_hand, status: l.status, kittedFor: l.kitted_for?.split(',') ?? [], minServiceStock: l.min_service_stock ?? null }, 'Inventory lots of the delayed part family (all variants) — a variant match is checked later, not assumed.');
  const locs = new Set(lots.map(l => l.loc));
  for (const l of dataset.logistics.filter(r => r.doc === 'LANE' && (locs.has(r.from) || r.from === n.supplier))) add('LANE', 'logistics', { from: l.from, to: l.to }, { days: l.lead_time_days, costEur: l.cost_eur, mode: l.mode }, 'Transfer lanes from the lots’ locations to the S30 line side.');
  for (const o of dataset.supplier.filter(r => r.entry === 'OPTION' && r.item === n.item)) add('SUPPLIER_OPTION', 'supplier', { option: o.option, supplier: o.supplier }, { text: o.text, qty: o.qty, day: o.date ? dayOf(o.date) : null, extraCostEur: o.extra_cost_eur, qualified: o.qualified }, 'Alternatives offered for the delayed item.');
  const hist = dataset.supplier.filter(r => r.entry === 'COMMITMENT' && r.supplier === n.supplier);
  add('SUPPLIER_HISTORY', 'supplier', { supplier: n.supplier }, { commitments: hist.length, onTimeAvg: Math.round(hist.reduce((a, r) => a + r.otd_score, 0) / Math.max(1, hist.length) * 100) / 100 }, 'Supplier commitment history aggregated to one reliability figure.');
  const lotIds = new Set(lots.map(l => l.lot));
  for (const q of dataset.quality.filter(r => r.qrec === 'NCR' && lotIds.has(r.object))) add('QUALITY_HOLD', 'quality', { ncr: q.id, lot: q.object }, { text: q.text, since: dayOf(q.date) }, 'Open non-conformances on the relevant lots.');
  stages.push({ id: 'supply', label: 'Supply', what: 'Stock of every variant, lanes, supplier options, quality holds', recordsIn: dataset.inventory.length + dataset.logistics.length + dataset.supplier.length + dataset.quality.length, recordsOut: ev.length - before5 });

  // 6 · CONSTRAINTS & ECONOMICS — configuration rules for the family, deviation procedure, contract terms and rates.
  const before6 = ev.length;
  for (const c of dataset.configuration.filter(r => r.obj === 'EFFECTIVITY' && r.item.startsWith(family))) add('CONFIG_RULE', 'configuration', { configuration: c.configuration, part: c.item }, { status: c.status, baseline: c.baseline, note: c.note ?? null }, 'Configuration effectivity for each variant of the part family.');
  for (const p of dataset.configuration.filter(r => r.obj === 'PROCEDURE' && r.item.startsWith(family))) add('DEVIATION_PROCEDURE', 'configuration', { id: p.id }, { part: p.item, configuration: p.configuration, steps: p.steps, s50ExtraHours: p.s50_extra_hours, signOff: p.sign_off }, 'Engineering procedure attached to a variant substitution.');
  const contracts = new Set(ms.map(m => m.contract));
  for (const c of dataset.cost.filter(r => r.entry === 'CONTRACT' && contracts.has(r.id))) add('CONTRACT', 'cost', { contract: c.id }, { ldPerTrainsetDayEur: c.ld_cents_per_trainset_day / 100, milestonePaymentEur: c.milestone_payment_cents / 100 }, 'Contract terms; cents converted to euros.');
  for (const r of dataset.cost.filter(x => x.entry === 'RATE')) { const { entry, id, ...v } = r; add('RATE', 'cost', { rate: id }, v, 'Cost rate used by the economics model.'); }
  stages.push({ id: 'constraints', label: 'Constraints', what: 'Configuration rules, deviation procedure, contracts and rates', recordsIn: dataset.configuration.length + dataset.cost.length, recordsOut: ev.length - before6 });

  const evidenceBytes = jsonBytes(ev);
  const rawTokens = Math.ceil(rawBytes / 4), evidenceTokens = estimateTokens(ev);
  const telemetry = {
    rawRecords, evidenceItems: ev.length, sourceRecords: Object.fromEntries(Object.entries(dataset).map(([k, l]) => [k, l.length])), rawBytes, evidenceBytes, rawTokens, evidenceTokens,
    reductionPercentage: (1 - evidenceTokens / rawTokens) * 100,
    recordReductionPercentage: (1 - ev.length / rawRecords) * 100,
    processingTime: now() - t0
  };
  return { evidence: ev, stages, telemetry, byType: type => ev.filter(e => e.type === type) };
}
