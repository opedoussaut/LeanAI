// Exact scene structure of the film (30 fps, 1920×1080). Every scene reads its frames from here.
export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;

const s = (sec: number) => Math.round(sec * FPS);

export const SCENES = [
  { id: 'question', title: '01 — THE QUESTION', from: s(0), dur: s(6) },
  { id: 'reflex', title: '02 — REFLEX', from: s(6), dur: s(16) },
  { id: 'change', title: '03 — BUT THE PROBLEM CHANGES', from: s(22), dur: s(5) },
  { id: 'planning', title: '04 — CONTEXT', from: s(27), dur: s(17) },
  { id: 'router', title: '05 — THIS IS THE ARCHITECTURE', from: s(44), dur: s(14) },
  { id: 'hybrid', title: '06 — HYBRID SYSTEM', from: s(58), dur: s(9) },
  { id: 'final', title: '07 — FINAL', from: s(67), dur: s(8) },
] as const;

export type SceneId = (typeof SCENES)[number]['id'];
export const scene = (id: SceneId) => SCENES.find((x) => x.id === id)!;
export const TOTAL_FRAMES = SCENES[SCENES.length - 1].from + SCENES[SCENES.length - 1].dur; // 2250 = 75 s

// Scene 02 — reflex playback window (scene-local seconds) and replay speed profile
export const REFLEX_PLAYBACK = {
  startSec: 1.0, // simulation clock starts
  endSec: 15.4, // simulation reaches the end of level 20
  realtimeUntilSec: 3.6, // ×1 replay: latency is visible in real time
  rampUntilSec: 7.2, // then accelerates to the cruise speed (solved so the run ends at endSec)
  isolateSec: 11.4, // Haiku / Opus recede, Jev is isolated
};

// Scene 04 — planning beats (scene-local seconds)
export const PLANNING_BEATS = {
  candidate: 2.4,
  localDrop: 3.6,
  futureStart: 4.6,
  futureStep: 0.34,
  rewind: 7.9,
  expand: 8.4,
  strategyStart: 9.1,
  strategyStep: 0.62,
  collapse: 11.9,
  executeStart: 12.3,
  executeStep: 0.28,
  verdict: 15.2,
  context: 15.95,
};

// Scene 06 — points (0..1 of mission time) where the hybrid escalates to reasoning
export const HYBRID_ESCALATIONS = [0.36, 0.6, 0.82];

// Scene 05 — router
export const ROUTER_BEATS = { flowStart: 1.4, flowEnd: 9.6, reveal: 10.0, message: 11.6 };
