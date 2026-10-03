# Original synthesized soundtrack for the Industrial Recovery film (no third-party music).
# Energy follows the storyboard: controlled industrial pulse → acceleration (reduce, decide) → momentum (specialists,
# recovery) → open (business value) → a break at the configuration conflict → controlled tension → resolution.
# Scene times are read from src/scenarios/rail/film.js so the music stays aligned with the picture.
# Usage: python3 media/sound-film-rail.py out.wav
import re, sys, os, wave, numpy as np
from scipy.signal import lfilter
HERE = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(HERE, '..', 'src', 'scenarios', 'rail', 'film.js')).read()
D = float(re.search(r'DURATION = ([0-9.]+)', src).group(1))
SC = {k: float(v) for k, v in re.findall(r'(\w+): ([0-9.]+)', re.search(r'SCENES = \{([^}]*)\}', src).group(1))}
SR = 48000; N = int(SR * D); t = np.arange(N) / SR
rng = np.random.default_rng(73); noise = rng.standard_normal(N)
def lp(x, fc): a = np.exp(-2 * np.pi * fc / SR); return lfilter([1 - a], [1, -a], x)
def hp(x, fc): return x - lp(x, fc)
L = np.zeros(N); R = np.zeros(N)
def add(tc, s, pan=0.0):
    i0 = int(tc * SR); n = min(len(s), N - i0)
    if n > 0 and i0 >= 0: L[i0:i0 + n] += s[:n] * (1 - pan) ** .5; R[i0:i0 + n] += s[:n] * (1 + pan) ** .5
def env(n, a, r): e = np.ones(n); ka, kr = max(1, int(a * SR)), max(1, int(r * SR)); e[:ka] = np.linspace(0, 1, ka); e[-kr:] *= np.linspace(1, 0, kr); return e
def pad(a, b, freqs, g=1.0):
    n = int((b - a + 1.0) * SR); tt = np.arange(n) / SR; s = np.zeros(n)
    for k, f in enumerate(freqs):
        for det in (-.18, .18): s += np.sin(2 * np.pi * (f + det * (k + 1)) * tt + k) * (.05 if k else .085)
    add(max(0, a - .5), lp(s, 2200) * env(n, .8, 1.0) * g)
# harmony per chapter
pad(0, SC['disruption'], [65.4, 130.8, 196, 261.6, 329.6], .8)
pad(SC['disruption'], SC['reduce'], [61.7, 123.5, 185, 246.9, 293.7], .9)
pad(SC['reduce'], SC['reason'], [73.4, 146.8, 220, 293.7, 349.2], .9)
pad(SC['reason'], SC['value'], [87.3, 174.6, 261.6, 349.2, 440], 1.0)
pad(SC['value'], SC['twist'], [65.4, 130.8, 196, 261.6, 392, 523.3], 1.15)
pad(SC['twist'], SC['governance'], [58.3, 116.5, 174.6, 207.7, 277.2], .75)
pad(SC['governance'], D, [65.4, 130.8, 196, 261.6, 329.6, 392], 1.05)
# rhythm: industrial pulse (slow), accelerating through reduce/decide, driving in reason/recovery, silent at the break
def kick(tc, g): n = int(.4 * SR); tt = np.arange(n) / SR; f = 44 + 60 * np.exp(-tt * 26); add(tc, np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 8) * g)
def tick(tc, g, pan=0): n = int(.04 * SR); i0 = int(tc * SR) % (N - n); add(tc, hp(noise[i0:i0 + n], 5000) * np.exp(-np.linspace(0, 9, n)) * g, pan)
def metal(tc, g=.05): n = int(1.2 * SR); tt = np.arange(n) / SR; s = sum(np.sin(2 * np.pi * f * tt) * np.exp(-tt * (3 + i)) for i, f in enumerate([311, 467, 701, 1033])); add(tc, s * g)
x = 1.0
while x < D - 4:
    if SC['twist'] <= x < SC['twist'] + 4.5: x += .5; continue                     # the break
    bpm = 72 if x < SC['reduce'] else 72 + 40 * min(1, (x - SC['reduce']) / (SC['reason'] - SC['reduce'])) if x < SC['reason'] else 112 if x < SC['value'] else 84 if x < SC['twist'] else 96
    beat = 60 / bpm
    g = .22 if x < SC['reduce'] else .28 if x < SC['value'] else .18
    kick(x, g); tick(x + beat / 2, .03 if x >= SC['reduce'] else .015, .3 * np.sin(x))
    x += beat
for k in range(0, int(SC['disruption']), 2): metal(1 + k, .03)                        # factory ambience in the opening
# risers and hits on the payoffs
def riser(t_end, dur=1.6, g=.07): n = int(dur * SR); i0 = int((t_end - dur) * SR); add(t_end - dur, hp(noise[i0:i0 + n], 900) * np.linspace(0, 1, n) ** 2.2 * g)
def hit(tc, f=49, g=.3): n = int(2.4 * SR); tt = np.arange(n) / SR; add(tc, (np.sin(2 * np.pi * f * tt) + .35 * lp(noise[:n], 800) * np.exp(-tt * 16)) * np.exp(-tt * 2.4) * g)
def bell(tc, f, g=.05, dec=2.0, pan=0): n = int(3 * SR); tt = np.arange(n) / SR; add(tc, (np.sin(2 * np.pi * f * tt) + .3 * np.sin(2 * np.pi * f * 2.01 * tt)) * np.exp(-tt * dec) * g, pan)
hit(SC['disruption'] + .5, 41, .34); bell(SC['disruption'] + .5, 466.2, .04)
riser(SC['reduce'] + 5.6); hit(SC['reduce'] + 5.6, 49, .26); bell(SC['reduce'] + 5.8, 880, .04)
riser(SC['decide'] + 4.6); hit(SC['decide'] + 4.6, 55, .25); bell(SC['decide'] + 4.8, 698.5, .045)
bell(SC['reason'] + 6.4, 784, .045)
riser(SC['recovery'] + 5.8); hit(SC['recovery'] + 5.8, 49, .3); bell(SC['recovery'] + 6, 1046.5, .04)
for i, f in enumerate((523.3, 659.3, 784, 1046.5)): bell(SC['value'] + .6 + i * 1.3, f, .045, 1.6)
hit(SC['twist'] + .35, 36.7, .42); bell(SC['twist'] + .4, 277.2, .05, 1.2)                 # the break
for i, f in enumerate((392, 523.3, 659.3, 784)): bell(SC['governance'] + .4 + i * 1.1, f, .045)
riser(SC['end'] + 1.4); hit(SC['end'] + 1.4, 41, .3)
for i, f in enumerate((261.6, 392, 523.3, 659.3)): bell(SC['end'] + 1.5 + i * .12, f, .04, 1.2)
air = lp(lp(noise, 500), 500) * .035 * np.clip(t / 3, 0, 1); L += air; R += np.roll(air, 1301)
fade = np.clip((D - t) / 3, 0, 1) * np.clip(t / .6, 0, 1); L *= fade; R *= fade
m = max(np.abs(L).max(), np.abs(R).max()); L, R = L / m * .8, R / m * .8
out = (np.stack([L, R], 1) * 32767).astype(np.int16)
with wave.open(sys.argv[1], 'wb') as w: w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(out.tobytes())
print('wrote', sys.argv[1], 'duration', D)
