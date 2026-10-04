# Industrial Recovery — NovaRail

> **The value is not more AI. The value is a better industrial decision.**

A second LeanAI scenario, in a different industry and on a different AI stack, built on the same decision architecture as
the AI factory case. Open it with the **Industrial recovery** switch in the header (`#recovery`).

*NovaRail is a fictional manufacturer of electric trainsets. Every record is synthetic, every enterprise system is
simulated, and contract terms, rates and prices are illustrative.*

## 1. Business story

A supplier notice arrives on Monday morning: the **batch of 18 traction inverter modules (TIM-3300-B) will arrive 8 days late**.
It is pegged to three trainsets in production — TS-47, TS-48 and TS-49 (configuration C-3, 6 inverters each).

The question is a business question, not an AI question:

> Can NovaRail protect the production commitment without creating unacceptable cost, operational risk or engineering debt?

What the data says (all figures are calculated by `src/scenarios/rail/recovery.js`; none is typed in):

| | |
|---|---|
| Exposure if nothing is done | **€420,086** — late-delivery damages, deferred milestone payments, out-of-sequence rework, idle S30 crew (formulas on the page) |
| Recovery plan | TS-47 continues (kit already at line side) · TS-48 uses existing inventory (4 × TIM-3300-B + 2 × TIM-3300-A) · TS-49 resequences electrical integration and absorbs the delay with schedule slack and one weekend shift |
| Recovery cost | **€31,010** — transfers, resequencing inspection, harness-first rework, an install-on-arrival shift, weekend recovery |
| Residual exposure | **€0** — every delivery date held |
| Value protected by the proposed recovery plan | **€389,076** = exposure − recovery cost − residual |
| AI decision cost | about **€0.06** (simulated provider: estimated tokens × Gemini Flash-tier list price) |

**The engineering twist.** The two TIM-3300-A modules fit physically and are free in stock, but they are validated for
configuration C-2, not C-3. The configuration specialist detects it through the configuration system; deterministic
validation confirms it; the plan freezes in **ENGINEERING REVIEW REQUIRED**. The agents do not look for a workaround and
cannot authorise one. An engineer decides:
- **Validate** the deviation (procedure EDP-TIM-03: load firmware FW-B 4.2, converter self-test at S50 — 3 h, within the 4 h
  spare in the static-test slot, so no extra cost) → value protected stays **€389,076**;
- **Reject** it → operations replans with approved variants only (a partial air shipment): value protected **€304,923**,
  with €54,123 of residual exposure because TS-48 is one day late.

Then a person approves or rejects the plan; execution is simulated.

## 2. LeanAI principles in this case

| Principle | Where it is visible |
|---|---|
| **REDUCE** — process evidence before AI | 18,407 records from nine systems → 76 evidence items, 99.3 % fewer tokens, in tens of milliseconds of ordinary code |
| **DECIDE** — is generative reasoning needed at all? | a 1,065-parameter decision model in the browser routes the inverter notice to agents and a routine notice of the same day (1 day late, covered by stock) to deterministic rules |
| **REASON** — specialists only for genuine complexity | four specialists (supply, production planning, cost + risk, manufacturing/configuration) |
| **GROUND** — authoritative enterprise evidence | every conclusion comes from MCP tools over the evidence and deterministic calculators; the cost specialist's figures are checked against the deterministic economics |
| **MEASURE** — business impact and AI economics | exposure, recovery cost, value protected — then tokens, calls, latency and AI cost per decision |
| **ESCALATE** — know when operations becomes engineering | configuration conflict → engineering review → validate → back to operations |

**REDUCE → DECIDE → REASON → VALIDATE → ACT → ENGINEER**

## 3. Decision architecture

```
Industrial event (supplier notice SN-26-0412)
  → Evidence reduction            src/scenarios/rail/evidence.js        deterministic code
  → Decision model                models/rail-system1 + rail/decision.js  1,065-parameter MLP (ONNX in the browser)
  → Agentic reasoning if required rail/orchestrator.js + rail/agents.js  orchestrator = code; specialists = provider
  → Enterprise tools              rail/tools.js (MCP)                     simulated ERP, MES, inventory, planning, configuration, cost/risk
  → Deterministic validation      rail/recovery.js → validate()           a model cannot override it
  → Business decision             rail/recovery.js → economics()
  → Human approval                rail/governance.js                      explicit states and actors
  → Engineering escalation        rail/governance.js + deviationAssessment()
```

**Governance states:** PROPOSED → AWAITING HUMAN APPROVAL | ENGINEERING REVIEW REQUIRED → ENGINEERING VALIDATED →
AWAITING HUMAN APPROVAL → APPROVED | REJECTED → EXECUTED (SIMULATED). Each transition names the actor allowed to make it;
the tests prove that agents cannot approve, that approval is impossible before validation and engineering sign-off, and that
an engineering rejection returns the plan to operations.

## 4. Technology architecture

| Layer | What it is | Where |
|---|---|---|
| Deterministic code | dataset generator, evidence engine, plan rules, validation, economics, governance | `src/scenarios/rail/*.js` |
| Decision model | MLP 9 → 24 → 24 → 9, trained by planning rules (numpy, seed 11), ONNX 5.4 KB; ONNX Runtime Web (WASM) in the browser, JS evaluator with golden parity in Node | `models/rail-system1/`, `rail/decision.js`, `rail/runtime.js` |
| Provider layer | `runSpecialist({agent, input, callTool}) → {output, usage, latencyMs}`; outputs checked against each specialist's contract | `src/providers/provider.js` |
| Simulated provider | deterministic, tool-grounded replay; tokens estimated (turn-based) and labelled | `src/providers/simulated.js` |
| Gemini via Google ADK | each specialist is an ADK `LlmAgent` with an `MCPToolset`; tokens read from `usageMetadata` | `src/providers/gemini-adk.mjs` |
| A2A (agent ↔ agent) | orchestrator ↔ specialists: `message/send` in simulated mode; ADK `toA2a` servers + the official `@a2a-js/sdk` client in live mode | `src/adapters/a2a.js`, `gemini-adk.mjs` |
| MCP (agent ↔ tool) | six simulated enterprise systems; in-process JSON-RPC in simulated mode, a real Streamable-HTTP MCP server (official SDK) in live mode | `rail/tools.js`, `server/rail-mcp-server.mjs` |
| Prices | Flash-tier list price ($1.50 / $9.00 per M tokens, $1 = €0.92) — **verify against the official pricing page before quoting** | `src/providers/prices.js` |

Models are replaceable; the business architecture is not. A test plugs in a different provider without touching business
logic, and rejects a provider whose output breaks a specialist's contract.

## 5. Demo modes

**SIMULATED (default, and the only mode on GitHub Pages).** No model is called. Each specialist's behaviour is replayed
deterministically through the same MCP tools, so its conclusions are still grounded; token counts are estimates and are
labelled as such. No secrets are needed.

**LIVE (local, with your own key).**
```bash
npm install                       # installs the optional Google stack: @google/adk, @google/genai, @a2a-js/sdk, @modelcontextprotocol/sdk
cp .env.example .env              # never commit it
GEMINI_API_KEY=... npm run start:live   # MCP server :18801, four ADK specialists over A2A :18810–18813, endpoint :18800
npm start                         # then open http://127.0.0.1:3000/?provider=live#recovery
```
Live mode was **not run against Gemini** while building this branch (no key was available). Its plumbing is tested without a
key: the MCP server answers `tools/list` and `tools/call` through the official SDK client, and the four ADK specialists
publish their A2A agent cards. The page shows **LIVE** only when the local endpoint answers. Optional model choice:
`GEMINI_MODEL` (default `gemini-flash-latest`).

## 6. Film

`media/leanai-industrial-recovery-75s.mp4` — 82 s, 1920×1080, 30 fps, original synthesized soundtrack.

| | |
|---|---|
| Preview | `npm run film:preview` → open the printed URL (`/media/film-rail.html`, plays in real time) |
| Render | `npm run film` (Python + Playwright/Chromium, numpy/scipy, ffmpeg; resumable frame cache in `media/.frames-rail/`) |
| Data | the film calls `railStory()` and `filmFacts()` — the same source as the page; tests check that no figure is typed into the film and that changed economics change the film |
| Assets | original canvas drawings (assembly hall, NR-E trainset, data flows, specialists, S30 plan); `FOOTAGE-SLOT` marks where a licensed hall plate could replace the drawn background |
| Timing, audio cues, voiceover | [`docs/film-timing.md`](film-timing.md) |

### Second film — value first, built on Google's agentic stack

`media/leanai-google-agentic-stack-80s.mp4` — 80 s, 1920×1080, 30 fps, original soundtrack (`media/sound-film-google.py`).
Where the first film tells the recovery story, this one shows **why AI runs at all** and **how Google's stack carries it**:

| Time | Scene | What it shows |
|---|---|---|
| 0–7 s | Business case | *Every AI project should start with a business case. Not with a model.* · the supplier notice |
| 7–17 s | Value gate | two notices the same morning: routine (€0 at stake → deterministic rules, no model call) vs inverter batch (€420K → agentic reasoning) |
| 17–22 s | Grounding | 18,407 records → 76 evidence items; Gemini never sees the raw ERP |
| 22–29 s | ADK | the real `LlmAgent` + `MCPToolset` code from `src/providers/gemini-adk.mjs`, and the four `novarail_*` specialists |
| 29–37 s | A2A | the agent cards the specialists publish through ADK `toA2a` (protocol, transport, skills) |
| 37–45 s | MCP | six enterprise systems, ten tools, and a real `tools/call checkConfiguration` answer |
| 45–52 s | Contract | Gemini returns JSON → contract check → deterministic validation → usage measured · *Models are replaceable. The business architecture is not.* |
| 52–62 s | Outcome | €389K protected · AI cost €0.06 · value per € of AI |
| 62–71 s | Twist | configuration conflict caught by an MCP tool → Gemini proposed → engineering → human |
| 71–80 s | End | *Value first. AI where it pays. Engineering always.* |

Render with `npm run film:google` (preview: `npm run film:google:preview`). Figures come from `railStory()` through
`googleFilmFacts()`; the agent cards, MCP tool list, sample call and package versions come from
`evidence/google/stack.json`, recorded from the running ADK agents and MCP server by `node scripts/record-google-stack.mjs`
(no API key needed). The agent run itself is a **deterministic replay** and the film says so; re-record with a Gemini key to
show measured tokens.

## 7. Tests

`test/rail-*.test.mjs`: dataset determinism and size; reduction and retained evidence; decision-model parity, routing
(agentic vs routine) and input sensitivity; MCP tools and invalid requests; economics; validation of infeasible plans;
engineering escalation; governance guards; provider contract and modes; live plumbing (skipped when the optional packages
are not installed); film/app synchronisation and timing (both films); a scan that keeps the repository free of out-of-scope industry and real-manufacturer references; and the
AI factory regression.
