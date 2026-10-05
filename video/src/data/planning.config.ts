// TEST 02 — PLANNING scenario. Seed selected with `npm run tune:planning` (see README).
export const PLANNING = {
  seed: 15162,
  horizon: 8, // look-ahead pieces available to the reasoning layer
  strategy: ['PRESERVE RIGHT-SIDE WELL', 'DEFER IMMEDIATE CLEAR', 'RESERVE I-PIECE', 'PROTECT FUTURE OPTIONS'],
  objective: ['MAXIMIZE SURVIVAL', 'PRESERVE FUTURE OPTIONS'],
};
