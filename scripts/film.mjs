// Industrial Recovery film.
//   npm run film:preview   → serves the repository and prints the URL of the film route (plays in real time)
//   npm run film           → renders media/leanai-industrial-recovery-75s.mp4 (1920×1080, 30 fps, original soundtrack)
// Rendering needs Python with Playwright (Chromium), numpy/scipy and ffmpeg. The film reads the same scenario data as
// the page (src/scenarios/rail/facts.js); nothing numeric is typed into the film.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.woff2': 'font/woff2', '.onnx': 'application/octet-stream', '.wasm': 'application/wasm', '.css': 'text/css' };
const PORT = Number(process.env.FILM_PORT ?? 8812);
const server = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^([/\\])+/, '');
  if (path.startsWith('..') || /(^|\/)(\.git|node_modules|\.env)/.test(path)) { res.writeHead(403).end(); return; }
  try { const f = join(ROOT, path); if ((await stat(f)).isFile()) { res.writeHead(200, { 'content-type': TYPES[extname(f)] ?? 'application/octet-stream' }); res.end(await readFile(f)); return; } } catch { /* fall through */ }
  res.writeHead(404).end();
});
await new Promise(r => server.listen(PORT, '127.0.0.1', r));
const url = `http://127.0.0.1:${PORT}/media/film-rail.html`;
if (process.argv.includes('--preview')) {
  console.log(`Film preview: ${url}\n(plays in real time; Ctrl+C to stop)`);
} else {
  const p = spawn('python3', [join(ROOT, 'media', 'render-film-rail.py'), `${url}?render=1`], { stdio: 'inherit' });
  p.on('exit', code => { server.close(); process.exit(code ?? 1); });
}
