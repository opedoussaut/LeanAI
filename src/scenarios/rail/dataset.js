// NovaRail — synthetic enterprise data for the Industrial Recovery scenario.
// Seeded and deterministic: every run regenerates exactly the same records, so tests, the app and the film agree.
// Nine simulated systems (ERP, MES, planning, inventory, supplier management, logistics, quality,
// configuration management, cost/risk). Formats differ on purpose (ERP dates YYYYMMDD, MES epoch seconds,
// planning ISO dates, money in cents in one system and euros in another) so the evidence engine has real work.
// Everything here is fictional. NovaRail is not a real company.
import { prng } from '../../lib/util.js';

const DAY = 86_400_000;
export const D0 = Date.UTC(2026, 9, 5);                 // Monday 5 October 2026 — the day the supplier notice arrives
const dayIso = d => new Date(D0 + d * DAY).toISOString().slice(0, 10);
const erpDate = d => dayIso(d).replaceAll('-', '');
const epoch = (d, h = 6) => Math.round((D0 + d * DAY + h * 3_600_000) / 1000);
export const dayOf = iso => Math.round((Date.parse(`${iso}T00:00:00Z`) - D0) / DAY);
export const fmtDay = d => new Date(D0 + d * DAY).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

// ---------------------------------------------------------------------------------------------------------
// Ground truth the generator writes into the systems (and that the tests check against).
// ---------------------------------------------------------------------------------------------------------
export const COMPANY = { name: 'NovaRail', plant: 'Plant North', product: 'NR-E electric trainset', note: 'Fictional company · synthetic data' };

export const CONFIGS = {
  'C-2': { id: 'C-2', name: 'NR-E Regio · 4-car', cars: 4, inverters: 4, inverterVariant: 'TIM-3300-A' },
  'C-3': { id: 'C-3', name: 'NR-E Intercity · 6-car', cars: 6, inverters: 6, inverterVariant: 'TIM-3300-B' }
};
/** Line stations in flow order; duration in production days for one trainset. S30 has a main bay and a second (buffer) bay. */
export const STATIONS = [
  { id: 'S10', name: 'Bogies & underframe', days: 2, bays: 2 },
  { id: 'S20', name: 'Carbody & paint', days: 2, bays: 2 },
  { id: 'S30', name: 'Electrical integration', days: 2, bays: 2 },
  { id: 'S40', name: 'Interior fit-out', days: 2, bays: 2 },
  { id: 'S50', name: 'Static test', days: 2, bays: 1 },
  { id: 'S60', name: 'Dynamic test', days: 2, bays: 1 },
  { id: 'S70', name: 'Acceptance & delivery', days: 1, bays: 1 }
];
/** Trainsets in production. s30 = planned S30 start day; slack = working days between planned completion and contract date. */
export const TRAINSETS = [
  { id: 'TS-44', config: 'C-3', s30: -8, slack: 4, contract: 'CT-2207', kitted: true },
  { id: 'TS-45', config: 'C-2', s30: -6, slack: 3, contract: 'CT-2311', kitted: true },
  { id: 'TS-46', config: 'C-3', s30: -2, slack: 2, contract: 'CT-2207', kitted: true },
  { id: 'TS-47', config: 'C-3', s30: 0, slack: 2, contract: 'CT-2207', kitted: true },   // kitted from line-side buffer, borrowed against the late batch
  { id: 'TS-48', config: 'C-3', s30: 2, slack: 0, contract: 'CT-2207', kitted: false },
  { id: 'TS-49', config: 'C-3', s30: 4, slack: 3, contract: 'CT-2207', kitted: false },
  { id: 'TS-50', config: 'C-2', s30: 6, slack: 2, contract: 'CT-2311', kitted: true },
  { id: 'TS-51', config: 'C-2', s30: 8, slack: 2, contract: 'CT-2311', kitted: true },
  { id: 'TS-52', config: 'C-3', s30: 10, slack: 3, contract: 'CT-2207', kitted: false },
  { id: 'TS-53', config: 'C-2', s30: 12, slack: 4, contract: 'CT-2311', kitted: false },
  { id: 'TS-54', config: 'C-3', s30: 14, slack: 4, contract: 'CT-2207', kitted: false },
  { id: 'TS-55', config: 'C-2', s30: 16, slack: 5, contract: 'CT-2311', kitted: false }
];
/** The disruption: the supplier notice received on D0. */
export const DISRUPTION = {
  id: 'SN-26-0412', supplier: 'SUP-114', supplierName: 'Voltaris Power Electronics (fictional)', po: 'PO-4500918', line: 10,
  part: 'TIM-3300-B', partName: 'Traction inverter module, 3.3 kV, variant B', qty: 18,
  originalDay: 1, newDay: 9, peggedTo: ['TS-47', 'TS-48', 'TS-49'], reason: 'IGBT stack re-test at the supplier'
};
/** Traction inverter stock (the lots the evidence must find). */
export const INVERTER_LOTS = [
  { lot: 'L-7731', part: 'TIM-3300-B', qty: 4, location: 'WH-N1', site: 'Plant North', status: 'FREE', approvedFor: ['C-3'] },
  { lot: 'L-7745', part: 'TIM-3300-B', qty: 2, location: 'WH-N1', site: 'Plant North', status: 'QUALITY_HOLD', ncr: 'NCR-2291', approvedFor: ['C-3'] },
  { lot: 'L-7702', part: 'TIM-3300-B', qty: 2, location: 'SRV-D2', site: 'Service depot East', status: 'RESERVED_SERVICE', approvedFor: ['C-3'], minServiceStock: 2 },
  { lot: 'L-7690', part: 'TIM-3300-A', qty: 2, location: 'WH-S3', site: 'Plant South', status: 'FREE', approvedFor: ['C-2'] },
  { lot: 'L-7752', part: 'TIM-3300-A', qty: 8, location: 'LS-N30', site: 'Plant North', status: 'KITTED', kittedFor: ['TS-50', 'TS-51'], approvedFor: ['C-2'] }
];
/** Logistics lanes for inter-site transfers. */
export const LANES = [
  { from: 'WH-N1', to: 'LS-N30', days: 0, costEur: 180, mode: 'internal tug' },
  { from: 'WH-S3', to: 'LS-N30', days: 1, costEur: 1_850, mode: 'dedicated truck' },
  { from: 'SRV-D2', to: 'LS-N30', days: 1, costEur: 1_400, mode: 'courier' },
  { from: 'SUP-114', to: 'LS-N30', days: 0, costEur: 0, mode: 'supplier delivery to line side' }
];
/** Supplier alternatives offered in the notice / supplier portal. */
export const SUPPLIER_OPTIONS = [
  { id: 'OPT-SPLIT', supplier: 'SUP-114', desc: 'Partial air shipment of 4 modules from the re-tested stack', qty: 4, day: 5, extraCostEur: 11_800 },
  { id: 'OPT-2ND', supplier: 'SUP-207', desc: 'Second source — not qualified for TIM-3300', qty: 0, day: null, extraCostEur: null, qualified: false }
];
/** Configuration rules (approved component variants per configuration). */
export const CONFIG_RULES = [
  { config: 'C-2', part: 'TIM-3300-A', status: 'APPROVED', baseline: 'CB-C2-07' },
  { config: 'C-3', part: 'TIM-3300-B', status: 'APPROVED', baseline: 'CB-C3-11' },
  { config: 'C-3', part: 'TIM-3300-A', status: 'NOT_APPROVED', baseline: 'CB-C3-11', note: 'Same housing and interfaces; firmware and control parameters differ. Use only under an engineering deviation.' },
  { config: 'C-2', part: 'TIM-3300-B', status: 'NOT_APPROVED', baseline: 'CB-C2-07' }
];
/** Engineering deviation procedure for a variant substitution (from the configuration system). */
export const DEVIATION_PROCEDURE = { id: 'EDP-TIM-03', applies: { part: 'TIM-3300-A', config: 'C-3' }, steps: ['Load firmware package FW-B 4.2 at S30', 'Converter self-test and parameter check at S50 static test'], s50ExtraHours: 3, requiresEngineeringSignOff: true };

/** Commercial and cost parameters (cost/risk system). Synthetic, stated, adjustable. */
export const COST = {
  ldPerTrainsetDayEur: 21_000,          // contractual late-delivery damages per trainset per day (CT-2207)
  milestoneValueEur: 5_200_000,         // acceptance milestone payment per trainset (CT-2207)
  financingRatePct: 7.5,                // annual cost of capital
  deferralDays: 31,                     // payment deferred to the next monthly acceptance board when a delivery is late
  reworkHoursOutOfSequence: 260,        // hours to re-open harness and re-test a trainset pulled off the line mid-integration
  labourRateEur: 95,                    // loaded hourly rate
  s30CrewPerShift: 12, shiftsPerDay: 3, shiftHours: 8, bayOverheadPerDayEur: 1_500,
  overtimeShiftEur: 5_600,              // one extra (weekend) shift at S40/S50, crew of 12 incl. premium
  handlingPerLotEur: 1_100,             // kitting, inspection and paperwork per transferred lot
  resequenceInspectionEur: 3_900,       // additional quality inspection when S30 work is resequenced
  resequenceReworkHours: 64,            // re-opening panels to fit inverters after harness-first integration
  s50SlotHours: 16, s50PlannedHours: 12 // S50 static-test slot length vs planned test content (for the deviation check)
};

// ---------------------------------------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------------------------------------
const FAMILIES = ['TIM', 'HVB', 'PAN', 'CBL', 'SEAT', 'HVAC', 'DOOR', 'BRK', 'BOG', 'LGT', 'PIS', 'CAB', 'GLZ', 'CPL'];
const FAMILY_NAME = { TIM: 'Traction inverter module', HVB: 'High-voltage box', PAN: 'Pantograph', CBL: 'Cable harness', SEAT: 'Seat frame', HVAC: 'HVAC unit', DOOR: 'Door system', BRK: 'Brake control unit', BOG: 'Bogie frame', LGT: 'Lighting set', PIS: 'Passenger information', CAB: 'Driver desk', GLZ: 'Side window', CPL: 'Automatic coupler' };
const STATION_OF = { TIM: 'S30', HVB: 'S30', PAN: 'S30', CBL: 'S30', SEAT: 'S40', HVAC: 'S40', DOOR: 'S40', BRK: 'S10', BOG: 'S10', LGT: 'S40', PIS: 'S40', CAB: 'S40', GLZ: 'S20', CPL: 'S10' };
const SITES = ['WH-N1', 'WH-N2', 'WH-S3', 'LS-N10', 'LS-N20', 'LS-N30', 'LS-N40', 'SRV-D2'];

export function generateRailDataset(seed = 20261005) {
  const R = prng(seed);
  const D = { erp: [], mes: [], planning: [], inventory: [], supplier: [], logistics: [], quality: [], configuration: [], cost: [] };

  // ERP — part master (1,140) and purchase-order lines (2,280)
  const parts = [];
  for (const f of FAMILIES) for (let i = 0; i < (f === 'TIM' ? 0 : 81); i++) parts.push({ pn: `${f}-${String(1000 + i * 7).padStart(4, '0')}-${'ABCD'[i % 4]}`, family: f });
  parts.push({ pn: 'TIM-3300-A', family: 'TIM' }, { pn: 'TIM-3300-B', family: 'TIM' }, { pn: 'TIM-2200-A', family: 'TIM' }, { pn: 'TIM-2200-B', family: 'TIM' });
  for (const p of parts) D.erp.push({ record_type: 'MATERIAL_MASTER', material: p.pn, description: `${FAMILY_NAME[p.family]} ${p.pn}`, base_uom: 'EA', plant: 'PN01', mrp_controller: `M${R.int(10, 39)}`, procurement: 'F', std_price_cents: Math.round(R.range(80, p.family === 'TIM' ? 9_000 : 2_400) * 100), consumption_station: STATION_OF[p.family], changed_on: erpDate(-R.int(30, 900)) });
  for (let i = 0; i < 2_280; i++) {
    const p = R.pick(parts), due = R.int(-40, 60);
    D.erp.push({ record_type: 'PO_LINE', po: `PO-45${String(R.int(10000, 99999))}`, line: 10 * R.int(1, 6), material: p.pn, supplier: `SUP-${R.int(100, 260)}`, qty: R.int(2, 120), due_date: erpDate(due), status: due < -2 ? 'RECEIVED' : 'OPEN', pegging: R.chance(0.3) ? `TS-${R.int(40, 60)}` : '' });
  }
  D.erp.push({ record_type: 'PO_LINE', po: DISRUPTION.po, line: DISRUPTION.line, material: DISRUPTION.part, supplier: DISRUPTION.supplier, qty: DISRUPTION.qty, due_date: erpDate(DISRUPTION.originalDay), status: 'OPEN', pegging: DISRUPTION.peggedTo.join(',') });
  D.erp.push({ record_type: 'PO_LINE', po: 'PO-4500874', line: 20, material: 'TIM-3300-A', supplier: 'SUP-114', qty: 8, due_date: erpDate(-9), status: 'RECEIVED', pegging: 'TS-50,TS-51' });

  // MES — operations per trainset × station (≈25 per station) and execution events (2,520)
  for (const ts of TRAINSETS) for (const st of STATIONS) {
    const start = ts.s30 + (STATIONS.indexOf(st) - 2) * 2;
    for (let k = 0; k < 25; k++) {
      const needsTim = st.id === 'S30' && k < CONFIGS[ts.config].inverters;
      D.mes.push({ rec: 'OPERATION', order: `WO-${ts.id.slice(3)}${st.id.slice(1)}${String(k).padStart(2, '0')}`, unit: ts.id, ws: st.id, seq: (k + 1) * 10, text: needsTim ? `Install traction inverter module pos. ${k + 1}` : `${st.name} operation ${k + 1}`, material: needsTim ? CONFIGS[ts.config].inverterVariant : (k % 3 === 0 ? R.pick(parts).pn : ''), planned_start: epoch(start + Math.floor(k / 13), 6 + (k % 13)), std_hours: Math.round(R.range(1.5, 9) * 10) / 10, state: start + 2 <= 0 ? 'DONE' : start <= 0 ? 'IN_WORK' : 'PLANNED' });
    }
  }
  for (let i = 0; i < 2_520; i++) { const ts = R.pick(TRAINSETS); D.mes.push({ rec: 'EVENT', unit: ts.id, ws: R.pick(STATIONS).id, ev: R.pick(['START', 'COMPLETE', 'PAUSE', 'RESUME', 'QUALITY_GATE']), t: epoch(-R.int(0, 30), R.int(0, 23)), operator: `OP${R.int(100, 480)}` }); }

  // Planning — schedule entries, station capacity by shift (7 stations × 40 days × 3 shifts), milestones
  for (const ts of TRAINSETS) {
    STATIONS.forEach((st, i) => D.planning.push({ kind: 'SCHEDULE', trainset: ts.id, configuration: ts.config, station: st.id, start: dayIso(ts.s30 + (i - 2) * 2), end: dayIso(ts.s30 + (i - 2) * 2 + st.days - 1) }));
    const done = ts.s30 + 4 * 2 + 1;  // S70 completion
    D.planning.push({ kind: 'MILESTONE', trainset: ts.id, milestone: 'DELIVERY', planned: dayIso(done), contractual: dayIso(done + ts.slack), contract: ts.contract });
    D.planning.push({ kind: 'MILESTONE', trainset: ts.id, milestone: 'ACCEPTANCE_BOARD', planned: dayIso(done + ts.slack + 2), contract: ts.contract });
  }
  for (const st of STATIONS) for (let d = -10; d < 30; d++) for (let s = 1; s <= 3; s++) {
    const weekend = ((d % 7) + 7) % 7 >= 5;
    D.planning.push({ kind: 'CAPACITY', station: st.id, date: dayIso(d), shift: s, crew_available: weekend ? (s === 1 ? 12 : 0) : 12, bays: st.bays, weekend_overtime_possible: weekend && s === 1 });
  }

  // Inventory — stock records across sites (3,060) + the inverter lots
  for (let i = 0; i < 3_060; i++) { const p = R.pick(parts.filter(x => x.family !== 'TIM')); D.inventory.push({ type: 'STOCK', item: p.pn, loc: R.pick(SITES), lot: `L-${R.int(1000, 6999)}`, on_hand: R.int(0, 300), status: R.chance(0.04) ? 'QUALITY_HOLD' : 'FREE', last_count: dayIso(-R.int(1, 120)) }); }
  for (const l of INVERTER_LOTS) D.inventory.push({ type: 'STOCK', item: l.part, loc: l.location, lot: l.lot, on_hand: l.qty, status: l.status, last_count: dayIso(-2), ...(l.kittedFor ? { kitted_for: l.kittedFor.join(',') } : {}), ...(l.minServiceStock ? { min_service_stock: l.minServiceStock } : {}) });
  D.inventory.push({ type: 'STOCK', item: 'TIM-3300-B', loc: 'LS-N30', lot: 'L-7720', on_hand: 6, status: 'KITTED', kitted_for: 'TS-47', last_count: dayIso(-1) });

  // Supplier management — commitments history (1,980), notices, options
  for (let i = 0; i < 1_980; i++) D.supplier.push({ entry: 'COMMITMENT', supplier: `SUP-${R.int(100, 260)}`, po_ref: `PO-45${R.int(10000, 99999)}`, promised: dayIso(R.int(-60, 60)), confirmed: R.chance(0.86), otd_score: Math.round(R.range(0.72, 0.99) * 100) / 100 });
  D.supplier.push({ entry: 'NOTICE', notice: DISRUPTION.id, supplier: DISRUPTION.supplier, po_ref: DISRUPTION.po, item: DISRUPTION.part, qty: DISRUPTION.qty, old_date: dayIso(DISRUPTION.originalDay), new_date: dayIso(DISRUPTION.newDay), reason: DISRUPTION.reason, received: dayIso(0) });
  for (const o of SUPPLIER_OPTIONS) D.supplier.push({ entry: 'OPTION', option: o.id, supplier: o.supplier, item: 'TIM-3300-B', text: o.desc, qty: o.qty, date: o.day == null ? null : dayIso(o.day), extra_cost_eur: o.extraCostEur, qualified: o.qualified ?? true });

  // Logistics — shipments (1,380) and lanes
  for (let i = 0; i < 1_380; i++) D.logistics.push({ doc: 'SHIPMENT', ref: `SH-${R.int(100000, 999999)}`, from: R.pick(SITES), to: R.pick(SITES), eta: dayIso(R.int(-20, 25)), pieces: R.int(1, 40), carrier: R.pick(['internal', 'road-1', 'road-2', 'courier']) });
  for (const l of LANES) D.logistics.push({ doc: 'LANE', from: l.from, to: l.to, lead_time_days: l.days, cost_eur: l.costEur, mode: l.mode });

  // Quality — inspections and non-conformances (1,540)
  for (let i = 0; i < 1_540; i++) D.quality.push({ qrec: R.chance(0.08) ? 'NCR' : 'INSPECTION', id: `Q-${R.int(10000, 99999)}`, object: R.chance(0.5) ? R.pick(TRAINSETS).id : `L-${R.int(1000, 6999)}`, result: R.chance(0.93) ? 'OK' : 'NOK', date: dayIso(-R.int(0, 90)) });
  D.quality.push({ qrec: 'NCR', id: 'NCR-2291', object: 'L-7745', result: 'NOK', date: dayIso(-3), text: 'Connector damage on 2 modules — awaiting supplier disposition' });

  // Configuration management — approved component variants per configuration (1,120) + the rules + deviation procedure
  for (let i = 0; i < 1_116; i++) { const p = R.pick(parts.filter(x => x.family !== 'TIM')); D.configuration.push({ obj: 'EFFECTIVITY', configuration: R.pick(['C-2', 'C-3']), item: p.pn, status: R.chance(0.9) ? 'APPROVED' : 'SUPERSEDED', baseline: R.pick(['CB-C2-07', 'CB-C3-11', 'CB-C2-06', 'CB-C3-10']) }); }
  for (const r of CONFIG_RULES) D.configuration.push({ obj: 'EFFECTIVITY', configuration: r.config, item: r.part, status: r.status, baseline: r.baseline, ...(r.note ? { note: r.note } : {}) });
  D.configuration.push({ obj: 'PROCEDURE', id: DEVIATION_PROCEDURE.id, item: DEVIATION_PROCEDURE.applies.part, configuration: DEVIATION_PROCEDURE.applies.config, steps: DEVIATION_PROCEDURE.steps, s50_extra_hours: DEVIATION_PROCEDURE.s50ExtraHours, sign_off: 'ENGINEERING' });

  // Cost / risk — contract terms, rates, risk register (400)
  for (let i = 0; i < 392; i++) D.cost.push({ entry: 'RISK', id: `RK-${R.int(1000, 9999)}`, topic: R.pick(['supplier', 'quality', 'labour', 'logistics', 'configuration']), score: R.int(1, 25), owner: R.pick(['Planning', 'Supply', 'Quality', 'Engineering']) });
  D.cost.push({ entry: 'CONTRACT', id: 'CT-2207', ld_cents_per_trainset_day: COST.ldPerTrainsetDayEur * 100, milestone_payment_cents: COST.milestoneValueEur * 100, acceptance: 'monthly board' });
  D.cost.push({ entry: 'CONTRACT', id: 'CT-2311', ld_cents_per_trainset_day: 16_000 * 100, milestone_payment_cents: 3_900_000 * 100, acceptance: 'monthly board' });
  D.cost.push({ entry: 'RATE', id: 'LABOUR', eur_per_hour: COST.labourRateEur }, { entry: 'RATE', id: 'OVERTIME_SHIFT', eur: COST.overtimeShiftEur }, { entry: 'RATE', id: 'HANDLING_PER_LOT', eur: COST.handlingPerLotEur }, { entry: 'RATE', id: 'RESEQUENCE', inspection_eur: COST.resequenceInspectionEur, rework_hours: COST.resequenceReworkHours }, { entry: 'RATE', id: 'OUT_OF_SEQUENCE', rework_hours: COST.reworkHoursOutOfSequence }, { entry: 'RATE', id: 'S50_SLOT', slot_hours: COST.s50SlotHours, planned_hours: COST.s50PlannedHours });
  D.cost.push({ entry: 'RATE', id: 'S30_BAY', crew_per_shift: COST.s30CrewPerShift, shifts_per_day: COST.shiftsPerDay, shift_hours: COST.shiftHours, overhead_eur_per_day: COST.bayOverheadPerDayEur }, { entry: 'RATE', id: 'FINANCING', annual_pct: COST.financingRatePct, deferral_days: COST.deferralDays });
  return D;
}

export const SOURCES = [
  { id: 'erp', name: 'ERP', what: 'Materials, purchase orders, pegging' },
  { id: 'mes', name: 'MES', what: 'Work orders, operations, execution events' },
  { id: 'planning', name: 'Planning', what: 'Schedule, station capacity, milestones' },
  { id: 'inventory', name: 'Inventory', what: 'Stock by lot and location' },
  { id: 'supplier', name: 'Supplier mgmt', what: 'Commitments, notices, options' },
  { id: 'logistics', name: 'Logistics', what: 'Shipments and transfer lanes' },
  { id: 'quality', name: 'Quality', what: 'Inspections and non-conformances' },
  { id: 'configuration', name: 'Configuration', what: 'Approved variants per configuration' },
  { id: 'cost', name: 'Cost / risk', what: 'Contracts, rates, risk register' }
];
export const countRecords = D => Object.values(D).reduce((n, l) => n + l.length, 0);
export { dayIso, DAY };
