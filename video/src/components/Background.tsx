import { AbsoluteFill } from 'remotion';
import { C } from '../data/theme.ts';

/** Near-black field, thin engineering grid, soft vignette. `grid` 0..1 controls grid visibility. */
export const Background: React.FC<{ grid?: number; drift?: number }> = ({ grid = 1, drift = 0 }) => {
  const minor = 40;
  const major = 200;
  return (
    <AbsoluteFill style={{ backgroundColor: C.bg }}>
      <svg width={1920} height={1080} style={{ position: 'absolute', opacity: grid }}>
        <defs>
          <pattern id="minor" width={minor} height={minor} patternUnits="userSpaceOnUse" x={drift % minor}>
            <path d={`M ${minor} 0 L 0 0 0 ${minor}`} fill="none" stroke={C.grid} strokeWidth={1} />
          </pattern>
          <pattern id="major" width={major} height={major} patternUnits="userSpaceOnUse" x={drift % major}>
            <path d={`M ${major} 0 L 0 0 0 ${major}`} fill="none" stroke={C.gridStrong} strokeWidth={1} />
          </pattern>
          <radialGradient id="vig" cx="50%" cy="48%" r="75%">
            <stop offset="55%" stopColor="#000" stopOpacity={0} />
            <stop offset="100%" stopColor="#000" stopOpacity={0.85} />
          </radialGradient>
        </defs>
        <rect width={1920} height={1080} fill="url(#minor)" opacity={0.6} />
        <rect width={1920} height={1080} fill="url(#major)" />
      </svg>
      <svg width={1920} height={1080} style={{ position: 'absolute' }}>
        <rect width={1920} height={1080} fill="url(#vig)" />
      </svg>
    </AbsoluteFill>
  );
};
