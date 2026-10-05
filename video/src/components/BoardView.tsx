import React from 'react';
import { cells, COLS, type Board, type PieceType } from '../simulation/core.ts';
import { C } from '../data/theme.ts';

export type ActivePiece = { type: PieceType; rot: number; row: number; col: number; opacity?: number; color?: string };
export type Ghost = { type: PieceType; rot: number; row: number; col: number; color?: string; opacity?: number; glow?: number };

/**
 * SVG board. Locked cells are drawn in the lane colour with a slight per-piece tonal variation,
 * the active piece is brighter, the ghost is an outline. Rows < 0 are clipped.
 */
export const BoardView: React.FC<{
  board: Board;
  cell: number;
  color: string;
  active?: ActivePiece | null;
  ghosts?: Ghost[];
  flashRows?: number[];
  flash?: number; // 0..1
  dim?: number; // 0..1 overlay darkening
  holes?: Array<[number, number]>; // [row, col] cells to mark as trapped holes
  holeOpacity?: number;
  wellCol?: number | null;
  wellOpacity?: number;
  frameOpacity?: number;
  id: string;
}> = ({ board, cell, color, active, ghosts = [], flashRows = [], flash = 0, dim = 0, holes = [], holeOpacity = 0, wellCol = null, wellOpacity = 0, frameOpacity = 1, id }) => {
  const rows = board.length;
  const w = COLS * cell;
  const h = rows * cell;
  const g = 2; // gap
  const tone = (v: number) => 0.5 + ((v * 37) % 7) * 0.035;
  const rects: React.ReactNode[] = [];
  for (let r = 0; r < rows; r++) {
    const flashing = flashRows.includes(r) && flash > 0;
    for (let c = 0; c < COLS; c++) {
      const v = board[r][c];
      if (!v) continue;
      rects.push(
        <rect key={`${r}-${c}`} x={c * cell + g / 2} y={r * cell + g / 2} width={cell - g} height={cell - g} rx={2}
          fill={flashing ? C.white : color} fillOpacity={flashing ? 0.35 + 0.6 * flash : tone(v)} />,
      );
    }
  }
  const pieceRects = (p: ActivePiece | Ghost, key: string, mode: 'solid' | 'ghost') =>
    cells(p.type, p.rot).map(([dr, dc], i) => {
      const x = (p.col + dc) * cell + g / 2;
      const y = (p.row + dr) * cell + g / 2;
      const col = p.color ?? color;
      return mode === 'solid' ? (
        <rect key={`${key}${i}`} x={x} y={y} width={cell - g} height={cell - g} rx={2} fill={col} fillOpacity={0.95 * (p.opacity ?? 1)} />
      ) : (
        <rect key={`${key}${i}`} x={x + 1} y={y + 1} width={cell - g - 2} height={cell - g - 2} rx={2} fill={col}
          fillOpacity={0.08 * (p.opacity ?? 1) + 0.18 * ((p as Ghost).glow ?? 0)} stroke={col} strokeOpacity={0.75 * (p.opacity ?? 1)} strokeWidth={1.5} />
      );
    });
  return (
    <svg width={w} height={h} style={{ overflow: 'visible', display: 'block' }}>
      <defs>
        <clipPath id={`clip-${id}`}>
          <rect x={0} y={0} width={w} height={h} />
        </clipPath>
        <filter id={`glow-${id}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation={6} />
        </filter>
      </defs>
      {/* frame + inner grid */}
      <rect x={-0.5} y={-0.5} width={w + 1} height={h + 1} fill="rgba(255,255,255,0.012)" stroke={C.line2} strokeOpacity={frameOpacity} />
      {Array.from({ length: COLS - 1 }, (_, i) => (
        <line key={`v${i}`} x1={(i + 1) * cell} x2={(i + 1) * cell} y1={0} y2={h} stroke="rgba(255,255,255,0.028)" />
      ))}
      {Array.from({ length: rows - 1 }, (_, i) => (
        <line key={`h${i}`} x1={0} x2={w} y1={(i + 1) * cell} y2={(i + 1) * cell} stroke="rgba(255,255,255,0.028)" />
      ))}
      {wellCol !== null && wellOpacity > 0 && (
        <rect x={wellCol * cell} y={0} width={cell} height={h} fill={color} fillOpacity={0.05 * wellOpacity} stroke={color} strokeOpacity={0.35 * wellOpacity} strokeDasharray="4 6" />
      )}
      <g clipPath={`url(#clip-${id})`}>
        {rects}
        {ghosts.map((gh, i) => (gh.glow ? <g key={`gg${i}`} filter={`url(#glow-${id})`} opacity={gh.glow * 0.8}>{pieceRects(gh, `gb${i}`, 'solid')}</g> : null))}
        {ghosts.map((gh, i) => <g key={`g${i}`}>{pieceRects(gh, `g${i}`, 'ghost')}</g>)}
        {active && <g>{pieceRects(active, 'a', 'solid')}</g>}
        {holes.map(([r, c], i) => (
          <g key={`hole${i}`} opacity={holeOpacity}>
            <rect x={c * cell + 3} y={r * cell + 3} width={cell - 6} height={cell - 6} rx={2} fill={C.trap} fillOpacity={0.16} stroke={C.trap} strokeWidth={1.5} />
          </g>
        ))}
        {dim > 0 && <rect x={0} y={0} width={w} height={h} fill={C.bg} fillOpacity={dim} />}
      </g>
    </svg>
  );
};

export function findHoles(b: Board): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let c = 0; c < COLS; c++) {
    let seen = false;
    for (let r = 0; r < b.length; r++) {
      if (b[r][c] !== 0) seen = true;
      else if (seen) out.push([r, c]);
    }
  }
  return out;
}
