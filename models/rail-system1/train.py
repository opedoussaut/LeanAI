"""
LeanAI · Industrial Recovery decision model — reproducible training and export.

A small multi-head MLP maps the nine inputs of a supply disruption (src/scenarios/rail/features.js) to three typed decisions:
  reasoning_required   NO / YES                                        (softmax)
  route                DIRECT / AGENTIC / HUMAN_REVIEW                 (softmax)
  domains              PLANNING, SUPPLY, CONFIGURATION, COST_RISK      (independent sigmoids)

Question it answers: does this disruption need cross-domain agentic reasoning at all?
Training data: synthetic disruptions sampled over plausible ranges and labelled by the planning rules below (label()).
2 % label noise keeps it from memorising thresholds. Nothing here is company data. NovaRail is fictional.

Run:  python3 models/rail-system1/train.py      (numpy + onnx; writes the files next to this script and the JS weights)
"""
import json, hashlib, os
import numpy as np
import onnx
from onnx import helper, TensorProto, numpy_helper
from onnx.reference import ReferenceEvaluator

HERE = os.path.dirname(os.path.abspath(__file__))
SEED = 11
FEATURES = ['delay_days', 'criticality', 'inventory_coverage', 'products_affected', 'schedule_slack', 'supplier_alternatives', 'configuration_complexity', 'financial_exposure', 'engineering_implication']
REASON = ['NO', 'YES']; ROUTE = ['DIRECT', 'AGENTIC', 'HUMAN_REVIEW']; DOMAINS = ['PLANNING', 'SUPPLY', 'CONFIGURATION', 'COST_RISK']

RULES = [
  'problem = criticality >= 0.5 and inventory_coverage < 1 and delay_days(×20) > schedule_slack(×10)  — the delay cannot be absorbed by slack or exact-variant stock',
  'cross_domain = count of [products_affected >= 0.4, configuration_complexity >= 0.75, engineering_implication >= 0.5, financial_exposure >= 0.15, supplier_alternatives > 0] >= 2',
  'reasoning_required = YES if problem and cross_domain; else NO (a deterministic rule or one owner handles it)',
  'route = HUMAN_REVIEW if problem and supplier_alternatives == 0 and inventory_coverage < 0.2 and financial_exposure > 0.6 (nothing to recover with: a management decision); AGENTIC if reasoning_required; else DIRECT',
  'domains (only when AGENTIC): PLANNING if delay > slack; SUPPLY if coverage < 1; CONFIGURATION if configuration_complexity >= 0.75 or engineering_implication >= 0.5; COST_RISK if financial_exposure >= 0.1'
]

def label(x):
    dl, cr, cov, prod, sl, alt, cfg, exp, eng = x
    late = dl * 20 > sl * 10
    problem = cr >= 0.5 and cov < 1 and late
    cross = sum([prod >= 0.4, cfg >= 0.75, eng >= 0.5, exp >= 0.15, alt > 0]) >= 2
    reason = 1 if (problem and cross) else 0
    route = 2 if (problem and alt == 0 and cov < 0.2 and exp > 0.6) else 1 if reason else 0
    dom = [0, 0, 0, 0]
    if route == 1:
        dom = [int(late), int(cov < 1), int(cfg >= 0.75 or eng >= 0.5), int(exp >= 0.1)]
    return reason, route, dom

def sample(n, rng):
    X = np.zeros((n, 9), np.float32)
    for i in range(n):
        dl = rng.choice([rng.uniform(0.0, 0.15), rng.uniform(0.0, 0.8)], p=[0.4, 0.6])
        cr = rng.choice([0.2, 1.0], p=[0.25, 0.75])
        cov = rng.choice([1.0, rng.uniform(0, 1)], p=[0.35, 0.65])
        prod = rng.choice([0.2, 0.4, 0.6, 0.8, 1.0], p=[0.4, 0.25, 0.2, 0.1, 0.05])
        sl = rng.uniform(0, 0.8)
        alt = rng.choice([0, 1/3, 2/3, 1], p=[0.35, 0.4, 0.15, 0.1])
        cfg = rng.choice([0.5, 1.0], p=[0.6, 0.4])
        exp = min(1.0, rng.exponential(0.25))
        eng = rng.choice([0, 1], p=[0.7, 0.3]) if cfg >= 0.75 else 0
        X[i] = [dl, cr, cov, prod, sl, alt, cfg, exp, eng]
    return X

def encode(X, rng, noise=0.02):
    n = len(X); Y = np.zeros((n, 9), np.float32)
    for i, x in enumerate(X):
        reason, route, dom = label(x)
        if rng.random() < noise: reason = 1 - reason
        if rng.random() < noise: route = int(rng.integers(3))
        Y[i, reason] = 1; Y[i, 2 + route] = 1; Y[i, 5:9] = dom
    return Y

def softmax(z): z = z - z.max(1, keepdims=True); e = np.exp(z); return e / e.sum(1, keepdims=True)
sigmoid = lambda z: 1 / (1 + np.exp(-np.clip(z, -60, 60)))

def forward(P, X):
    h0 = (X - P['mean']) / P['std']
    h1 = np.maximum(0, h0 @ P['W1'] + P['b1']); h2 = np.maximum(0, h1 @ P['W2'] + P['b2'])
    return h0, h1, h2, h2 @ P['W3'] + P['b3']

def heads(z): return softmax(z[:, 0:2]), softmax(z[:, 2:5]), sigmoid(z[:, 5:9])

def train():
    rng = np.random.default_rng(SEED)
    Xtr, Xte = sample(12000, rng), sample(3000, rng)
    Ytr, Yte = encode(Xtr, rng), encode(Xte, rng, noise=0.0)
    H = 24
    P = {'mean': Xtr.mean(0), 'std': Xtr.std(0) + 1e-6,
         'W1': rng.normal(0, np.sqrt(2 / 9), (9, H)).astype(np.float32), 'b1': np.zeros(H, np.float32),
         'W2': rng.normal(0, np.sqrt(2 / H), (H, H)).astype(np.float32), 'b2': np.zeros(H, np.float32),
         'W3': rng.normal(0, np.sqrt(1 / H), (H, 9)).astype(np.float32), 'b3': np.zeros(9, np.float32)}
    keys = ['W1', 'b1', 'W2', 'b2', 'W3', 'b3']
    m = {k: np.zeros_like(P[k]) for k in keys}; v = {k: np.zeros_like(P[k]) for k in keys}
    lr, b1, b2, t = 3e-3, 0.9, 0.999, 0
    for epoch in range(200):
        idx = rng.permutation(len(Xtr))
        for s in range(0, len(idx), 256):
            B = idx[s:s + 256]; X, Y = Xtr[B], Ytr[B]
            h0, h1, h2, z = forward(P, X)
            pa, pt, pg = heads(z)
            dz = np.zeros_like(z); dz[:, 0:2] = pa - Y[:, 0:2]; dz[:, 2:5] = pt - Y[:, 2:5]; dz[:, 5:9] = pg - Y[:, 5:9]; dz /= len(B)
            g = {'W3': h2.T @ dz, 'b3': dz.sum(0)}
            d2 = (dz @ P['W3'].T) * (h2 > 0); g['W2'] = h1.T @ d2; g['b2'] = d2.sum(0)
            d1 = (d2 @ P['W2'].T) * (h1 > 0); g['W1'] = h0.T @ d1; g['b1'] = d1.sum(0)
            t += 1
            for k in keys:
                m[k] = b1 * m[k] + (1 - b1) * g[k]; v[k] = b2 * v[k] + (1 - b2) * g[k] ** 2
                P[k] -= lr * (m[k] / (1 - b1 ** t)) / (np.sqrt(v[k] / (1 - b2 ** t)) + 1e-8)
        if epoch == 140: lr = 1e-3
    for k in P: P[k] = P[k].astype(np.float32)
    _, _, _, z = forward(P, Xte); pa, pt, pg = heads(z)
    acc = lambda p, a, b: float((p.argmax(1) == Yte[:, a:b].argmax(1)).mean())
    metrics = {'holdout_samples': len(Xte), 'reasoning_required_accuracy': acc(pa, 0, 2), 'route_accuracy': acc(pt, 2, 5), 'domains_exact_match': float(((pg > 0.5).astype(int) == Yte[:, 5:9]).all(1).mean())}
    return P, metrics, len(Xtr)

def export_onnx(P, path):
    init = [numpy_helper.from_array(P['mean'], 'mean'), numpy_helper.from_array(P['std'], 'std')]
    for k in ['W1', 'b1', 'W2', 'b2', 'W3', 'b3']: init.append(numpy_helper.from_array(P[k], k))
    spans = {'reasoning_required': (0, 2, 'Softmax'), 'route': (2, 5, 'Softmax'), 'domains': (5, 9, 'Sigmoid')}
    N = [helper.make_node('Sub', ['features', 'mean'], ['x0']), helper.make_node('Div', ['x0', 'std'], ['x1']),
         helper.make_node('Gemm', ['x1', 'W1', 'b1'], ['g1']), helper.make_node('Relu', ['g1'], ['h1']),
         helper.make_node('Gemm', ['h1', 'W2', 'b2'], ['g2']), helper.make_node('Relu', ['g2'], ['h2']),
         helper.make_node('Gemm', ['h2', 'W3', 'b3'], ['logits'])]
    outs = []
    for name, (a, b, op) in spans.items():
        init += [numpy_helper.from_array(np.array([a], np.int64), f'{name}_start'), numpy_helper.from_array(np.array([b], np.int64), f'{name}_end'), numpy_helper.from_array(np.array([1], np.int64), f'{name}_axis')]
        N.append(helper.make_node('Slice', ['logits', f'{name}_start', f'{name}_end', f'{name}_axis'], [f'{name}_z']))
        N.append(helper.make_node(op, [f'{name}_z'], [name], **({'axis': 1} if op == 'Softmax' else {})))
        outs.append(helper.make_tensor_value_info(name, TensorProto.FLOAT, ['N', b - a]))
    g = helper.make_graph(N, 'leanai_rail_decision', [helper.make_tensor_value_info('features', TensorProto.FLOAT, ['N', 9])], outs, init)
    model = helper.make_model(g, opset_imports=[helper.make_opsetid('', 17)], producer_name='leanai-rail-train')
    model.ir_version = 8
    onnx.checker.check_model(model); onnx.save(model, path)

if __name__ == '__main__':
    P, metrics, n_train = train()
    onnx_path = os.path.join(HERE, 'decision-mlp.onnx'); export_onnx(P, onnx_path)
    # the two notices of the scenario (inputs computed by src/scenarios/rail/features.js) + random probes
    MAIN = [0.4, 1, 1/3, 0.6, 0, 1/3, 1, 0.420086, 1]
    ROUTINE = [0.05, 1, 1, 0.2, 0.3, 0, 0.5, 0, 0]
    probe = np.vstack([np.array([MAIN, ROUTINE], np.float32), sample(6, np.random.default_rng(99))])
    o = ReferenceEvaluator(onnx_path).run(None, {'features': probe})
    _, _, _, z = forward(P, probe); n = heads(z)
    maxdiff = max(float(np.abs(a - b).max()) for a, b in zip(o, n)); assert maxdiff < 1e-5, maxdiff
    params = sum(P[k].size for k in ['W1', 'b1', 'W2', 'b2', 'W3', 'b3'])
    weights = {'features': FEATURES, 'mean': P['mean'].tolist(), 'std': P['std'].tolist(),
               'layers': [{'W': P['W1'].tolist(), 'b': P['b1'].tolist(), 'act': 'relu'}, {'W': P['W2'].tolist(), 'b': P['b2'].tolist(), 'act': 'relu'}, {'W': P['W3'].tolist(), 'b': P['b3'].tolist(), 'act': 'none'}],
               'heads': {'reasoning_required': {'slice': [0, 2], 'act': 'softmax', 'labels': REASON}, 'route': {'slice': [2, 5], 'act': 'softmax', 'labels': ROUTE}, 'domains': {'slice': [5, 9], 'act': 'sigmoid', 'labels': DOMAINS}}}
    json.dump({'inputs': probe.tolist(), 'outputs': {k: v.tolist() for k, v in zip(['reasoning_required', 'route', 'domains'], o)}}, open(os.path.join(HERE, 'golden.json'), 'w'))
    raw = open(onnx_path, 'rb').read()
    card = {'name': 'LeanAI · Industrial Recovery decision model', 'version': '1.0.0', 'architecture': 'MLP 9 → 24 → 24 → 9 (ReLU), three heads', 'parameters': int(params),
            'onnx': {'file': 'decision-mlp.onnx', 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest(), 'opset': 17},
            'inputs': FEATURES, 'outputs': {'reasoning_required': REASON, 'route': ROUTE, 'domains': DOMAINS},
            'training': {'samples': n_train, 'generator': 'synthetic disruptions over plausible ranges, labelled by the planning rules below', 'label_noise': 0.02, 'rules': RULES, 'seed': SEED, 'optimizer': 'Adam, 200 epochs, batch 256'},
            'holdout': metrics, 'onnx_vs_numpy_max_abs_diff': maxdiff,
            'scope': 'Bounded triage of supply disruptions for the fictional NovaRail scenario. Illustrative rules, not a company standard.'}
    json.dump(card, open(os.path.join(HERE, 'model-card.json'), 'w'), indent=2)
    js = os.path.join(HERE, '..', '..', 'src', 'scenarios', 'rail', 'decision-weights.js')
    open(js, 'w').write('// GENERATED by models/rail-system1/train.py — same weights as models/rail-system1/decision-mlp.onnx (parity is tested).\nexport const WEIGHTS = ' + json.dumps(weights, separators=(',', ':')) + ';\nexport const MODEL_CARD = ' + json.dumps(card, separators=(',', ':')) + ';\n')
    print(json.dumps({'params': int(params), 'bytes': len(raw), **metrics, 'maxdiff': maxdiff}, indent=1))
    print('MAIN', [np.round(h[0], 3).tolist() for h in n]); print('ROUTINE', [np.round(h[1], 3).tolist() for h in n])
