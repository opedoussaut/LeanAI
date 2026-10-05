// Renders inspection stills: node scripts/stills.mjs <outDir> <frame> [<frame> ...]
import { bundle } from '@remotion/bundler';
import { renderStill, selectComposition } from '@remotion/renderer';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const [outDir, ...frames] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const browser = '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const browserExecutable = existsSync(browser) ? browser : undefined;
const serveUrl = await bundle({ entryPoint: path.resolve('src/index.ts') });
const inputProps = { withAudio: false };
const composition = await selectComposition({ serveUrl, id: 'LeanAIFilm', inputProps, browserExecutable });
for (const f of frames) {
  const output = path.join(outDir, `f${String(f).padStart(4, '0')}.jpg`);
  await renderStill({ composition, serveUrl, output, frame: Number(f), inputProps, imageFormat: 'jpeg', jpegQuality: 85, browserExecutable });
  console.log(output);
}
