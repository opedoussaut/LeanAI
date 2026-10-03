// GROUND — simulated enterprise systems exposed as MCP servers. Every tool answers from the evidence pack and the
// deterministic calculators; nothing is invented. In live mode the same definitions are served by a real MCP server
// (server/rail-mcp-server.mjs) so a Gemini/ADK agent calls exactly these tools.
import { availableStock, baseline, buildPlan, economics } from './recovery.js';

const T = (name, description, properties, required, run, latencyMs) => ({ name, description, inputSchema: { type: 'object', properties, required, additionalProperties: false }, run, latencyMs });
const S = { type: 'string' };
const need = (cond, msg) => { if (!cond) throw new Error(msg); };

export const RAIL_SERVERS = [
  { id: 'erp', name: 'ERP (simulated)', system: 'ERP', tools: [
    T('getDisruption', 'Supplier notice and the purchase-order line it changes, with pegging.', {}, [], (a, { F }) => ({ data: F.disruption, records: 2, summary: `${F.disruption.part}: ${F.disruption.qty} units, ${F.disruption.delayDays} days late (now day +${F.disruption.newDay}); pegged to ${F.pegged.map(p => p.id).join(', ')}.` }), 140)
  ] },
  { id: 'mes', name: 'MES (simulated)', system: 'MES', tools: [
    T('getTrainsetStatus', 'Configuration, S30 slot, kit status and operations that need the delayed part for one trainset.', { trainset: S }, ['trainset'], (a, { F }) => { const p = F.pegged.find(x => x.id === a.trainset); need(p, `Unknown or unaffected trainset ${a.trainset}`); return { data: { ...p, unitsNeeded: F.needed[p.id] ?? 0 }, records: 1 + (F.needed[p.id] ?? 0), summary: `${p.id} (${p.config}): S30 day +${p.s30Day}, ${p.kitted ? 'kit at line side' : `${F.needed[p.id]} modules needed`}, slack ${p.slack} d.` }; }, 120)
  ] },
  { id: 'inventory', name: 'Inventory (simulated)', system: 'Inventory', tools: [
    T('findStock', 'All lots of the part family (every variant) with status, location and transfer time to line side.', { family: S }, ['family'], (a, { F }) => { need(F.disruption.part.startsWith(a.family), `Family ${a.family} is out of scope`); const free = new Set(availableStock(F).map(l => l.lot)); const lots = F.lots.map(l => ({ ...l, usable: free.has(l.lot), readyDay: F.lanes.find(x => x.from === l.location)?.days ?? null })); return { data: { lots }, records: lots.length, summary: `${lots.length} lots; usable now: ${lots.filter(l => l.usable).map(l => `${l.qty} × ${l.part} (${l.lot})`).join(', ')}.` }; }, 180),
    T('checkLot', 'Status of one lot (holds, reservations, kits).', { lot: S }, ['lot'], (a, { F }) => { const l = F.lots.find(x => x.lot === a.lot); need(l, `Lot ${a.lot} not found`); const hold = F.holds.find(h => h.lot === l.lot); return { data: { ...l, hold: hold?.ncr ?? null }, records: 1, summary: `${l.lot}: ${l.qty} × ${l.part}, ${l.status}${hold ? `, hold ${hold.ncr}` : ''}.` }; }, 90)
  ] },
  { id: 'planning', name: 'Planning (simulated)', system: 'Planning', tools: [
    T('getS30Sequence', 'Electrical-integration (S30) slots, bays and weekend overtime capacity in the window.', {}, [], (a, { F }) => ({ data: { slots: F.s30Slots, bays: F.s30Bays, overtime: F.overtime }, records: F.s30Slots.length + 2, summary: `${F.s30Slots.length} S30 slots, ${F.s30Bays} bays; weekend overtime days S40 ${F.overtime.S40?.join(', ')}.` }), 160),
    T('proposeSequence', 'Deterministic resequencing and slack check for the affected trainsets (no stock substitutions decided here).', {}, [], (a, { F }) => { const plan = buildPlan(F); const acts = plan.actions.map(({ trainset, kind, delay, slip, protected: ok, slackUsed, recovered, overtimeDay, s30 }) => ({ trainset, kind, delay, slip, protected: ok, slackUsed, recovered, overtimeDay, s30 })); return { data: { actions: acts, bayUse: plan.bayUse }, records: acts.length, summary: acts.map(x => `${x.trainset} ${x.kind}${x.delay ? ` (delay ${x.delay} d, slip ${x.slip} d)` : ''}`).join('; ') }; }, 220)
  ] },
  { id: 'configuration', name: 'Configuration management (simulated)', system: 'Configuration', tools: [
    T('checkConfiguration', 'Is a component variant approved for a product configuration?', { part: S, configuration: S }, ['part', 'configuration'], (a, { F }) => { const r = F.rules.find(x => x.part === a.part && x.config === a.configuration); return { data: { part: a.part, configuration: a.configuration, status: r?.status ?? 'NOT_LISTED', baseline: r?.baseline ?? null, note: r?.note ?? null }, records: 1, summary: `${a.part} for ${a.configuration}: ${r?.status ?? 'NOT_LISTED'}${r?.note ? ' — ' + r.note : ''}.` }; }, 110),
    T('getDeviationProcedure', 'Engineering procedure that applies when a non-approved variant is substituted.', { part: S, configuration: S }, ['part', 'configuration'], (a, { F }) => { const p = F.procedure; const ok = p && p.part === a.part && p.configuration === a.configuration; return { data: ok ? p : null, records: ok ? 1 : 0, summary: ok ? `${p.id}: ${p.steps.join('; ')} — sign-off ${p.signOff}.` : 'No procedure.' }; }, 110)
  ] },
  { id: 'cost', name: 'Cost / risk (simulated)', system: 'Cost/Risk', tools: [
    T('getExposure', 'Business exposure if no recovery action is taken, line by line with formulas.', {}, [], (a, { F }) => { const b = baseline(F); return { data: b, records: b.lines.length, summary: `Exposure if no action: €${b.total.toLocaleString('en-US')}.` }; }, 150),
    T('costPlan', 'Recovery cost, residual exposure and value protected for the candidate plan.', { approvedVariantsOnly: { type: 'boolean' } }, [], (a, { F }) => { const e = economics(F, buildPlan(F, { approvedVariantsOnly: Boolean(a.approvedVariantsOnly) })); return { data: e, records: e.costLines.length + e.residualLines.length, summary: `Recovery €${e.recoveryCost.toLocaleString('en-US')}, residual €${e.residualExposure.toLocaleString('en-US')}, value protected €${e.valueProtected.toLocaleString('en-US')}.` }; }, 150)
  ] }
];
export const findRailTool = name => { for (const s of RAIL_SERVERS) { const t = s.tools.find(x => x.name === name); if (t) return { server: s, tool: t }; } return null; };
