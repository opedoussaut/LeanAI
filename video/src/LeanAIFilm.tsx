import { AbsoluteFill, Audio, Sequence, staticFile } from 'remotion';
import { Fonts } from './components/Fonts.tsx';
import { C } from './data/theme.ts';
import { scene } from './data/timeline.ts';
import { Scene01Question } from './scenes/Scene01Question.tsx';
import { Scene02Reflex } from './scenes/Scene02Reflex.tsx';
import { Scene03Change } from './scenes/Scene03Change.tsx';
import { Scene04Planning } from './scenes/Scene04Planning.tsx';
import { Scene05Router } from './scenes/Scene05Router.tsx';
import { Scene06Hybrid } from './scenes/Scene06Hybrid.tsx';
import { Scene07Final } from './scenes/Scene07Final.tsx';

export const LeanAIFilm: React.FC<{ withAudio: boolean }> = ({ withAudio }) => {
  const seq = (id: Parameters<typeof scene>[0], el: React.ReactNode) => {
    const s = scene(id);
    return (
      <Sequence key={id} from={s.from} durationInFrames={s.dur} name={s.title}>
        {el}
      </Sequence>
    );
  };
  return (
    <AbsoluteFill style={{ backgroundColor: C.bg }}>
      <Fonts />
      {seq('question', <Scene01Question />)}
      {seq('reflex', <Scene02Reflex />)}
      {seq('change', <Scene03Change />)}
      {seq('planning', <Scene04Planning />)}
      {seq('router', <Scene05Router />)}
      {seq('hybrid', <Scene06Hybrid />)}
      {seq('final', <Scene07Final />)}
      {withAudio && <Audio src={staticFile('audio/soundtrack.wav')} />}
    </AbsoluteFill>
  );
};
