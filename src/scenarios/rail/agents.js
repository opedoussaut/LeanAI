// REASON — the four specialists. Each has a narrow mission, the MCP tools it may call, a structured output contract
// and short UI status lines (no chain of thought is shown or stored). `simulate` is the deterministic behaviour used
// by the SIMULATED provider: it calls the same tools a live model would and builds the output only from their results.
export const ORCHESTRATOR = { id: 'orchestrator', name: 'LeanAI orchestrator', kind: 'deterministic code', note: 'Sequences the specialists over A2A, assembles the candidate plan and hands it to deterministic validation. It is code, not a model.' };

const allocationsFromStock = (lots, demand) => {
  const out = [], pool = lots.filter(l => l.usable).map(l => ({ ...l, left: l.qty })).sort((a, b) => a.readyDay - b.readyDay);
  for (const d of demand) {
    let got = 0; const take = [];
    for (const l of pool) { if (got >= d.units || !l.left || l.readyDay > d.byDay) continue; const q = Math.min(l.left, d.units - got); take.push({ trainset: d.trainset, lot: l.lot, part: l.part, location: l.location, qty: q, readyDay: l.readyDay }); l.left -= q; got += q; }
    if (got === d.units) out.push(...take); else for (const t of take) pool.find(l => l.lot === t.lot).left += t.qty;   // partial cover → wait for the batch instead
  }
  return out;
};

export const SPECIALISTS = [
  {
    id: 'supply', name: 'Supply', domain: 'SUPPLY', model: 'flash', icon: 'rack',
    mission: 'Find every unit of the delayed component that can reach the line in time: stock by lot and location, transfer lanes, supplier options. Never use held, reserved or kitted stock.',
    tools: ['getDisruption', 'getTrainsetStatus', 'findStock', 'checkLot'],
    status: ['Checking available inventory', 'Checking transfer lanes and supplier options', 'Proposing stock allocation'],
    output: { type: 'object', required: ['allocations', 'uncovered', 'summary'], properties: { allocations: { type: 'array' }, uncovered: { type: 'array' }, supplierOptions: { type: 'array' }, summary: { type: 'string' } } },
    async simulate(call) {
      const dis = await call('getDisruption', {});
      const demand = [];
      for (const ts of dis.data.pegging ?? []) { const s = await call('getTrainsetStatus', { trainset: ts }); if (!s.data.kitted) demand.push({ trainset: ts, units: s.data.unitsNeeded, byDay: s.data.s30Day }); }
      const stock = await call('findStock', { family: dis.data.part.replace(/-[A-Z]$/, '') });
      const allocations = allocationsFromStock(stock.data.lots, demand);
      const covered = new Set(allocations.map(a => a.trainset));
      return { allocations, uncovered: demand.filter(d => !covered.has(d.trainset)).map(d => d.trainset), supplierOptions: [], summary: `Stock covers ${[...covered].join(', ') || 'none'} before their slot (${allocations.map(a => `${a.qty} × ${a.part} ${a.lot}`).join(', ')}); ${demand.filter(d => !covered.has(d.trainset)).map(d => d.trainset).join(', ') || 'none'} must wait for the batch.` };
    }
  },
  {
    id: 'planning', name: 'Production planning', domain: 'PLANNING', model: 'flash', icon: 'clock',
    mission: 'Protect delivery commitments: S30 sequence, station capacity, schedule slack and weekend recovery for the trainsets the supply cannot cover in time.',
    tools: ['getS30Sequence', 'proposeSequence'],
    status: ['Reading the S30 sequence and capacity', 'Evaluating sequence alternatives', 'Checking slack against delivery commitments'],
    output: { type: 'object', required: ['actions', 'summary'], properties: { actions: { type: 'array' }, bayUse: { type: 'array' }, summary: { type: 'string' } } },
    async simulate(call) {
      await call('getS30Sequence', {});
      const seq = await call('proposeSequence', {});
      return { actions: seq.data.actions, bayUse: seq.data.bayUse, summary: seq.data.actions.map(a => `${a.trainset}: ${a.kind.toLowerCase().replaceAll('_', ' ')}${a.delay ? ` (${a.delay} d absorbed)` : ''}`).join('; ') };
    }
  },
  {
    id: 'cost', name: 'Cost + risk', domain: 'COST_RISK', model: 'flash', icon: 'coins',
    mission: 'Quantify the business exposure if nothing is done and the cost, residual exposure and value protected of the candidate plan, with formulas.',
    tools: ['getExposure', 'costPlan'],
    status: ['Calculating disruption exposure', 'Calculating recovery economics'],
    output: { type: 'object', required: ['exposure', 'recoveryCost', 'residualExposure', 'valueProtected', 'summary'], properties: { exposure: { type: 'number' }, recoveryCost: { type: 'number' }, residualExposure: { type: 'number' }, valueProtected: { type: 'number' }, costLines: { type: 'array' }, summary: { type: 'string' } } },
    async simulate(call, input = {}) {
      const ex = await call('getExposure', {});
      const c = await call('costPlan', { approvedVariantsOnly: Boolean(input.approvedVariantsOnly) });
      return { exposure: ex.data.total, recoveryCost: c.data.recoveryCost, residualExposure: c.data.residualExposure, valueProtected: c.data.valueProtected, costLines: c.data.costLines, summary: `Exposure €${ex.data.total.toLocaleString('en-US')}; recovery €${c.data.recoveryCost.toLocaleString('en-US')}; value protected €${c.data.valueProtected.toLocaleString('en-US')}.` };
    }
  },
  {
    id: 'configuration', name: 'Manufacturing / configuration', domain: 'CONFIGURATION', model: 'flash', icon: 'shield',
    mission: 'Check every proposed component against the approved configuration of the product it goes into. Report conflicts and the applicable engineering procedure. Never authorise a deviation.',
    tools: ['checkConfiguration', 'getDeviationProcedure', 'getTrainsetStatus'],
    status: ['Validating configuration', 'Checking substitution rules'],
    output: { type: 'object', required: ['checks', 'conflict', 'summary'], properties: { checks: { type: 'array' }, conflict: { type: 'boolean' }, procedure: {}, summary: { type: 'string' } } },
    async simulate(call, input = {}) {
      const checks = [];
      for (const a of input.allocations ?? []) {
        const ts = await call('getTrainsetStatus', { trainset: a.trainset });
        const c = await call('checkConfiguration', { part: a.part, configuration: ts.data.config });
        checks.push({ trainset: a.trainset, lot: a.lot, part: a.part, configuration: ts.data.config, status: c.data.status, baseline: c.data.baseline, note: c.data.note });
      }
      const bad = checks.filter(c => c.status !== 'APPROVED');
      const procedure = bad[0] ? (await call('getDeviationProcedure', { part: bad[0].part, configuration: bad[0].configuration })).data : null;
      return { checks, conflict: bad.length > 0, procedure, summary: bad.length ? `CONFIGURATION CONFLICT: ${bad.map(b => `${b.part} (lot ${b.lot}) is ${b.status.replace('_', ' ').toLowerCase()} for ${b.trainset} (${b.configuration})`).join('; ')}. Engineering review required${procedure ? ` — procedure ${procedure.id}` : ''}.` : 'All proposed components are approved for their configuration.' };
    }
  }
];
export const specialist = id => SPECIALISTS.find(s => s.id === id);

/** Minimal JSON-schema check for specialist outputs (required keys and primitive types). */
export function checkOutput(agent, out) {
  const errs = [];
  if (!out || typeof out !== 'object') return ['output is not an object'];
  for (const k of agent.output.required) if (!(k in out)) errs.push(`missing ${k}`);
  for (const [k, s] of Object.entries(agent.output.properties)) if (k in out && s.type && !(s.type === 'array' ? Array.isArray(out[k]) : typeof out[k] === s.type)) errs.push(`${k} is not ${s.type}`);
  return errs;
}
