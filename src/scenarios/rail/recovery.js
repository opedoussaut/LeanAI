// Deterministic recovery core: facts from the evidence, the no-action baseline, candidate plans, economics and
// validation. Agents (simulated or live) call this through MCP tools; nothing a model writes can change these numbers.
const S30_DAYS = 2;
const byKey = (list, k) => Object.fromEntries(list.map(e => [e.keys[k], e]));

/** Structured view of the evidence pack. Everything downstream reads from here — never from the raw dataset. */
export function factsFrom(ev) {
  const T = type => ev.filter(e => e.type === type);
  const dis = T('DISRUPTION')[0], po = T('PO_LINE')[0];
  const ms = byKey(T('MILESTONE'), 'trainset'), acc = byKey(T('ACCEPTANCE'), 'trainset'), slots = byKey(T('S30_SLOT'), 'trainset');
  const contracts = Object.fromEntries(T('CONTRACT').map(c => [c.keys.contract, c.v]));
  const rates = Object.fromEntries(T('RATE').map(r => [r.keys.rate, r.v]));
  const lanes = T('LANE').map(l => ({ from: l.keys.from, to: l.keys.to, ...l.v }));
  const pegged = T('TRAINSET').map(t => {
    const m = ms[t.keys.trainset];
    return { id: t.keys.trainset, config: t.v.configuration, s30Day: t.v.s30Day, kitted: t.v.kitted, kitLot: t.v.kitLot, plannedCompletion: t.v.s30Day + S30_DAYS - 1, slack: m.v.slackDays, contract: m.keys.contract, acceptanceDay: acc[t.keys.trainset]?.v.boardDay ?? null, ldPerDay: contracts[m.keys.contract].ldPerTrainsetDayEur, milestoneEur: contracts[m.keys.contract].milestonePaymentEur };
  });
  return {
    disruption: { ...dis.v, ...dis.keys, po: po.keys.po },
    pegged, needed: Object.fromEntries(pegged.map(p => [p.id, T('OPERATION').filter(o => o.keys.trainset === p.id).length])),
    lots: T('STOCK_LOT').map(l => ({ lot: l.keys.lot, location: l.keys.location, ...l.v })),
    holds: T('QUALITY_HOLD').map(q => ({ ncr: q.keys.ncr, lot: q.keys.lot })),
    lanes, options: T('SUPPLIER_OPTION').map(o => ({ id: o.keys.option, ...o.v })),
    rules: T('CONFIG_RULE').map(r => ({ config: r.keys.configuration, part: r.keys.part, ...r.v })),
    procedure: T('DEVIATION_PROCEDURE')[0] ? { id: T('DEVIATION_PROCEDURE')[0].keys.id, ...T('DEVIATION_PROCEDURE')[0].v } : null,
    s30Slots: Object.values(slots).map(s => ({ trainset: s.keys.trainset, ...s.v })),
    s30Bays: T('S30_CAPACITY')[0]?.v.bays ?? 1,
    overtime: Object.fromEntries(T('OVERTIME').map(o => [o.keys.station, o.v.weekendShifts])),
    rates, lineSideLocation: lanes.find(l => l.from === dis.keys.supplier)?.to ?? 'LS-N30'
  };
}

const bayDayEur = r => r.S30_BAY.crew_per_shift * r.S30_BAY.shifts_per_day * r.S30_BAY.shift_hours * r.LABOUR.eur_per_hour + r.S30_BAY.overhead_eur_per_day;
const deferralEur = (F, p) => p.milestoneEur * (F.rates.FINANCING.annual_pct / 100) * F.rates.FINANCING.deferral_days / 365;
const laneFor = (F, loc) => F.lanes.find(l => l.from === loc && l.to === F.lineSideLocation);
const eur = v => Math.round(v);

/** Delivery consequences of an S30 completion day for one trainset. */
function consequences(F, p, completionDay, recoveredDays = 0) {
  const delay = Math.max(0, completionDay - p.plannedCompletion);
  const slip = Math.max(0, delay - p.slack - recoveredDays);
  return { delay, slip, protected: slip === 0, ldEur: slip * p.ldPerDay, deferralEur: slip > 0 ? deferralEur(F, p) : 0 };
}

/** EXPOSURE IF NO ACTION: affected trainsets wait for the late batch, are pulled off the line, the S30 crew stands idle in their slots. */
export function baseline(F) {
  const r = F.rates, lines = [], perTrainset = [];
  for (const p of F.pegged) {
    if (p.kitted) { perTrainset.push({ trainset: p.id, action: 'none needed — kit already at line side', delay: 0, slip: 0 }); continue; }
    const completion = Math.max(p.s30Day, F.disruption.newDay) + S30_DAYS - 1;
    const c = consequences(F, p, completion);
    perTrainset.push({ trainset: p.id, completion, ...c });
    if (c.ldEur) lines.push({ id: `ld-${p.id}`, label: `Late-delivery damages ${p.id}`, eur: eur(c.ldEur), formula: `${c.slip} day(s) beyond slack × €${p.ldPerDay.toLocaleString('en-US')} (${p.contract})` });
    if (c.deferralEur) lines.push({ id: `def-${p.id}`, label: `Milestone payment deferred ${p.id}`, eur: eur(c.deferralEur), formula: `€${p.milestoneEur.toLocaleString('en-US')} × ${r.FINANCING.annual_pct} % × ${r.FINANCING.deferral_days}/365 (misses the acceptance board)` });
    if (c.delay > 0) lines.push({ id: `oos-${p.id}`, label: `Out-of-sequence rework ${p.id}`, eur: eur(r.OUT_OF_SEQUENCE.rework_hours * r.LABOUR.eur_per_hour), formula: `${r.OUT_OF_SEQUENCE.rework_hours} h × €${r.LABOUR.eur_per_hour}/h (pulled off the line mid-integration)` });
  }
  const idleDays = F.pegged.filter(p => !p.kitted).length * S30_DAYS;
  lines.push({ id: 'idle-s30', label: 'S30 crew idle in the empty slots', eur: eur(idleDays * bayDayEur(r)), formula: `${idleDays} days × (${r.S30_BAY.crew_per_shift} × ${r.S30_BAY.shifts_per_day} × ${r.S30_BAY.shift_hours} h × €${r.LABOUR.eur_per_hour} + €${r.S30_BAY.overhead_eur_per_day})` });
  return { lines, total: lines.reduce((a, l) => a + l.eur, 0), perTrainset, assumption: 'No recovery action: affected trainsets wait for the late batch; the rest of the line keeps its slots.' };
}

/** Free stock usable by family (operational view: same part family, any variant). Holds, service reserves and kits are excluded. */
export function availableStock(F, { approvedOnlyFor = null } = {}) {
  const fam = F.disruption.part.split('-').slice(0, 2).join('-');
  return F.lots.filter(l => l.part.startsWith(fam) && l.status === 'FREE' && !F.holds.some(h => h.lot === l.lot))
    .filter(l => !approvedOnlyFor || F.rules.some(r => r.config === approvedOnlyFor && r.part === l.part && r.status === 'APPROVED'))
    .map(l => ({ ...l, readyDay: laneFor(F, l.location)?.days ?? Infinity, laneCostEur: laneFor(F, l.location)?.costEur ?? null }))
    .sort((a, b) => a.readyDay - b.readyDay || a.laneCostEur - b.laneCostEur);
}

/** Candidate recovery plan, built by deterministic rules over the evidence (the specialists' tools apply exactly these). */
export function buildPlan(F, { approvedVariantsOnly = false } = {}) {
  const r = F.rates, actions = [], costs = [], allocations = [];
  let stock = availableStock(F, { approvedOnlyFor: approvedVariantsOnly ? 'C-3' : null }).map(l => ({ ...l, left: l.qty }));
  const options = F.options.filter(o => o.qualified && o.qty > 0).map(o => ({ ...o, left: o.qty }));
  const bayUse = [];   // [{trainset, from, to, bay}]
  const ordered = [...F.pegged].sort((a, b) => a.s30Day - b.s30Day);
  const overtimeDays = [...(F.overtime.S40 ?? [])].sort((a, b) => a - b);
  for (const p of ordered) {
    if (p.kitted) { actions.push({ trainset: p.id, kind: 'CONTINUE', text: 'Continue according to plan — inverter kit already at line side.', s30: [p.s30Day, p.plannedCompletion], delay: 0, slip: 0, protected: true }); continue; }
    const need = F.needed[p.id];
    // 1 · existing stock that can be at line side before the slot
    const take = [];
    let got = 0;
    for (const l of stock) { if (got >= need || l.left === 0 || l.readyDay > p.s30Day) continue; const q = Math.min(l.left, need - got); take.push({ lot: l.lot, part: l.part, location: l.location, qty: q, readyDay: l.readyDay, laneCostEur: l.laneCostEur }); l.left -= q; got += q; }
    // 2 · a qualified supplier option if it closes the gap entirely, before the batch
    let opt = null;
    if (got < need && got > 0) { const o = options.find(x => x.left >= need - got && x.day < F.disruption.newDay); if (o) { opt = { id: o.id, qty: need - got, day: o.day, extraCostEur: o.extraCostEur }; o.left -= need - got; got = need; } }
    if (got < need) { // cannot be covered before the batch: release partial picks and wait for the batch with harness-first resequencing
      for (const t of take) stock.find(l => l.lot === t.lot).left += t.qty;
      const partsDay = F.disruption.newDay;
      const completion = Math.max(p.plannedCompletion, partsDay);
      const delay = completion - p.plannedCompletion;
      const wkd = overtimeDays.find(d => d > completion);
      const recovered = delay > p.slack && wkd != null ? 1 : 0;
      const c = consequences(F, p, completion, recovered);
      bayUse.push({ trainset: p.id, from: p.s30Day, to: p.plannedCompletion, bay: 1 }, { trainset: p.id, from: p.plannedCompletion + 1, to: completion, bay: 2 });
      actions.push({ trainset: p.id, kind: 'RESEQUENCE_AND_SLACK', text: `Resequence electrical integration: harness and cabling in the planned slot, inverters fitted in bay 2 when the batch arrives (${partsDay > 0 ? `day +${partsDay}` : 'today'}). Absorb ${Math.min(delay, p.slack)} day(s) with schedule slack${recovered ? ` and ${recovered} with a weekend shift (day +${wkd})` : ''}.`, s30: [p.s30Day, completion], delay, slip: c.slip, protected: c.protected, slackUsed: Math.min(delay, p.slack), recovered, overtimeDay: wkd ?? null });
      costs.push({ id: `insp-${p.id}`, label: `Resequencing inspection ${p.id}`, eur: r.RESEQUENCE.inspection_eur, formula: 'quality inspection for a resequenced S30' });
      costs.push({ id: `rew-${p.id}`, label: `Harness-first rework ${p.id}`, eur: eur(r.RESEQUENCE.rework_hours * r.LABOUR.eur_per_hour), formula: `${r.RESEQUENCE.rework_hours} h × €${r.LABOUR.eur_per_hour}/h (re-open panels to fit inverters)` });
      costs.push({ id: `arr-${p.id}`, label: `Install-on-arrival shift ${p.id}`, eur: r.OVERTIME_SHIFT.eur, formula: '1 extra shift in bay 2 on the arrival day' });
      if (recovered) costs.push({ id: `ot-${p.id}`, label: `Weekend recovery ${p.id}`, eur: 2 * r.OVERTIME_SHIFT.eur, formula: `2 shifts (S40 + S50) × €${r.OVERTIME_SHIFT.eur.toLocaleString('en-US')}` });
      continue;
    }
    // covered: by stock alone, or stock + supplier option
    const partsDay = Math.max(...take.map(t => t.readyDay), opt ? opt.day : -Infinity);
    const harnessFirst = partsDay > p.s30Day;
    const completion = Math.max(p.plannedCompletion, partsDay);
    const delay = completion - p.plannedCompletion;
    const wkd = overtimeDays.find(d => d > completion);
    const recovered = delay > p.slack && wkd != null ? 1 : 0;
    const c = consequences(F, p, completion, recovered);
    allocations.push(...take.map(t => ({ ...t, trainset: p.id })));
    bayUse.push({ trainset: p.id, from: p.s30Day, to: completion, bay: 1 });
    actions.push({ trainset: p.id, kind: 'ALLOCATE_STOCK', text: `Allocate existing inventory: ${take.map(t => `${t.qty} × ${t.part} from ${t.location} (lot ${t.lot})`).join(' + ')}${opt ? ` + ${opt.qty} from supplier option ${opt.id} (day +${opt.day})` : ''}.${harnessFirst ? ' Resequence electrical integration: harness first, inverters on arrival.' : ' Keep the planned S30 slot.'}`, s30: [p.s30Day, completion], delay, slip: c.slip, protected: c.protected, allocations: take, option: opt, recovered, overtimeDay: recovered ? wkd : null });
    for (const t of take) costs.push({ id: `tr-${t.lot}`, label: `Transfer lot ${t.lot} → line side`, eur: t.laneCostEur + r.HANDLING_PER_LOT.eur, formula: `lane €${t.laneCostEur.toLocaleString('en-US')} + handling €${r.HANDLING_PER_LOT.eur.toLocaleString('en-US')}` });
    if (opt) costs.push({ id: `opt-${opt.id}`, label: `Supplier option ${opt.id}`, eur: opt.extraCostEur, formula: 'extra charge quoted by the supplier' });
    if (harnessFirst) { costs.push({ id: `insp-${p.id}`, label: `Resequencing inspection ${p.id}`, eur: r.RESEQUENCE.inspection_eur, formula: 'quality inspection for a resequenced S30' }, { id: `rew-${p.id}`, label: `Harness-first rework ${p.id}`, eur: eur(r.RESEQUENCE.rework_hours * r.LABOUR.eur_per_hour), formula: `${r.RESEQUENCE.rework_hours} h × €${r.LABOUR.eur_per_hour}/h` }); }
    if (recovered) costs.push({ id: `ot-${p.id}`, label: `Weekend recovery ${p.id}`, eur: 2 * r.OVERTIME_SHIFT.eur, formula: `2 shifts × €${r.OVERTIME_SHIFT.eur.toLocaleString('en-US')}` });
  }
  return { actions, allocations, costs, bayUse, approvedVariantsOnly };
}

/** Economics of a plan against the no-action baseline. valueProtected = exposure − recoveryCost − residual. */
export function economics(F, plan, base = baseline(F)) {
  const residual = [];
  for (const a of plan.actions) {
    if (a.slip > 0) {
      const p = F.pegged.find(x => x.id === a.trainset);
      residual.push({ id: `res-ld-${p.id}`, label: `Remaining late-delivery damages ${p.id}`, eur: eur(a.slip * p.ldPerDay), formula: `${a.slip} day(s) × €${p.ldPerDay.toLocaleString('en-US')}` });
      residual.push({ id: `res-def-${p.id}`, label: `Milestone payment deferred ${p.id}`, eur: eur(deferralEur(F, p)), formula: 'misses the acceptance board' });
    }
  }
  const exposure = base.total, recoveryCost = plan.costs.reduce((a, c) => a + c.eur, 0), residualExposure = residual.reduce((a, c) => a + c.eur, 0);
  return { exposure, recoveryCost, residualExposure, valueProtected: exposure - recoveryCost - residualExposure, exposureLines: base.lines, costLines: plan.costs, residualLines: residual, deliveryProtected: plan.actions.every(a => a.protected), disruptionDays: F.disruption.delayDays, affected: F.pegged.length };
}

/** VALIDATE — deterministic constraints. A model cannot override any of these results. */
export function validate(F, plan) {
  const checks = [];
  const ck = (id, label, ok, detail, kind = 'BLOCKING') => checks.push({ id, label, ok, detail, kind });
  for (const a of plan.allocations) {
    const lot = F.lots.find(l => l.lot === a.lot);
    ck(`exists-${a.lot}`, `Lot ${a.lot} exists with enough quantity`, Boolean(lot) && lot.qty >= a.qty, lot ? `${lot.qty} on hand, ${a.qty} allocated` : 'lot not found');
    ck(`free-${a.lot}`, `Lot ${a.lot} is free (no hold, not reserved, not kitted)`, lot?.status === 'FREE' && !F.holds.some(h => h.lot === a.lot), `status ${lot?.status ?? '—'}`);
    const p = F.pegged.find(x => x.id === a.trainset);
    ck(`date-${a.lot}`, `Lot ${a.lot} reaches line side before ${a.trainset}'s S30 slot`, a.readyDay <= p.s30Day, `ready day +${a.readyDay}, slot day +${p.s30Day}`);
    const rule = F.rules.find(r => r.config === p.config && r.part === a.part);
    const approved = rule?.status === 'APPROVED';
    ck(`config-${a.lot}-${a.trainset}`, `${a.part} is approved for ${a.trainset} (${p.config})`, approved, approved ? `effectivity ${rule.baseline}` : `${a.part} is ${rule?.status ?? 'not listed'} for ${p.config} (${rule?.baseline ?? ''})${rule?.note ? ' — ' + rule.note : ''}`, approved ? 'BLOCKING' : 'ENGINEERING');
  }
  for (const a of plan.actions) if (a.option) { const o = F.options.find(x => x.id === a.option.id); ck(`supplier-${a.option.id}`, `Supplier option ${a.option.id} is qualified and arrives before the batch`, Boolean(o?.qualified) && o.day < F.disruption.newDay, `day +${o?.day}`); }
  // S30 capacity: never more trainsets than bays on any day
  const days = plan.bayUse.flatMap(u => Array.from({ length: u.to - u.from + 1 }, (_, i) => u.from + i));
  const peak = Math.max(0, ...[...new Set(days)].map(d => new Set(plan.bayUse.filter(u => u.from <= d && d <= u.to).map(u => `${u.trainset}`)).size + F.s30Slots.filter(s => !F.pegged.some(p => p.id === s.trainset) && s.startDay <= d && d <= s.endDay).length));
  ck('capacity-s30', 'S30 capacity holds on every day of the window', peak <= F.s30Bays, `peak ${peak} trainset(s) for ${F.s30Bays} bays`);
  for (const a of plan.actions.filter(x => x.recovered)) ck(`overtime-${a.trainset}`, `Weekend shift available for ${a.trainset}`, (F.overtime.S40 ?? []).includes(a.overtimeDay), `day +${a.overtimeDay}`);
  for (const a of plan.actions) ck(`milestone-${a.trainset}`, `${a.trainset} delivery milestone achievable`, a.protected, a.protected ? `delay ${a.delay} d absorbed` : `${a.slip} day(s) late`, 'RESULT');
  const blocking = checks.filter(c => !c.ok && c.kind === 'BLOCKING'), engineering = checks.filter(c => !c.ok && c.kind === 'ENGINEERING');
  const verdict = blocking.length ? 'INVALID' : engineering.length ? 'ENGINEERING_REVIEW' : 'VALID';
  return { checks, verdict, blocking, engineering };
}

/** Engineering deviation check (what the engineer validates): does the procedure fit inside the S50 slot? */
export function deviationAssessment(F, conflicts) {
  const pr = F.procedure, s50 = F.rates.S50_SLOT;
  if (!pr) return { feasible: false, reason: 'No deviation procedure exists for this substitution.' };
  const spare = s50.slot_hours - s50.planned_hours;
  return { feasible: true, procedure: pr.id, steps: pr.steps, extraHours: pr.s50ExtraHours, spareHours: spare, fitsInSlot: pr.s50ExtraHours <= spare, extraCostEur: pr.s50ExtraHours <= spare ? 0 : (pr.s50ExtraHours - spare) * F.rates.LABOUR.eur_per_hour * F.rates.S30_BAY.crew_per_shift, conflicts: conflicts.map(c => c.id), signOff: pr.signOff };
}
