// DECIDE — the Industrial Recovery decision model: pure-JavaScript evaluator of the shipped weights, decoding and gate.
// The browser executes models/rail-system1/decision-mlp.onnx with ONNX Runtime Web (rail/runtime.js); this evaluator
// produces the same outputs (golden parity is tested) for Node, for the film and as the labelled fallback.
import { WEIGHTS, MODEL_CARD } from './decision-weights.js';
import { RAIL_FEATURES } from './features.js';

export { MODEL_CARD };
export const HEADS = Object.entries(WEIGHTS.heads).map(([id, h]) => ({ id, ...h }));
export const GATE = { minConfidence: 0.75, rule: 'Agents are engaged only if the model says reasoning is required on an AGENTIC route with at least 75 % confidence. Routine disruptions stay with deterministic rules; a HUMAN_REVIEW route goes straight to a person.' };

const softmax = z => { const m = Math.max(...z); const e = z.map(v => Math.exp(v - m)); const s = e.reduce((a, b) => a + b, 0); return e.map(v => v / s); };
const sigmoid = v => 1 / (1 + Math.exp(-v));

export function evaluate(vector) {
  let h = vector.map((x, i) => (x - WEIGHTS.mean[i]) / WEIGHTS.std[i]);
  for (const L of WEIGHTS.layers) {
    const out = L.b.slice();
    for (let i = 0; i < h.length; i++) { const hi = h[i], row = L.W[i]; if (hi === 0) continue; for (let j = 0; j < out.length; j++) out[j] += hi * row[j]; }
    h = L.act === 'relu' ? out.map(v => (v > 0 ? v : 0)) : out;
  }
  return Object.fromEntries(HEADS.map(hd => { const z = h.slice(hd.slice[0], hd.slice[1]); return [hd.id, hd.act === 'softmax' ? softmax(z) : z.map(sigmoid)]; }));
}

export function decode(probs) {
  const out = {};
  for (const hd of HEADS) {
    const p = Array.from(probs[hd.id]);
    if (hd.act === 'softmax') { const i = p.indexOf(Math.max(...p)); out[hd.id] = { label: hd.labels[i], confidence: p[i], probabilities: Object.fromEntries(hd.labels.map((l, k) => [l, p[k]])) }; }
    else out[hd.id] = { selected: hd.labels.filter((_, k) => p[k] >= 0.5), confidence: Math.min(...p.map(v => Math.max(v, 1 - v))), probabilities: Object.fromEntries(hd.labels.map((l, k) => [l, p[k]])) };
  }
  return out;
}

/** The gate decides whether agents run. It reads only the model's typed outputs. */
export function gate(d, g = GATE) {
  const weakest = Object.entries(d).reduce((a, [id, x]) => (x.confidence < a.confidence ? { id, confidence: x.confidence } : a), { id: null, confidence: 1 });
  let path, verdict;
  if (d.route.label === 'HUMAN_REVIEW') { path = 'HUMAN_REVIEW'; verdict = 'ESCALATE TO A PERSON'; }
  else if (d.reasoning_required.label === 'YES' && d.route.label === 'AGENTIC' && weakest.confidence >= g.minConfidence) { path = 'AGENTIC'; verdict = 'AGENTIC REASONING REQUIRED'; }
  else if (d.reasoning_required.label === 'NO' && d.route.label === 'DIRECT' && weakest.confidence >= g.minConfidence) { path = 'DIRECT'; verdict = 'DETERMINISTIC RULES ARE SUFFICIENT'; }
  else { path = 'HUMAN_REVIEW'; verdict = 'LOW CONFIDENCE — ESCALATE TO A PERSON'; }
  return { path, verdict, agents: path === 'AGENTIC' ? d.domains.selected : [], weakest, threshold: g.minConfidence, rule: g.rule };
}

/** Pure-JS decision (Node, film, fallback). Latency is measured. */
export function decideJs(vector) {
  const t = (globalThis.performance ?? Date).now();
  const probs = evaluate(vector);
  const ms = (globalThis.performance ?? Date).now() - t;
  const decisions = decode(probs);
  return { probs, decisions, gate: gate(decisions), inferenceMs: ms, runtime: 'JavaScript evaluator of the shipped weights', parameters: MODEL_CARD.parameters, modelBytes: MODEL_CARD.onnx.bytes, features: RAIL_FEATURES.map((f, i) => ({ ...f, value: vector[i] })) };
}
