import { cells, type PieceType } from '../simulation/core.ts';

/** Small centred piece glyph for NEXT / HOLD panels. */
export const MiniPiece: React.FC<{ type: PieceType; cell?: number; color: string; opacity?: number; box?: number }> = ({
  type, cell = 14, color, opacity = 1, box = 4,
}) => {
  const cs = cells(type, 0);
  const maxC = Math.max(...cs.map((x) => x[1]));
  const minC = Math.min(...cs.map((x) => x[1]));
  const maxR = Math.max(...cs.map((x) => x[0]));
  const w = (maxC - minC + 1) * cell;
  const h = (maxR + 1) * cell;
  const W = box * cell;
  const H = box * cell * 0.6;
  return (
    <svg width={W} height={H} style={{ display: 'block' }}>
      <g transform={`translate(${(W - w) / 2 - minC * cell}, ${(H - h) / 2})`} opacity={opacity}>
        {cs.map(([r, c], i) => (
          <rect key={i} x={c * cell + 1} y={r * cell + 1} width={cell - 2} height={cell - 2} rx={1.5} fill={color} fillOpacity={0.85} />
        ))}
      </g>
    </svg>
  );
};
