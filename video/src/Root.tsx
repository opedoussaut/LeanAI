import { Composition, Still } from 'remotion';
import { Thumbnail } from './scenes/Thumbnail.tsx';
import { LeanAIFilm } from './LeanAIFilm.tsx';
import { FPS, HEIGHT, TOTAL_FRAMES, WIDTH } from './data/timeline.ts';

export const Root: React.FC = () => (
  <>
  <Composition id="LeanAIFilm" component={LeanAIFilm} durationInFrames={TOTAL_FRAMES} fps={FPS} width={WIDTH} height={HEIGHT}
    defaultProps={{ withAudio: true }} />
  <Still id="Thumbnail" component={Thumbnail} width={WIDTH} height={HEIGHT} />
  </>
);
