// Industrial Recovery — film/app synchronisation, film timing, positioning guard and regression of the AI factory scenario.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { railStory } from '../src/scenarios/rail/facts.js';
import { filmFacts, SCENES, DURATION, googleFilmFacts, GOOGLE_SCENES, GOOGLE_DURATION } from '../src/scenarios/rail/film.js';
import { generateRailDataset } from '../src/scenarios/rail/dataset.js';
import { DemoEngine } from '../src/engine/engine.js';
import { scenario } from '../src/scenarios/ai-factory/scenario.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const kEur = v => `€${Math.round(v / 1000).toLocaleString('en-US')}K`;

test('film: every on-screen figure comes from the same story as the page', async () => {
  const s = await railStory(), f = filmFacts(s);
  assert.equal(f.rawRecords, s.reduce.rawRecords);
  assert.equal(f.evidenceItems, s.reduce.evidenceItems);
  assert.equal(f.delayDays, s.disruption.delayDays);
  assert.deepEqual(f.affected, s.affected.map(a => a.id));
  assert.deepEqual(f.values.map(v => v.big), [`${s.disruption.delayDays} DAYS`, kEur(s.economics.exposure), kEur(s.economics.recoveryCost), kEur(s.economics.valueProtected)]);
  assert.equal(f.aiCost, `AI DECISION COST €${s.ai.costEur.toFixed(2)}`);
  assert.equal(f.verdict, 'AGENTIC REASONING REQUIRED');
  assert.ok(f.conflict && f.conflict.trainset === 'TS-48');
});

test('film: if the scenario economics change, the film shows the new values', async () => {
  const D = generateRailDataset();
  const ct = D.cost.find(r => r.entry === 'CONTRACT' && r.id === 'CT-2207');
  ct.ld_cents_per_trainset_day = 30_000 * 100;
  const base = filmFacts(await railStory()), changed = filmFacts(await railStory({ dataset: D }));
  assert.notEqual(changed.values[1].big, base.values[1].big);
  assert.notEqual(changed.values[3].big, base.values[3].big);
});

test('film: the film source types none of the figures in, and imports the shared story', async () => {
  const html = readFileSync(join(ROOT, 'media/film-rail.html'), 'utf8');
  assert.match(html, /from '\.\.\/src\/scenarios\/rail\/facts\.js'/);
  assert.match(html, /from '\.\.\/src\/scenarios\/rail\/film\.js'/);
  const f = filmFacts(await railStory());
  for (const literal of [...f.values.map(v => v.big), f.rawRecords.toLocaleString('en-US'), String(f.rawRecords), f.evidenceLine, f.delayLine, f.aiCost, f.reductionLine, f.atRisk]) assert.ok(!html.includes(literal), `film hard-codes "${literal}"`);
});

test('film: timing is a 60–90 s storyboard in order, and the renderer targets 1920×1080', () => {
  assert.ok(DURATION >= 60 && DURATION <= 90);
  const t = Object.values(SCENES);
  assert.deepEqual(t, [...t].sort((a, b) => a - b));
  assert.deepEqual(Object.keys(SCENES), ['commitment', 'disruption', 'reduce', 'decide', 'reason', 'recovery', 'value', 'twist', 'governance', 'end']);
  const r = readFileSync(join(ROOT, 'media/render-film-rail.py'), 'utf8');
  assert.match(r, /'width': 1920, 'height': 1080/);
  assert.match(r, /leanai-industrial-recovery-75s\.mp4/);
});

// Second film — value first, built on Google's agentic stack.
const stack = () => JSON.parse(readFileSync(join(ROOT, 'evidence/google/stack.json'), 'utf8'));

test('google film: figures come from the story, the stack from the recorded agent cards and MCP tool list', async () => {
  const s = await railStory(), st = stack(), f = googleFilmFacts(s, st);
  assert.equal(f.main.atStake, kEur(s.economics.exposure));
  assert.equal(f.values.protected, kEur(s.economics.valueProtected));
  assert.equal(f.ai.cost, `€${s.ai.costEur.toFixed(2)}`);
  assert.equal(f.routine.path, 'DIRECT');
  assert.equal(f.main.path, 'AGENTIC');
  assert.ok(s.decide.routine.exposure < s.economics.exposure);
  assert.deepEqual(f.agents.map(a => a.name), ['novarail_supply', 'novarail_planning', 'novarail_cost', 'novarail_configuration']);
  assert.equal(f.tools.length, st.mcp.tools.length);
  assert.ok(f.tools.every(t => t.system), 'every MCP tool names its enterprise system');
  assert.equal(f.sample.structuredContent.status, 'NOT_APPROVED');
  for (const k of ['@google/adk', '@google/genai', '@a2a-js/sdk', '@modelcontextprotocol/sdk']) assert.ok(st.packages[k], k);
});

test('google film: types no figure in, reads the shared story and the real ADK code, says the run is replayed', async () => {
  const html = readFileSync(join(ROOT, 'media/film-google.html'), 'utf8');
  assert.match(html, /from '\.\.\/src\/scenarios\/rail\/facts\.js'/);
  assert.match(html, /evidence\/google\/stack\.json/);
  assert.match(html, /src\/providers\/gemini-adk\.mjs/);
  assert.match(html, /replayed deterministically/);
  const f = googleFilmFacts(await railStory(), stack());
  for (const literal of [f.main.atStake, f.values.protected, f.values.cost, f.ai.cost, f.ground.raw, f.perEuro, f.notice.delay]) assert.ok(!html.includes(literal), `film hard-codes "${literal}"`);
  assert.ok(GOOGLE_DURATION >= 60 && GOOGLE_DURATION <= 90);
  const t = Object.values(GOOGLE_SCENES);
  assert.deepEqual(t, [...t].sort((a, b) => a - b));
  assert.ok(t.at(-1) < GOOGLE_DURATION);
  assert.match(readFileSync(join(ROOT, 'media/render-film-rail.py'), 'utf8'), /leanai-google-agentic-stack-80s\.mp4/);
});

test('positioning: no aerospace or real-manufacturer reference anywhere in the repository', () => {
  const banned = /\b(airbus|boeing|aerospace|aircraft|airlines?|aviation|A220|A320|A350|alstom|siemens mobility|hitachi rail|stadler)\b/i;
  const skip = /^(\.git|node_modules|vendor|dist|\.frames-\w+)$|\.(png|jpg|mp4|onnx|woff2|wav)$/;
  const hits = [];
  const walk = dir => { for (const n of readdirSync(dir)) { if (skip.test(n)) continue; const p = join(dir, n); if (statSync(p).isDirectory()) walk(p); else if (banned.test(readFileSync(p, 'utf8'))) hits.push(p.slice(ROOT.length)); } };
  walk(ROOT);
  assert.deepEqual(hits.filter(h => !h.endsWith('rail-film.test.mjs') && h !== 'package-lock.json'), []);
});

test('regression: the AI factory scenario still runs to its recommendation', async () => {
  const e = new DemoEngine(scenario);
  await e.runInstant();
  assert.equal(e.run.status, 'completed');
  assert.ok(e.run.recommendation?.decision);
});
