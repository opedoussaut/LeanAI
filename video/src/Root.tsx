import { Composition } from 'remotion';
import { LeanAIFilm } from './LeanAIFilm.tsx';
import { FPS, HEIGHT, TOTAL_FRAMES, WIDTH } from './data/timeline.ts';

export const Root: React.FC = () => (
  <Composition id="LeanAIFilm" component={LeanAIFilm} durationInFrames={TOTAL_FRAMES} fps={FPS} width={WIDTH} height={HEIGHT}
    defaultProps={{ withAudio: true }} />
);
