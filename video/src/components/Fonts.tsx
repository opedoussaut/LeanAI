import { useEffect, useState } from 'react';
import { continueRender, delayRender, staticFile } from 'remotion';

const FACES: Array<[string, string, number]> = [
  ['InterFilm', 'inter-latin-200-normal.woff2', 200],
  ['InterFilm', 'inter-latin-300-normal.woff2', 300],
  ['InterFilm', 'inter-latin-400-normal.woff2', 400],
  ['InterFilm', 'inter-latin-600-normal.woff2', 600],
  ['InterFilm', 'inter-latin-700-normal.woff2', 700],
  ['JetBrainsMonoFilm', 'jetbrains-mono-latin-400-normal.woff2', 400],
  ['JetBrainsMonoFilm', 'jetbrains-mono-latin-500-normal.woff2', 500],
];

let loaded: Promise<void> | null = null;
function loadAll(): Promise<void> {
  if (!loaded) {
    loaded = Promise.all(
      FACES.map(async ([family, file, weight]) => {
        const face = new FontFace(family, `url(${staticFile(`fonts/${file}`)}) format('woff2')`, { weight: String(weight) });
        await face.load();
        document.fonts.add(face);
      }),
    ).then(() => undefined);
  }
  return loaded;
}

export const Fonts: React.FC = () => {
  const [handle] = useState(() => delayRender('fonts'));
  useEffect(() => {
    loadAll().then(() => continueRender(handle)).catch((e) => {
      console.error(e);
      continueRender(handle);
    });
  }, [handle]);
  return null;
};
