# Renders the Industrial Recovery film frame by frame (Playwright → ffmpeg), synthesises the soundtrack and muxes both.
# Called by `npm run film` (which serves the repository); can also be run directly with the film URL as argument.
# Resumable: frames are written as JPEG files first, so an interrupted render continues where it stopped.
import asyncio, os, subprocess, sys, glob
from playwright.async_api import async_playwright
FPS = 30
HERE = os.path.dirname(os.path.abspath(__file__))
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8812/media/film-rail.html?render=1'
FRAMES = os.path.join(HERE, '.frames-rail')
OUT = os.path.join(HERE, 'leanai-industrial-recovery-75s.mp4')

async def frames():
    os.makedirs(FRAMES, exist_ok=True)
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={'width': 1920, 'height': 1080})
        await pg.goto(URL); await pg.wait_for_function('window.ready', timeout=120000)
        n = int(await pg.evaluate('window.DURATION') * FPS)
        canvas = pg.locator('canvas')
        for i in range(n):
            f = os.path.join(FRAMES, f'{i:05d}.jpg')
            if os.path.exists(f) and os.path.getsize(f) > 0: continue
            await pg.evaluate(f'render({i / FPS})')
            await canvas.screenshot(path=f, type='jpeg', quality=94)
            if i % 150 == 0: print('frame', i, '/', n, flush=True)
        await b.close()
    return n

if __name__ == '__main__':
    n = asyncio.run(frames())
    assert len(glob.glob(os.path.join(FRAMES, '*.jpg'))) >= n, 'missing frames'
    silent = os.path.join(HERE, 'silent-rail.mp4'); wav = os.path.join(HERE, 'sound-film-rail.wav')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', str(FPS), '-i', os.path.join(FRAMES, '%05d.jpg'), '-frames:v', str(n),
                    '-vf', 'scale=1920:1080', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'slow', '-movflags', '+faststart', silent], check=True)
    subprocess.run(['python3', os.path.join(HERE, 'sound-film-rail.py'), wav], check=True)
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', silent, '-i', wav, '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', OUT], check=True)
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-ss', '79', '-i', OUT, '-frames:v', '1', '-q:v', '3', OUT.replace('.mp4', '.jpg')], check=True)
    os.remove(silent); os.remove(wav)
    for f in glob.glob(os.path.join(FRAMES, '*.jpg')): os.remove(f)
    os.rmdir(FRAMES)
    print('done', OUT)
