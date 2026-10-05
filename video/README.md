# LeanAI — *The Right Intelligence* (film)

A 75-second, 1920×1080, 30 fps cinematic film rendered programmatically with **Remotion + React + TypeScript**.
It argues one idea without voice-over:

> **The right intelligence, for the right problem, at the right moment.**
> A tiny System-1 model wins when the problem is reflex. When the problem becomes contextual and strategic,
> an LLM forming a *macro-policy* wins, and a deterministic executor carries it out. Expensive reasoning is
> escalated only when it creates value.

This folder is **isolated from the LeanAI web application**: its own `package.json`, its own `node_modules`, and no imports from `../src`. The app's `npm test` is unaffected (66/66 pass).

## Commands

```bash
cd video
npm install
npm run video:preview      # Remotion Studio (scrub the timeline, inspect any frame)
npm run video:audio        # regenerate audio/cues.json from the simulation + synthesize public/audio/soundtrack.wav
npm run video:render       # audio (needs python3 + numpy + scipy) → output/leanai-right-intelligence.mp4 (H.264, CRF 16) + poster
npm run video:poster       # output/leanai-right-intelligence-poster.jpg (frame 1680, the 91/7/2 reveal)
npm test                   # determinism + reference-reproduction + planning-trap tests
npm run tune               # verify the reflex parameters against the reference (prints the comparison)
npm run tune:planning      # verify the planning scenario still shows local != global
```

From the repository root, `npm run video:preview` and `npm run video:render` delegate here.

Rendering needs a headless Chromium. `remotion.config.ts` uses `/opt/pw-browsers/.../headless_shell` when present
(override with `REMOTION_BROWSER=/path/to/chrome`), otherwise Remotion downloads its own. A full render takes about 3.5 minutes on 2 cores.

## Outputs

| File | What |
|---|---|
| `output/leanai-right-intelligence.mp4` | Final film, 1920×1080, 30 fps, 75.0 s, H.264 + AAC 48 kHz stereo |
| `output/leanai-right-intelligence-poster.jpg` | Poster / thumbnail (frame 1680) |
| `public/audio/soundtrack.wav` | Synthesized soundtrack, embedded in the MP4 (generated, not committed) |

## Exact timing (`src/data/timeline.ts`)

| # | Scene | Start | End | Frames | Content |
|---|---|---|---|---|---|
| 01 | THE QUESTION | 0:00 | 0:06 | 0–179 | Black → grid → JEV / HAIKU 4.5 / OPUS 5.5 · HIGH → 0.28 s / 0.74 s / 5.99 s → *Is the biggest model always the smartest choice?* |
| 02 | REFLEX | 0:06 | 0:22 | 180–659 | TEST 01. Three live boards; replay ×1 until 0:09.6, accelerates to ×9.7 by 0:13.2. Opus tops out (level 7), Haiku tops out (level 13), Jev reaches level 20. Jev isolated at 0:17.4: **SYSTEM 1 WINS.** |
| 03 | THE PROBLEM CHANGES | 0:22 | 0:27 | 660–809 | Freeze, 0.4 s of silence, pull back. NEXT, HOLD, HORIZON 8, OBJECTIVE, HISTORY appear; board becomes the planning state. |
| 04 | CONTEXT | 0:27 | 0:44 | 810–1319 | TEST 02. Local best move (glow) → clears a line → 8-piece preview → FUTURE TRAP (7 holes, height 9) → rewind → strategy layer (4 rules) → MACRO POLICY GENERATED → executor → 4-line clear → **PLANNING WINS.** → *When context changes, the right model changes.* |
| 05 | THE ARCHITECTURE | 0:44 | 0:58 | 1320–1739 | Complexity router with 6 live telemetry gauges, 100 decisions routed, reveal 91 % / 7 % / 2 %. |
| 06 | HYBRID SYSTEM | 0:58 | 1:07 | 1740–2009 | Four qualitative trajectories; the hybrid overtakes at its escalation points. *Reasoning becomes a resource to allocate.* |
| 07 | FINAL | 1:07 | 1:15 | 2010–2249 | Green point → LEANAI → three lines → *Escalate reasoning only when value justifies it.* → black. |

Beats inside scenes 02, 04 and 05 are in `REFLEX_PLAYBACK`, `PLANNING_BEATS` and `ROUTER_BEATS` in the same file.

## What is measured, what is simulated, what is illustrative

This matters for the film's credibility, so it is stated plainly.

**Reference (supplied by the author, not re-measured here).** The Level-20 benchmark figures in `src/data/reflex.config.ts → REFERENCE`:
Jev 0.28 s / 1 late / 73 lines; Haiku 4.5 0.74 s / 9 late / 16 lines / top-out ≈ level 13; Opus 5.5 high 5.99 s / 11 late / 0 lines / top-out ≈ level 7.

**TEST 01 — a seeded simulation that replays the reference.** `src/simulation/reflex.ts` has one set of rules for all three agents:
- the same 7-bag piece sequence, the same gravity curve and the same placement evaluator (the published El-Tetris linear weights);
- a piece starts falling at spawn; the agent's decision arrives after its latency (mean-preserving log-normal jitter around the reference mean);
- if the piece has already landed, the decision is **too late** and the piece locks where gravity put it (spawn column, guideline 0.5 s lock delay);
- otherwise the agent picks the best placement still reachable from the row the piece has fallen to, so a late but valid decision has fewer options;
- the clock never waits for the agent, and the level rises every `levelSec`.

The free parameters (`seed`, `latencySeed`, `levelSec`, `gravity1`, `gravityGrowth`, `gravityMax`, `jitterSigma`) were selected by search (`scripts/tune-reflex.ts`) so the replay reproduces the reference. Result (`npm run tune`):

| | Lines | Too late | Top-out |
|---|---|---|---|
| Jev — reference | 73 | 1 | none |
| Jev — replay | **73** | **0** | none |
| Haiku — reference | 16 | 9 | ≈ L13 |
| Haiku — replay | 16 | 9 | L13 |
| Opus — reference | 0 | 11 | ≈ L7 |
| Opus — replay | 0 | 11 | L7 |

8 of 9 figures match exactly. **Jev shows 0 late decisions instead of 1.** About 60,000 parameter and seed combinations were tried and none produced exactly one late Jev decision without changing another figure: under these rules a single late Jev piece at level 20 tends to cascade into a top-out. The on-screen counters always show what the replay actually produces; nothing is hard-coded. The decision-latency figures shown are the reference means.

One Opus decision (the first, at level 1 gravity) arrives in time; the other 11 are too late. This falls out of the rules and was left as it is.

The replay runs at ×1 for the first 3.6 s of the scene so latency is visible in real time, then accelerates. The current speed is shown on screen as `REPLAY ×N`.

**TEST 02 — a constructed scenario with a computed outcome.** `src/simulation/planning.ts`. The same board and the same 9-piece sequence are played twice by the same deterministic executor:
- *Local branch*: Jev sees the current piece only (horizon 1, no hold) and plays the evaluator's best placement. Its first move (a J into the right-side well) clears a line immediately, which is genuinely the best move for what it can see.
- *Policy branch*: the executor is constrained by the 4-rule macro-policy (preserve the well, defer the partial clear, reserve the I-piece for the well, protect options), which is formed from the 8-piece horizon.

Seed `15162` was selected (`scripts/tune-planning.ts`) because it shows the difference clearly. Local ends with **7 buried holes, height 9**; policy ends with **0 holes, height 6** after a 4-line clear. Both numbers on screen are computed. The difference comes only from information and planning horizon. The macro-policy rules are written in the config: no LLM is called during rendering. The film shows what such a strategy layer produces, not a live model output.

`LOCAL POLICY CONFIDENCE 72%` is computed: the softmax probability (temperature 1, evaluator units) of Jev's top-ranked placement among all its candidates for the first piece. (The brief suggested 43 %; the film shows the computed value.)

**Illustrative (labelled on screen).**
- Scene 05: the 91 / 7 / 2 routing mix over 100 simulated decisions (`src/data/router.config.ts`). The mix was given in the brief, and each decision's telemetry is generated to be consistent with the routing rule documented in that file. On screen: *ILLUSTRATIVE ROUTING MIX · 100 SIMULATED DECISIONS*.
- Scene 06: the four trajectories are qualitative shapes with no numeric axes. On screen: *QUALITATIVE, ILLUSTRATIVE*. The four benefits are stated qualitatively, without percentages.

## Structure

```
video/
  src/
    index.ts, Root.tsx, LeanAIFilm.tsx      composition (75 s @ 30 fps)
    scenes/Scene01…Scene07                   one component per scene
    components/                              BoardView (SVG board), Background, Type (masked reveals), MiniPiece, Fonts, motion
    simulation/
      core.ts          falling-block engine (pieces, collisions, locks, line clears, 7-bag, RNG)
      planner.ts       shared placement evaluator + reachability from the current row
      reflex.ts        TEST 01 latency-bound control loop
      playback.ts      film-time → sim-time mapping, per-frame lane state
      planning.ts      TEST 02 local vs macro-policy branches
      planPlayback.ts  per-frame planning state
    data/              timeline.ts, theme.ts, reflex.config.ts, planning.config.ts, router.config.ts
  scripts/             tune-reflex.ts, tune-planning.ts, export-cues.ts, stills.mjs (inspection stills)
  audio/               cues.json (generated) + synth.py
  public/              fonts (Inter, JetBrains Mono — SIL OFL) + audio/soundtrack.wav
  test/                simulation.test.ts
```

## Sound

There are no samples and no music licences. `scripts/export-cues.ts` derives 350+ cues from the simulation and the timeline: every lock, clear, late decision and top-out lands on its own frame, along with the router's decisions and the hybrid's escalation points. `audio/synth.py` (numpy/scipy) then synthesizes:

- a restrained sub hit and a soft 120 BPM pulse bed;
- tactile lock clicks panned per lane, muted line-clear impacts, a dissonant tick for late decisions and low thuds for top-outs;
- 0.4 s of true silence when the problem changes, then rising tension during the future trap;
- a resolved chord on the 4-line clear and an understated final hit.

The film works muted; nothing is carried by audio alone. Mix: about −18.5 LUFS integrated, −1 dBFS peak, fading to digital silence at the end.

To use a professionally produced score instead, replace `public/audio/soundtrack.wav` (75.0 s, 48 kHz stereo) and re-render.

## Known limitations

- No real motion blur. `@remotion/motion-blur` would multiply render time by about 5; motion is eased instead.
- The reflex replay runs up to ×9.7, so at cruise speed individual moves are a blur by design; the ×1 opening shows them in real time.
- The original benchmark screenshot was not available while building this. The lane design follows the written description (near-black, three lanes, Jev green / Haiku amber / Opus cyan) and the existing LeanAI film language in `../media`.
