// Visual identity of the film: near-black, three agent colours, thin engineering grid.
export const C = {
  bg: '#040608',
  bg2: '#070a0e',
  grid: 'rgba(150, 180, 210, 0.055)',
  gridStrong: 'rgba(150, 180, 210, 0.10)',
  line: 'rgba(220, 232, 245, 0.10)',
  line2: 'rgba(220, 232, 245, 0.18)',
  text: '#F2F5F8',
  text2: 'rgba(242, 245, 248, 0.62)',
  text3: 'rgba(242, 245, 248, 0.38)',
  glass: 'rgba(255, 255, 255, 0.022)',
  jev: '#43E08E',
  haiku: '#F2A646',
  opus: '#9EDCFF',
  trap: '#FF5F5F',
  white: '#FFFFFF',
};

export const LANE_COLOR = { jev: C.jev, haiku: C.haiku, opus: C.opus } as const;

export const FONT = {
  display: '"InterFilm", "Inter", system-ui, sans-serif',
  mono: '"JetBrainsMonoFilm", ui-monospace, monospace',
};

// Safe area (title-safe ≈ 90% of 1920×1080)
export const SAFE = { x: 96, y: 54, w: 1920 - 192, h: 1080 - 108 };
