// Browser runtime for the Industrial Recovery decision model: ONNX Runtime Web (vendored) on WASM/CPU,
// falling back to the JavaScript evaluator of the same weights (labelled). The reported runtime is the one that ran.
import { decode, gate, decideJs, evaluate, MODEL_CARD } from './decision.js';

const ROOT = new URL('../../../', import.meta.url);
const ORT_DIR = new URL('vendor/onnxruntime-web/1.22.0/', ROOT);
const MODEL_URL = new URL('models/rail-system1/decision-mlp.onnx', ROOT);
let ready = null;

function init() {
  if (ready) return ready;
  ready = (async () => {
    const t0 = performance.now();
    try {
      const bytes = new Uint8Array(await (await fetch(MODEL_URL)).arrayBuffer());
      const ort = await import(new URL('ort.wasm.min.mjs', ORT_DIR).href);
      ort.env.wasm.wasmPaths = ORT_DIR.href; ort.env.wasm.numThreads = 1; ort.env.logLevel = 'error';
      const session = await ort.InferenceSession.create(bytes, { executionProviders: ['wasm'] });
      return { ort, session, loadMs: performance.now() - t0 };
    } catch (e) { return { error: e.message, loadMs: performance.now() - t0 }; }
  })();
  return ready;
}

/** Run the decision model in the browser. Same return shape as decideJs. */
export async function decideInBrowser(vector) {
  const rt = await init();
  if (!rt.session) return { ...decideJs(vector), runtime: 'JavaScript evaluator (fallback — ONNX Runtime Web unavailable)', note: rt.error };
  const run = async () => { const t = performance.now(); const out = await rt.session.run({ features: new rt.ort.Tensor('float32', Float32Array.from(vector), [1, vector.length]) }); return { out, ms: performance.now() - t }; };
  await run(); // warm-up (first call includes session set-up)
  const { out, ms } = await run();
  const probs = Object.fromEntries(Object.entries(out).map(([k, v]) => [k, Array.from(v.data)]));
  const ref = evaluate(vector), parity = Math.max(...Object.keys(ref).flatMap(k => ref[k].map((v, i) => Math.abs(v - probs[k][i]))));
  const decisions = decode(probs);
  return { ...decideJs(vector), probs, decisions, gate: gate(decisions), inferenceMs: ms, runtime: 'Browser · WASM (ONNX Runtime Web 1.22.0)', loadMs: rt.loadMs, parity, parameters: MODEL_CARD.parameters, modelBytes: MODEL_CARD.onnx.bytes };
}
