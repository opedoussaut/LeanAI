# Industrial Recovery film — timing, music cues and optional voiceover

Scene times come from `src/scenarios/rail/film.js` (the soundtrack generator reads the same file). Duration 82 s.

| Time | Scene | On screen | Music energy (shipped soundtrack) |
|---|---|---|---|
| 0–7 s | Commitment | Assembly hall, NR-E trainset rolling through S10–S70, people at stations. *Industrial production runs on commitments.* → *Until something changes.* | Controlled industrial pulse (72 bpm), metallic factory ambience |
| 7–15 s | Disruption | *Critical component · 8 days late*; supplier → inventory → production → delivery; *3 products at risk* | Low hit on the notice; same pulse, darker chord |
| 15–24 s | Reduce | ERP, MES, Inventory, Supplier, Configuration, Planning stream in; counter to 18,407 signals; collapse to 76 evidence items; *>99% less context* · *Reduce before reasoning.* | Accelerating pulse (72 → 112 bpm), riser into the collapse |
| 24–31 s | Decide | *Do we need generative AI?* schedule · inventory · configuration · cost · risk → *Complex cross-domain decision · Agentic reasoning required* · *Decide before invoking AI.* | Riser and hit on the verdict |
| 31–43 s | Reason | Planning, Supply, Manufacturing, Cost + Risk; MCP links to ERP, MES, Inventory, Configuration; A2A links to one decision. *Specialists. Shared evidence. One decision.* Small Gemini · ADK · A2A · MCP labels | Driving momentum (112 bpm) |
| 43–51 s | Recovery | S30 plan reorganises: inventory arrives for TS-48, TS-49 harness-first with slack, late batch line stays; *Recovery plan found* → *Delivery commitment protected* | Riser and resolved hit on "protected" |
| 51–60 s | Business value | 8 days · €420K business exposure · €31K recovery cost · €389K value protected by the proposed recovery · *AI decision cost €0.06* | Opens up: wider chord, slower pulse (84 bpm), bell per value |
| 60–69 s | Twist | Plan freezes; *Configuration conflict*; *Engineering review required*; operations → engineering → validate → operations; *Know when not to decide.* | Break at 60.35 s (no beat for ~4.5 s, deep hit), then controlled tension |
| 69–76 s | Governance | AI proposed → engineering validated → human approved → execute | Steady 96 bpm, ascending bells |
| 76–82 s | End | Hall again, trainset rolls on; *LeanAI* · *Minimum intelligence. Maximum business value.* · REDUCE → DECIDE → REASON → VALIDATE → ACT → ENGINEER | Resolution, final chord, fade |

Figures above are those of the current scenario; the film itself never hard-codes them.

**Replacing the music.** The shipped soundtrack is original (numpy/scipy synthesis, `media/sound-film-rail.py`). To use a
licensed track instead, cut it to the energy curve above and mux with
`ffmpeg -i leanai-industrial-recovery-75s.mp4 -i track.wav -map 0:v -map 1:a -c:v copy -c:a aac -shortest out.mp4`.
The film is understandable without sound.

## Optional voiceover (not recorded)

| Time | Line |
|---|---|
| 0.5 s | Industrial production runs on commitments. |
| 7.5 s | Then one supplier changes the equation. |
| 15.5 s | LeanAI doesn't start by asking a large model. It starts by reducing the problem. |
| 19.5 s | Eighteen thousand signals become only the evidence that matters. |
| 24.5 s | A small decision model determines whether deeper reasoning is even necessary. |
| 31.5 s | When it is, specialists collaborate using grounded enterprise information. |
| 43.5 s | The result isn't an answer. It's a recovery decision. |
| 51.5 s | A delivery commitment protected. Business exposure reduced. At measurable AI cost. |
| 60.5 s | But intelligence also means knowing when not to decide. When operations crosses an engineering boundary, LeanAI stops and escalates. |
| 69.5 s | AI proposes. Engineering validates. Humans decide. |
| 77.5 s | LeanAI. Minimum intelligence. Maximum business value. |
