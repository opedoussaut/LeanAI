// INDUSTRIAL RECOVERY — NovaRail. One page, nine chapters revealed in order:
// disruption → reduce → decide → reason → validate → business outcome → engineering boundary → governance → telemetry.
// Every figure comes from the orchestrator run (src/scenarios/rail/*). Human actions are buttons; nothing is approved on its own.
import { icon } from './icons.js';
import { esc, int, eur } from './format.js';
import { runRecovery, resolveEngineering } from '../scenarios/rail/orchestrator.js';
import { decideInBrowser } from '../scenarios/rail/runtime.js';
import { SPECIALISTS } from '../scenarios/rail/agents.js';
import { RAIL_FEATURES } from '../scenarios/rail/features.js';
import { TRAINSETS, STATIONS, SOURCES, fmtDay, COMPANY } from '../scenarios/rail/dataset.js';
import { LABEL } from '../scenarios/rail/governance.js';
import { PRICES, USD_TO_EUR } from '../providers/prices.js';
import { buildPlan, economics } from '../scenarios/rail/recovery.js';

const CH = [
  ['disruption', 'Disruption'], ['reduce', 'Reduce'], ['decide', 'Decide'], ['reason', 'Reason'], ['validate', 'Validate'],
  ['outcome', 'Business outcome'], ['boundary', 'Engineering boundary'], ['governance', 'Governance'], ['telemetry', 'Telemetry']
];
const kEur = v => `€${Math.round(v / 1000).toLocaleString('en-US')}k`;
const eEur = v => `€${Math.round(v).toLocaleString('en-US')}`;
const pct = v => `${v.toFixed(1)} %`;
const day = d => (d === 0 ? 'today' : `day +${d}`);

export function mountRail(el, app) {
  const params = new URLSearchParams(location.search);
  const ui = { step: 0, run: null, story: null, playing: false, shown: new Set(), live: null, wantLive: params.get('provider') === 'live', engineering: null, approval: null };

  async function load() {
    el.innerHTML = `<div class="rr-loading">${icon('loop', 18)} Preparing the NovaRail scenario…</div>`;
    let decide = undefined;
    try { await import('../scenarios/rail/runtime.js'); decide = decideInBrowser; } catch { /* JS evaluator */ }
    ui.run = await runRecovery({ decide });
    ui.baseRun = ui.run;
    if (ui.wantLive) {
      try {
        const st = await (await fetch('http://127.0.0.1:18800/rail/status', { signal: AbortSignal.timeout(2500) })).json();
        ui.live = { status: st };
        const live = await (await fetch('http://127.0.0.1:18800/rail/run', { signal: AbortSignal.timeout(180000) })).json();
        if (live.error) throw new Error(live.error);
        // The specialists, their tool calls and token usage come from the live run; validation, economics and governance
        // are the same deterministic code, executed here on the same evidence.
        ui.run = { ...ui.run, specialists: live.specialists, toolCalls: live.toolCalls, modelCalls: live.modelCalls, messages: live.messages, events: live.events, telemetry: live.telemetry, provider: live.provider, agreement: live.agreement };
      } catch { ui.live = { error: 'The live endpoint (npm run start:live) did not complete a run on 127.0.0.1:18800 — showing the SIMULATED run.' }; }
    }
    render();
  }

  // ---------- the production line: the one visual that stays with the viewer ----------
  function line(stage) {
    const r = ui.run, plan = ui.view?.plan ?? r.plan, P = Object.fromEntries(plan.actions.map(a => [a.trainset, a]));
    const affected = new Set(r.facts.pegged.map(p => p.id));
    const conflict = new Set(stage >= 6 && !ui.engineering ? r.validation.engineering.map(c => c.id.split('-').slice(-2).join('-')) : []);
    const W = 1120, H = 150, qx = 150, cw = (W - qx) / STATIONS.length;
    const state = t => {
      if (conflict.has(t.id)) return 'frozen';
      if (!affected.has(t.id)) return 'ok';
      if (stage >= 5) return P[t.id]?.protected ? 'saved' : 'risk';
      return t.kitted ? 'ok' : 'risk';
    };
    const train = (t, x, y, w) => {
      const cars = t.config === 'C-3' ? 6 : 4, gap = 3, cwid = (w - (cars - 1) * gap) / cars;
      const body = Array.from({ length: cars }, (_, i) => `<rect x="${x + i * (cwid + gap)}" y="${y}" width="${cwid}" height="20" rx="${i === 0 || i === cars - 1 ? 7 : 3}"/>`).join('');
      return `<g class="rr-ts ${state(t)}">${body}<text x="${x + w / 2}" y="${y + 40}" text-anchor="middle">${t.id}</text><text x="${x + w / 2}" y="${y + 55}" text-anchor="middle" class="cfg">${t.config}${affected.has(t.id) ? ' · inverters' : ''}</text></g>`;
    };
    const stations = STATIONS.map((st, i) => `<rect x="${qx + i * cw + 3}" y="24" width="${cw - 6}" height="${H - 30}" rx="12" class="rr-st ${st.id === 'S30' ? 'gate' : ''}"/><text x="${qx + i * cw + cw / 2}" y="14" class="rr-stl">${st.id} ${esc(st.name)}</text>`).join('');
    const onLine = TRAINSETS.filter(t => t.s30 <= 4 && t.s30 >= -8 && t.s30 % 2 === 0).map(t => ({ t, i: 2 - t.s30 / 2 })).filter(x => x.i >= 0 && x.i < STATIONS.length);
    const placed = onLine.map(({ t, i }) => train(t, qx + i * cw + 14, 58, cw - 28)).join('');
    const queue = TRAINSETS.filter(t => t.s30 >= 6).slice(0, 3).map((t, k) => `<g class="rr-q ${state(t)}"><rect x="8" y="${30 + k * 38}" width="118" height="30" rx="8"/><text x="18" y="${50 + k * 38}">${t.id}</text><text x="116" y="${50 + k * 38}" text-anchor="end" class="cfg">${t.config}</text></g>`).join('');
    return `<svg class="rr-line" viewBox="0 0 ${W} ${H}" role="img" aria-label="NovaRail line today: trainsets at stations S10 to S70, the next ones waiting to enter">${stations}<text x="8" y="14" class="rr-side">Next to enter</text>${queue}<path d="M ${qx - 14} ${H / 2} l 10 0" class="rr-arrow"/>${placed}</svg>`;
  }

  function sec(id, n, title, sub, body) {
    const visible = CH.findIndex(c => c[0] === id) <= ui.step;
    return `<section class="rr-sec ${visible ? '' : 'locked'}" id="rr-${id}" ${visible ? '' : 'hidden'}><div class="rr-head"><span class="rr-n">${String(n).padStart(2, '0')}</span><div><h2 class="h2">${title}</h2>${sub ? `<p>${sub}</p>` : ''}</div></div>${visible ? body : ''}</section>`;
  }
  const next = id => { const i = CH.findIndex(c => c[0] === id); if (i >= CH.length - 1 || ui.step > i) return ''; return `<div class="rr-next"><button class="btn primary" data-next="${i + 1}">${esc(nextLabel[i + 1])} ${icon('arrow', 15)}</button></div>`; };
  const nextLabel = ['', 'Reduce the evidence', 'Decide whether AI is needed', 'Bring in the specialists', 'Validate the candidate plan', 'Show the business outcome', 'Check the configuration', 'Go to governance', 'Open the telemetry'];

  function render() {
    const r = ui.run, F = r.facts, t = r.telemetry, e = ui.view?.economics ?? r.economics, dis = F.disruption;
    const mode = ui.live?.status ? `<span class="rr-mode live"><i></i>LIVE · ${esc(ui.live.status.model)}</span>` : `<span class="rr-mode sim">SIMULATED · deterministic replay, no model called</span>`;
    el.innerHTML = `
    <div class="page-head rr-top">
      <div><span class="eyebrow"><i class="pip"></i>Industrial recovery · ${esc(COMPANY.name)}, a fictional rail manufacturer · synthetic data</span>
        <h1 class="display rr-q">Can NovaRail protect its delivery commitment <span>without unacceptable cost, risk or engineering debt?</span></h1></div>
        <div class="rr-meta">${mode}<span class="rr-flow">REDUCE → DECIDE → REASON → VALIDATE → ACT → ENGINEER</span></div></div>
    </div>
    ${ui.live?.error ? `<p class="rr-note">${icon('info', 14)} ${esc(ui.live.error)}</p>` : ''}
    <div class="rr-linebox card">${line(ui.step)}<div class="rr-legend"><span class="ok">on plan</span><span class="risk">at risk</span><span class="saved">protected by the plan</span><span class="frozen">frozen — engineering review</span></div></div>
    <nav class="rr-chapters" aria-label="Chapters">${CH.map(([id, l], i) => `<a href="#rr-${id}" class="${i <= ui.step ? '' : 'off'}" data-ch="${i}"><i>${String(i + 1).padStart(2, '0')}</i>${l}</a>`).join('')}<button class="rr-all" id="rr-all">${ui.step >= CH.length - 1 ? 'Restart' : 'Show all'}</button></nav>

    ${sec('disruption', 1, 'A supplier changes the equation.', `Notice ${esc(dis.notice)} arrived this morning from ${esc(dis.supplier)}. Nothing has been asked of any AI yet.`, `
      <div class="rr-grid2">
        <div class="card rr-notice"><small>Supplier notice · ${esc(dis.notice)}</small>
          <b>${dis.qty} × ${esc(dis.part)} · traction inverter modules</b>
          <div class="rr-big"><strong>${dis.delayDays}</strong><span>days late<br><em>${fmtDay(dis.originalDay)} → ${fmtDay(dis.newDay)}</em></span></div>
          <p>The batch is pegged to <b>${F.pegged.map(p => p.id).join(', ')}</b>. Without traction inverters, electrical integration (S30) cannot finish, and every station after it waits.</p></div>
        <div class="rr-chain">${[['Supplier', `${dis.qty} modules, ${dis.delayDays} days late`], ['Inventory', `${F.lots.filter(l => l.part === dis.part).reduce((a, l) => a + l.qty, 0)} units of the same variant in stock across sites — not all usable`], ['Production', `${F.pegged.filter(p => !p.kitted).length} S30 slots at risk (${F.pegged.filter(p => !p.kitted).map(p => `${p.id} ${day(p.s30Day)}`).join(', ')})`], ['Delivery', `${F.pegged.length} trainsets on contract ${esc(F.pegged[0].contract)} · tightest slack ${Math.min(...F.pegged.filter(p => !p.kitted).map(p => p.slack))} days`]].map(([a, b], i) => `<div class="rr-link"><b>${a}</b><span>${esc(b)}</span></div>${i < 3 ? '<i class="rr-down" aria-hidden="true"></i>' : ''}`).join('')}
          <div class="rr-risk"><strong>${F.pegged.length} products at risk</strong><span>If nothing is done: ${eEur(r.baseline.total)} of exposure (calculated in chapter 06).</span></div></div>
      </div>${next('disruption')}`)}

    ${sec('reduce', 2, 'Reduce before reasoning.', 'Deterministic code reads every enterprise system and keeps only the evidence the decision depends on. No model sees the raw data.', `
      <div class="rr-sources">${SOURCES.map(s => `<div><b>${esc(s.name)}</b><span>${int(t.rawRecords && r.reduce.telemetry.sourceRecords[s.id])}</span><small>${esc(s.what)}</small></div>`).join('')}</div>
      <div class="rr-funnel card">
        <div class="rr-fside"><strong>${int(t.rawRecords)}</strong><span>enterprise records · ≈${int(r.reduce.telemetry.rawTokens)} tokens</span></div>
        <ol>${r.reduce.stages.map(s => `<li><b>${esc(s.label)}</b><span>${esc(s.what)}</span><em>${int(s.recordsOut)}</em></li>`).join('')}</ol>
        <div class="rr-fside out"><strong>${t.evidenceItems}</strong><span>evidence items · ≈${int(r.reduce.telemetry.evidenceTokens)} tokens</span></div>
      </div>
      <p class="rr-stat"><strong>${pct(t.reductionPercentage)}</strong> less context, computed as 1 − evidence tokens / raw tokens, in ${t.processingTime.toFixed(0)} ms of ordinary code. Each evidence item keeps its source system and the method that produced it.</p>
      <details class="rr-more"><summary>See the evidence pack (${t.evidenceItems} items)</summary><div class="rr-ev">${r.evidence.map(x => `<div><code>${x.id}</code><b>${esc(x.type)}</b><span>${esc(Object.values(x.keys).join(' · '))}</span><em>${esc(x.src)}</em></div>`).join('')}</div></details>
      ${next('reduce')}`)}

    ${sec('decide', 3, 'Decide before invoking AI.', 'A small decision model reads nine figures from the evidence and answers one question: does this need cross-domain reasoning at all?', `
      <div class="rr-grid2">
        <div class="card rr-model"><small>Decision model · ${int(t.decisionModel.parameters)} parameters · ${esc(r.decision.runtime)}</small>
          <ul class="rr-feat">${RAIL_FEATURES.map((f, i) => `<li><span>${esc(f.label)}</span><i style="--v:${(r.features.vector[i] * 100).toFixed(0)}%"></i><b>${featureText(f.id, r.features.values[f.id])}</b></li>`).join('')}</ul>
          <p class="rr-fine">Inputs are computed from the evidence. Inference ${t.decisionModel.latencyMs < 1 ? '< 1' : t.decisionModel.latencyMs.toFixed(1)} ms · no network call · €0.</p></div>
        <div class="rr-verdict"><div class="card big"><small>Model output</small><strong>${esc(r.decision.gate.verdict)}</strong>
          <p>Reasoning required: <b>${r.decision.decisions.reasoning_required.label}</b> (${(r.decision.decisions.reasoning_required.confidence * 100).toFixed(1)} %) · route <b>${r.decision.decisions.route.label}</b> · domains ${r.decision.gate.agents.map(d => `<span class="tag neutral">${d.replace('_', ' + ')}</span>`).join(' ')}</p></div>
          <div class="card small"><small>Same morning, another notice</small><p>${esc(ui.routine?.facts.disruption.part ?? 'A seat-frame part')} is ${ui.routine?.facts.disruption.delayDays ?? 1} day late, fully covered by stock. The model routes it <b>${esc(ui.routine?.decision.gate.verdict ?? 'to deterministic rules')}</b>: no agents, no model call, €0.</p></div></div>
      </div>${next('decide')}`)}

    ${sec('reason', 4, 'Specialists. Shared evidence. One decision.', 'Four specialists work only where the model said complexity is real. They exchange short structured messages and read enterprise systems through tools; nothing they conclude is typed in.', `
      <div class="rr-team">${SPECIALISTS.filter(s => s.id !== 'configuration').map(s => agentCard(s, r)).join('')}${agentCard(SPECIALISTS.find(s => s.id === 'configuration'), r, ui.step < 6)}</div>
      <div class="rr-replay card"><div class="rr-replay-head"><b>Coordination log</b><span>${t.a2aMessages} agent messages · ${t.toolCalls} tool calls · ${t.modelCalls} model turns</span><button class="btn sm" id="rr-play">${icon('play', 13)} Replay</button></div><ol id="rr-log">${logMarkup(r, ui.step < 6)}</ol></div>
      <p class="rr-fine">Message channel A2A (agent ↔ agent) · tool channel MCP (agent ↔ enterprise system) · provider ${esc(t.provider.provider)}${t.provider.mode === 'SIMULATED' ? ' — the Gemini adapter is used in live mode' : ''}.</p>
      ${next('reason')}`)}

    ${sec('validate', 5, 'Every proposal meets the constraints first.', 'The candidate plan is checked by deterministic code. A model cannot override a failed check.', `
      <ul class="rr-checks">${r.validation.checks.filter(c => c.kind !== 'ENGINEERING' && !c.id.startsWith('config-')).map(c => `<li class="${c.ok ? 'ok' : 'bad'}">${icon(c.ok ? 'check' : 'alert', 14)}<b>${esc(c.label)}</b><span>${esc(c.detail)}</span></li>`).join('')}
        <li class="pend">${icon('clock', 14)}<b>Component configuration</b><span>${ui.step >= 6 ? 'see chapter 07' : 'checked by the manufacturing / configuration specialist next'}</span></li></ul>
      ${next('validate')}`)}

    ${sec('outcome', 6, ui.engineering === 'reject' ? 'Recovery with approved variants only.' : 'Delivery commitment protected.', 'The plan that comes out of the data, and what it is worth — with every formula one click away.', `
      <div class="rr-plan">${(ui.view?.plan ?? r.plan).actions.map(a => `<div class="card ${a.protected ? 'ok' : 'bad'}"><b>${a.trainset}</b><span class="tag ${a.kind === 'CONTINUE' ? 'neutral' : 'ok'}">${esc(a.kind.replaceAll('_', ' ').toLowerCase())}</span><p>${esc(a.text)}</p><small>${a.protected ? 'Delivery date held' : `${a.slip} day(s) late`}</small></div>`).join('')}</div>
      <div class="rr-value">
        <div><strong>${dis.delayDays} days</strong><span>original disruption</span></div>
        <div><strong>${kEur(e.exposure)}</strong><span>business exposure if nothing is done</span></div>
        <div><strong>${kEur(e.recoveryCost)}</strong><span>recovery cost</span></div>
        <div><strong>${kEur(e.residualExposure)}</strong><span>residual exposure</span></div>
        <div class="hero"><strong>${kEur(e.valueProtected)}</strong><span>value protected by the proposed recovery plan</span></div>
      </div>
      <p class="rr-aicost">AI decision cost: <b>${eur(t.aiCostEur, { precise: true })}</b> ${t.tokensEstimated ? '(estimated tokens × Flash-tier price)' : '(measured tokens)'} — for a decision that addresses ${eEur(e.exposure)} of exposure. The value comes from the recovery plan people approve, not from the AI.</p>
      <p class="rr-fine">Value protected = exposure − recovery cost − residual exposure = ${eEur(e.exposure)} − ${eEur(e.recoveryCost)} − ${eEur(e.residualExposure)} = ${eEur(e.valueProtected)}.${ui.engineering ? '' : ' Proposed — subject to the configuration check.'}</p>
      <details class="rr-more"><summary>Exposure and cost, line by line</summary><table class="rr-t"><tbody>${e.exposureLines.map(l => `<tr><td>Exposure</td><td>${esc(l.label)}</td><td>${esc(l.formula)}</td><td class="num">${eEur(l.eur)}</td></tr>`).join('')}${e.costLines.map(l => `<tr><td>Recovery</td><td>${esc(l.label)}</td><td>${esc(l.formula)}</td><td class="num">${eEur(l.eur)}</td></tr>`).join('')}${e.residualLines.map(l => `<tr><td>Residual</td><td>${esc(l.label)}</td><td>${esc(l.formula)}</td><td class="num">${eEur(l.eur)}</td></tr>`).join('')}</tbody></table><p class="rr-fine">Synthetic contract terms and rates from the cost / risk system; change them and every figure here and in the film changes with them.</p></details>
      ${next('outcome')}`)}

    ${sec('boundary', 7, 'Know when not to decide.', 'The configuration check finds what operations alone could not see.', boundary(r))}

    ${sec('governance', 8, 'AI proposes. Engineering validates. Humans decide.', 'Explicit decision states. Each transition names who can make it.', governance(r))}

    ${sec('telemetry', 9, 'What this decision consumed.', 'AI economics and architecture, measured or estimated — and labelled as such.', telemetry(r))}
    <p class="rr-foot">${esc(COMPANY.name)} is fictional. All enterprise systems are simulated and all data is synthetic. Contract terms, rates and prices are illustrative.</p>`;
    bind();
  }

  function featureText(id, v) {
    return { delay_days: `${v} days`, criticality: v >= 1 ? 'gates S30' : 'low', inventory_coverage: `${Math.round(v * 100)} %`, products_affected: `${v} trainsets`, schedule_slack: `${v} days`, supplier_alternatives: `${v} qualified`, configuration_complexity: `${v} variants`, financial_exposure: kEur(v), engineering_implication: v ? 'yes' : 'no' }[id];
  }
  function agentCard(s, r, pending = false) {
    const out = r.specialists?.[s.id], calls = r.toolCalls.filter(c => c.agent === s.id), m = r.modelCalls.filter(c => c.agent === s.id);
    return `<div class="card rr-agent ${pending ? 'pending' : ''}"><div class="rr-ah">${icon(s.icon, 18)}<b>${esc(s.name)}</b></div>
      <ul>${s.status.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
      <p>${pending ? 'Runs when the candidate plan is validated.' : esc(out?.summary ?? '')}</p>
      <small>${pending ? '' : `${calls.length} tool calls · ${[...new Set(calls.map(c => c.system))].join(', ')} · ${m.reduce((a, x) => a + x.calls, 0)} model turns`}</small></div>`;
  }
  function logMarkup(r, hideConfig) {
    return r.events.filter(ev => ['a2a', 'mcp'].includes(ev.kind) && !(hideConfig && (ev.to === 'configuration' || ev.from === 'configuration' || ev.agent === 'configuration'))).map((ev, i) =>
      `<li class="${ev.kind}" style="--i:${i}"><span class="tag ${ev.kind === 'a2a' ? 'a2a' : 'mcp'}">${ev.kind === 'a2a' ? 'A2A' : 'MCP'}</span><b>${ev.kind === 'a2a' ? `${esc(ev.from)} → ${esc(ev.to)}` : esc(ev.agent)}</b><span>${esc(ev.text)}</span></li>`).join('');
  }
  function boundary(r) {
    const c = r.validation.engineering[0], d = r.deviation;
    if (!c) return '<p>No configuration conflict.</p>';
    const vRun = ui.preview ??= { validate: economics(r.facts, r.plan, r.baseline), reject: economics(r.facts, buildPlan(r.facts, { approvedVariantsOnly: true }), r.baseline) };
    return `
      <div class="rr-conflict card"><div class="rr-cf-head">${icon('alert', 20)}<strong>Configuration conflict</strong><span class="tag bad">${esc(LABEL.ENGINEERING_REVIEW_REQUIRED)}</span></div>
        <p>${esc(r.specialists.configuration.summary)}</p>
        <p class="rr-fine">${esc(c.detail)}</p>
        <p>The recovery is <b>frozen</b>. The agents stop: they do not look for a workaround and they cannot authorise one. The operational problem has become an engineering problem.</p></div>
      <div class="rr-grid2">
        <div class="rr-loop">${['Operations', 'Engineering', 'Validate', 'Operations'].map((s, i) => `<div class="${i === 1 && !ui.engineering ? 'now' : ''}">${s}</div>${i < 3 ? `<i>${icon('arrow', 14)}</i>` : ''}`).join('')}</div>
        <div class="card rr-proc"><small>Engineering procedure ${esc(d.procedure)} (configuration system)</small><ol>${d.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>
          <p class="rr-fine">Needs ${d.extraHours} h in the S50 static-test slot; ${d.spareHours} h are spare → ${d.fitsInSlot ? 'fits without extra cost' : `extra cost ${eEur(d.extraCostEur)}`}. Sign-off: engineering.</p></div>
      </div>
      <div class="rr-decide eng"><p>Engineering decision${ui.engineering ? ` recorded: <b>${ui.engineering === 'validate' ? 'deviation validated' : 'deviation rejected'}</b>` : ''}</p>
        <button class="btn ${ui.engineering === 'validate' ? 'primary' : ''}" data-eng="validate" ${ui.engineering ? 'disabled' : ''}>Validate the deviation · value ${kEur(vRun.validate.valueProtected)}</button>
        <button class="btn ${ui.engineering === 'reject' ? 'primary' : ''}" data-eng="reject" ${ui.engineering ? 'disabled' : ''}>Reject — approved variants only · value ${kEur(vRun.reject.valueProtected)}</button>
        <small>These buttons are the engineer's. The page never decides on its own.</small></div>
      ${ui.engineering ? next('boundary') : ''}`;
  }
  function governance(r) {
    const g = ui.view?.governance ?? r.governance;
    const track = [['PROPOSED', 'AI proposed', 'agents'], ['ENGINEERING_VALIDATED', 'Engineering validated', 'engineer'], ['APPROVED', 'Human approved', 'operations manager'], ['EXECUTED_SIMULATED', 'Executed (simulated)', 'enterprise systems']];
    const reached = new Set(g.history.map(h => h.state));
    return `<div class="rr-track">${track.map(([s, l, who], i) => `<div class="${reached.has(s) ? 'done' : ''} ${s === 'ENGINEERING_VALIDATED' && ui.engineering === 'reject' ? 'skip' : ''}"><b>${l}</b><small>${who}</small></div>${i < 3 ? `<i>${icon('arrow', 14)}</i>` : ''}`).join('')}</div>
      <p class="rr-state">Current state: <span class="tag ${g.state === 'APPROVED' || g.state === 'EXECUTED_SIMULATED' ? 'ok' : g.state === 'REJECTED' ? 'bad' : 'warn'}">${esc(LABEL[g.state])}</span></p>
      <div class="rr-decide"><button class="btn primary" data-approve="approve" ${g.state !== 'AWAITING_HUMAN_APPROVAL' ? 'disabled' : ''}>Approve the recovery plan</button><button class="btn" data-approve="reject" ${g.state !== 'AWAITING_HUMAN_APPROVAL' ? 'disabled' : ''}>Reject</button>
        <small>${g.state === 'ENGINEERING_REVIEW_REQUIRED' ? 'Approval is locked until engineering has decided (chapter 07).' : g.state === 'AWAITING_HUMAN_APPROVAL' ? 'Your decision as operations manager.' : ''}</small></div>
      <ol class="rr-hist">${g.history.map(h => `<li><span class="tag neutral">${esc(LABEL[h.state])}</span><b>${esc({ agent: 'AI (agents)', validator: 'Deterministic validation', engineer: 'Engineering', approver: 'Operations manager', system: 'Enterprise systems (simulated)' }[h.actor] ?? h.actor)}</b><span>${esc(h.note ?? '')}</span></li>`).join('')}</ol>
      ${g.state === 'APPROVED' || g.state === 'EXECUTED_SIMULATED' || g.state === 'REJECTED' ? next('governance') : ''}`;
  }
  function telemetry(r) {
    const t = r.telemetry, by = {};
    for (const c of r.toolCalls) by[c.system] = (by[c.system] ?? 0) + 1;
    const p = PRICES.flash;
    return `<div class="rr-tele">
      ${[['Evidence preprocessing', `${t.processingTime.toFixed(0)} ms`, `${int(t.rawRecords)} → ${t.evidenceItems} items`], ['Decision model', `${int(t.decisionModel.parameters)} parameters`, `${t.decisionModel.latencyMs < 1 ? '< 1' : t.decisionModel.latencyMs.toFixed(1)} ms · ${(t.decisionModel.confidence * 100).toFixed(1)} % confident`], ['Agents engaged', `${t.agentCalls}`, `only after the model routed AGENTIC`], ['Model turns', `${t.modelCalls}`, t.tokensEstimated ? 'simulated provider' : 'Gemini API'], ['Input tokens', int(t.inputTokens), t.tokensEstimated ? 'estimated' : 'reported by the API'], ['Output + thinking', `${int(t.outputTokens)} + ${int(t.thinkingTokens)}`, t.tokensEstimated ? 'estimated (thinking budget stated)' : 'reported'], ['Tool calls (MCP)', `${t.toolCalls}`, Object.entries(by).map(([k, v]) => `${k} ${v}`).join(' · ')], ['Agent messages (A2A)', `${t.a2aMessages}`, 'orchestrator ↔ specialists'], ['Total latency', `${(t.totalLatencyMs / 1000).toFixed(1)} s`, 'sequential, modelled in simulation'], ['AI cost per decision', eur(t.aiCostEur, { precise: true }), `${p.label}: $${p.inPerMUsd} / $${p.outPerMUsd} per M tokens · $1 = €${USD_TO_EUR}`]].map(([a, b, c]) => `<div class="card"><small>${a}</small><b>${b}</b><span>${esc(c)}</span></div>`).join('')}</div>
      <div class="rr-arch card"><b>Decision architecture</b><ol>${[['Industrial event', 'supplier notice', 'det'], ['Evidence reduction', 'deterministic code', 'det'], ['Decision model', `${int(t.decisionModel.parameters)}-parameter MLP in the browser`, 'model'], ['Agentic reasoning if required', `4 specialists · provider: ${t.provider.provider}`, 'llm'], ['Enterprise tools', 'MCP · ERP, MES, inventory, planning, configuration, cost (simulated)', 'mcp'], ['Deterministic validation', 'constraints a model cannot override', 'det'], ['Business decision', 'value protected, AI cost', 'det'], ['Human approval', 'operations manager', 'human'], ['Engineering escalation if required', 'engineer · deviation procedure', 'human']].map(([a, b, k]) => `<li class="${k}"><b>${a}</b><span>${esc(b)}</span></li>`).join('')}</ol></div>
      <div class="rr-grid2"><div class="card rr-modes"><b>SIMULATED</b><p>No model is called. Each specialist's behaviour is replayed deterministically through the same MCP tools, so its conclusions are still grounded; token counts are estimates. This is what the published page runs.</p></div>
        <div class="card rr-modes"><b>LIVE</b><p>With your own key, <code>GEMINI_API_KEY=… npm run start:live</code> serves the four specialists as Google ADK agents over A2A, with an MCPToolset on a real MCP server; the page reads the run from <code>127.0.0.1</code> with <code>?provider=live</code>. Tokens come from the API. Validation, economics and governance are the same code.</p></div></div>`;
  }

  function bind() {
    el.querySelectorAll('[data-next]').forEach(b => b.addEventListener('click', () => { ui.step = Math.max(ui.step, Number(b.dataset.next)); render(); requestAnimationFrame(() => el.querySelector(`#rr-${CH[ui.step][0]}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })); }));
    el.querySelector('#rr-all')?.addEventListener('click', () => { if (ui.step >= CH.length - 1) { ui.step = 0; ui.engineering = null; ui.view = null; ui.preview = null; ui.run = ui.baseRun; reload(); return; } ui.step = CH.length - 1; render(); });
    el.querySelectorAll('[data-ch]').forEach(a => a.addEventListener('click', ev => { if (Number(a.dataset.ch) > ui.step) ev.preventDefault(); }));
    el.querySelectorAll('[data-eng]').forEach(b => b.addEventListener('click', () => {
      ui.engineering = b.dataset.eng;
      const v = resolveEngineering(ui.run, ui.engineering);
      ui.view = { plan: v.plan, economics: v.economics, governance: v.governance };
      render(); el.querySelector('#rr-boundary')?.scrollIntoView({ block: 'start' });
    }));
    el.querySelectorAll('[data-approve]').forEach(b => b.addEventListener('click', () => {
      const g = ui.view.governance;
      g.apply(b.dataset.approve, { actor: 'approver', note: b.dataset.approve === 'approve' ? 'Recovery plan approved' : 'Recovery plan rejected' });
      if (g.state === 'APPROVED') g.apply('execute', { actor: 'system', note: 'Transfers, resequencing and overtime booked in the simulated ERP / MES / planning systems' });
      render(); el.querySelector('#rr-governance')?.scrollIntoView({ block: 'start' });
    }));
    el.querySelector('#rr-play')?.addEventListener('click', () => { const ol = el.querySelector('#rr-log'); ol.classList.remove('play'); void ol.offsetWidth; ol.classList.add('play'); });
  }
  async function reload() { ui.run = await runRecovery({ decide: ui.decideFn }); ui.baseRun = ui.run; render(); }

  let started = false;
  return {
    update() {
      if (started) return;
      started = true;
      (async () => { await load(); ui.routine = await runRecovery({ notice: 'SN-26-0409' }); render(); })();
    }
  };
}
