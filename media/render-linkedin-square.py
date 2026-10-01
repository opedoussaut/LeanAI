# Renders scene-linkedin-square.html frame by frame (Playwright + ffmpeg), synthesises the soundtrack, muxes both.
#   cd media && python3 render-linkedin-square.py  →  LeanAI-linkedin-square-65s.mp4 (+ .jpg poster)
import asyncio, os, subprocess
from playwright.async_api import async_playwright
FPS = 30
HERE = os.path.dirname(os.path.abspath(__file__))
SCENE, SILENT = os.path.join(HERE, 'scene-linkedin-square.html'), os.path.join(HERE, 'silent-linkedin-square.mp4')
OUT = os.path.join(HERE, 'LeanAI-linkedin-square-65s.mp4')
async def frames():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--allow-file-access-from-files'])
        pg = await b.new_page(viewport={'width': 1080, 'height': 1080})
        await pg.goto('http://127.0.0.1:8811/media/scene-linkedin-square.html'); await pg.wait_for_function('window.ready', timeout=120000)
        n = int(await pg.evaluate('window.DURATION') * FPS)
        ff = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', str(FPS), '-c:v', 'mjpeg', '-i', '-',
                               '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '17', '-preset', 'slow', '-movflags', '+faststart', SILENT], stdin=subprocess.PIPE)
        for i in range(n):
            await pg.evaluate(f'render({i / FPS})')
            ff.stdin.write(await pg.screenshot(type='jpeg', quality=95))
            if i % 150 == 0: print('frame', i, '/', n, flush=True)
        ff.stdin.close(); ff.wait(); await b.close()
if __name__ == '__main__':
    asyncio.run(frames())
    wav = os.path.join(HERE, 'sound-linkedin-square.wav')
    subprocess.run(['python3', os.path.join(HERE, 'sound-linkedin-square.py'), wav], check=True)
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', SILENT, '-i', wav, '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', OUT], check=True)
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-ss', '62', '-i', OUT, '-frames:v', '1', '-q:v', '3', OUT.replace('.mp4', '.jpg')], check=True)
    os.remove(SILENT); os.remove(wav); print('done', OUT)
