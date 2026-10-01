// PREREQUISITES — why the three foundations (knowledge, physics, reasoning) are a prerequisite for AI at scale.
// For each foundation: the question it answers, what the demo measured with it, and what happens without it.
// "Without" figures are the demo's own counterfactuals (brute-force run, tool-level openness), computed from the same run.
import { icon } from './icons.js';
import { esc, int, compact, eur } from './format.js';
import { runFacts } from './framing.js';
import { IWM_PILLARS } from '../domain/positioning.js';

const signed = v => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(1)}`;

function rows(f) {
  const x = n => `${Math.round(n)}×`;
  return [
    {
      pillar: IWM_PILLARS[0], q: 'Is the industrial ground truth available, reconciled and governed?',
      without: { head: `≈${compact(f.bfTokens)} tokens of raw data per decision`, measured: [f.overflows ? `${f.overflows} agent contexts overflow the model window and must be split` : null, `${int(f.bfCalls)} model calls instead of ${int(f.modelCalls)}`, `${eur(f.bfCost, { precise: true })} per decision`].filter(Boolean), qualitative: ['Site rules (planning allowance, jobs that must never move) are not in the data: they have to be re-told or guessed, every time.'] },
      with: { head: `${int(f.evidenceRecords)} evidence records · ≈${compact(f.evidenceTokens)} tokens`, measured: [`${eur(f.leanCost, { precise: true })} per decision — ${x(f.bfCost / f.leanCost)} less`, `Site rules applied as explicit, governed know-how (+${f.allowance} % allowance, critical jobs untouched)`] },
      provided: 'Domain knowledge + operator know-how + real-world data: the industrial ground truth.'
    },
    {
      pillar: IWM_PILLARS[1], q: 'Can every figure behind the decision be verified by science?',
      without: { head: 'Figures generated, not computed', measured: [], qualitative: [`The model would compute “${f.formula1}” itself, with nothing independent to check it against.`, 'The loop has no acceptance test the agents cannot argue with, so it cannot stop safely.', 'The go / no-go on a 120 kW rack becomes unverifiable.'] },
      with: { head: `${signed(f.head1)} kW → ${signed(f.head2)} kW, verified`, measured: [`Loop heat p95 ${f.p95} kW from coolant flow × ΔT — same result on every run`, `One deterministic verifier; loop accepted at iteration ${f.iterations} of ${f.maxIterations}`], note: 'In production: full simulation against the system model (see the Engineering page). The live demo uses a physics formula in its place.' },
      provided: 'System models, physics and simulation, structure plus behaviour: science-grounded understanding.'
    },
    {
      pillar: IWM_PILLARS[2], q: 'Can a goal be broken into coordinated tasks, with people accountable?',
      without: { head: 'Open at the tool: the caller does the domain work', measured: [`${f.tools} raw tools to learn and ${f.skillCalls} calls to sequence`, `≈${int(f.toolTokens)} tokens of tool definitions and raw results to read`], qualitative: ['No correction loop, no budget, no hand-over rule.', 'People coordinate outside the evidence, by email and meetings.'] },
      with: { head: `1 goal → ${f.competences} competences → ${f.skillCalls} skill executions`, measured: [`≈${int(f.answerTokens)} tokens of bounded answers — ${x(f.toolTokens / Math.max(f.answerTokens, 1))} less to read`, `${f.humans} people approve at the same layer · ${f.humanMinutes} min of human time`] },
      provided: 'Reasoning by specialised agents with defined competences, people in the loop.'
    }
  ];
}

export function mountPrereq(el, app) {
  let mode = 'with', key = '';
  function render() {
    const v = app.completed(), f = runFacts(app.scenario, v.run);
    const list = rows(f);
    const li = (arr, cls = '') => arr.map(t => `<li class="${cls}">${esc(t)}</li>`).join('');
    el.innerHTML = `
    <div class="page-head">
      <div><span class="eyebrow"><i class="pip"></i>Prerequisites for AI at scale</span><h1 class="display" style="font-size:clamp(32px,3.6vw,50px);margin-top:12px">Agents are the visible part. <span>The foundations are the prerequisite.</span></h1>
      <p class="lede">The same decision, with and without each foundation. “With” is what the demo measured. “Without” uses the demo’s own counterfactuals from the same run; consequences that cannot be measured here are marked <span class="tag neutral">qualitative</span>.</p></div>
      <div class="run-banner"><span class="tag ${v.source === 'live' ? 'ok' : 'neutral'}">${v.source === 'live' ? 'Your run' : 'Reference run'}</span> ${esc(v.run.id)}</div>
    </div>
    <div class="prq-switch"><div class="seg" role="group" aria-label="Platform"><button type="button" data-mode="without" aria-pressed="${mode === 'without'}">Without the foundations</button><button type="button" data-mode="with" aria-pressed="${mode === 'with'}">With the three foundations</button></div><span class="small muted">Switch to compare all three foundations at once.</span></div>
    <div class="prq-list" data-mode="${mode}">
      ${list.map(r => { const s = r[mode]; return `<section class="prq-card ${mode}" aria-labelledby="prq-${r.pillar.id}">
        <div class="prq-pillar"><span class="n">${r.pillar.n}</span><div><b id="prq-${r.pillar.id}">${esc(r.pillar.title)}</b><small>${esc(r.pillar.tag)}</small></div></div>
        <div class="prq-q"><small>The prerequisite question</small><p>${esc(r.q)}</p></div>
        <div class="prq-state"><span class="tag ${mode === 'with' ? 'ok' : 'bad'}">${mode === 'with' ? `${icon('check', 12)} with the foundation` : `${icon('alert', 12)} without it`}</span><h3>${esc(s.head)}</h3>
          <ul>${li(s.measured)}${li(s.qualitative ?? [], 'ql')}</ul>${s.note ? `<p class="prq-note">${esc(s.note)}</p>` : ''}</div>
        <div class="prq-provided"><small>Provided by</small><p>${esc(r.provided)}</p><em>Foundation ${r.pillar.n} · ${esc(r.pillar.title)}</em></div>
      </section>`; }).join('')}
    </div>
    <div class="cta-band"><div><p>Per decision, foundation 1 alone separates ${eur(f.bfCost, { precise: true })} from ${eur(f.leanCost, { precise: true })}. Foundations 2 and 3 are what make the answer verifiable and accountable. Over thousands of decisions, that is the difference between a pilot and AI at scale.</p></div><button class="btn" data-go="scale">See it at scale ${icon('arrow', 16)}</button></div>
    <p class="fine" style="margin-top:14px">Foundation titles and descriptions are this demonstrator’s framing; the “provided by” lines summarise them. Simulated scenario: no customer system is connected.</p>`;
  }
  el.addEventListener('click', e => {
    const b = e.target.closest('[data-mode]'); if (b) { mode = b.dataset.mode; render(); return; }
    const g = e.target.closest('[data-go]'); if (g) app.go(g.dataset.go);
  });
  return { update() { const v = app.completed(); const k = `${v.run.id}:${v.source}`; if (k !== key || !el.innerHTML) { key = k; render(); } } };
}
