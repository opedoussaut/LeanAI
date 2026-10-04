# Original synthesized soundtrack for the second film, "Value first — built on Google's agentic stack" (no third-party music).
# Lighter and more digital than the first film: a quiet question (business case) → a decisive hit at the value gate →
# a clean plucked arpeggio that builds through ADK, A2A and MCP → a lift on the business outcome → a hush at the
# configuration conflict → resolution on "Value first".
# Scene times are read from GOOGLE_SCENES in src/scenarios/rail/film.js so the music stays aligned with the picture.
# Usage: python3 media/sound-film-google.py out.wav
import re, sys, os, wave, numpy as np
from scipy.signal import lfilter
HERE = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(HERE, '..', 'src', 'scenarios', 'rail', 'film.js')).read()
D = float(re.search(r'GOOGLE_DURATION = ([0-9.]+)', src).group(1))
SC = {k: float(v) for k, v in re.findall(r'(\w+): ([0-9.]+)', re.search(r'GOOGLE_SCENES = \{([^}]*)\}', src).group(1))}
SR = 48000; N = int(SR * D); t = np.arange(N) / SR
rng = np.random.default_rng(29); noise = rng.standard_normal(N)
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
        for det in (-.15, .15): s += np.sin(2 * np.pi * (f + det * (k + 1)) * tt + k) * (.045 if k else .07)
    add(max(0, a - .5), lp(s, 2600) * env(n, .9, 1.0) * g)
# harmony: D major colour, Bm for the conflict
Dmaj = [73.4, 146.8, 220, 293.7, 370]; G = [98, 196, 293.7, 392, 493.9]; A = [110, 220, 329.6, 440, 554.4]; Bm = [61.7, 123.5, 185, 246.9, 293.7]
pad(0, SC['gate'], [73.4, 146.8, 220, 329.6], .7)
pad(SC['gate'], SC['ground'], Dmaj, .85)
pad(SC['ground'], SC['a2a'], G, .9)
pad(SC['a2a'], SC['contract'], A, .9)
pad(SC['contract'], SC['outcome'], Dmaj, .95)
pad(SC['outcome'], SC['twist'], G + [587.3], 1.1)
pad(SC['twist'], SC['end'], Bm, .75)
pad(SC['end'], D, Dmaj + [440], 1.05)
def chord_at(x):
    for k, ch in (('end', Dmaj), ('twist', Bm), ('outcome', G), ('contract', Dmaj), ('a2a', A), ('ground', G), ('gate', Dmaj)):
        if x >= SC[k]: return ch
    return Dmaj
def pluck(tc, f, g=.04, pan=0.0, dec=7.0):
    n = int(.6 * SR); tt = np.arange(n) / SR
    s = (np.sin(2 * np.pi * f * tt) + .4 * np.sin(2 * np.pi * 2 * f * tt) + .15 * np.sin(2 * np.pi * 3 * f * tt)) * np.exp(-tt * dec)
    add(tc, s * np.minimum(1, tt * 400) * g, pan)
def kick(tc, g): n = int(.35 * SR); tt = np.arange(n) / SR; f = 48 + 70 * np.exp(-tt * 30); add(tc, np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 9) * g)
def tick(tc, g, pan=0): n = int(.03 * SR); i0 = int(tc * SR) % (N - n); add(tc, hp(noise[i0:i0 + n], 6000) * np.exp(-np.linspace(0, 9, n)) * g, pan)
# arpeggio: sparse in the opening, sixteenths from ADK to the outcome, silent at the conflict, slow at the end
BPM = 104; step = 60 / BPM / 4; x = 0.6; i = 0
while x < D - 3:
    if SC['twist'] <= x < SC['twist'] + 4: x += step; i += 1; continue
    ch = chord_at(x); notes = [ch[2], ch[3], ch[4], ch[3] * 2 if ch[3] * 2 < 1200 else ch[3]]
    if x < SC['gate']: dense = i % 8 == 0
    elif x < SC['adk']: dense = i % 4 == 0
    elif x < SC['outcome']: dense = True
    elif x < SC['twist']: dense = i % 2 == 0
    elif x < SC['end']: dense = i % 4 == 0
    else: dense = i % 8 == 0
    if dense:
        lift = 1 + .5 * (SC['adk'] <= x < SC['outcome']) * min(1, (x - SC['adk']) / (SC['contract'] - SC['adk']))
        pluck(x, notes[i % 4], .028 * lift, .45 * np.sin(i * .7))
    if SC['gate'] <= x < SC['twist'] and i % 4 == 0: kick(x, .2 if x >= SC['adk'] else .14)
    if SC['adk'] <= x < SC['twist'] and i % 4 == 2: tick(x, .025, .3)
    x += step; i += 1
# accents
def riser(t_end, dur=1.5, g=.06): n = int(dur * SR); i0 = int((t_end - dur) * SR); add(t_end - dur, hp(noise[i0:i0 + n], 1200) * np.linspace(0, 1, n) ** 2.2 * g)
def hit(tc, f=49, g=.3): n = int(2.4 * SR); tt = np.arange(n) / SR; add(tc, (np.sin(2 * np.pi * f * tt) + .3 * lp(noise[:n], 900) * np.exp(-tt * 18)) * np.exp(-tt * 2.6) * g)
def bell(tc, f, g=.05, dec=2.0, pan=0): n = int(3 * SR); tt = np.arange(n) / SR; add(tc, (np.sin(2 * np.pi * f * tt) + .3 * np.sin(2 * np.pi * f * 2.01 * tt)) * np.exp(-tt * dec) * g, pan)
bell(1.0, 587.3, .035); bell(3.6, 440, .03)
riser(SC['gate'] + 3.2); hit(SC['gate'] + 3.2, 36.7, .32); bell(SC['gate'] + 3.3, 740, .04)
bell(SC['ground'] + 2.2, 880, .04)
for k, f in (('adk', 587.3), ('a2a', 659.3), ('mcp', 740), ('contract', 880)): bell(SC[k] + .3, f, .04, 2.4)
riser(SC['outcome'] + 1.2); hit(SC['outcome'] + 1.2, 49, .3)
for j, f in enumerate((587.3, 740, 880, 1174.7)): bell(SC['outcome'] + 1.3 + j * .14, f, .035, 1.6)
hit(SC['twist'] + .3, 30.9, .4); bell(SC['twist'] + .35, 246.9, .05, 1.2)
for j, f in enumerate((370, 440, 587.3, 740)): bell(SC['twist'] + 5 + j * .9, f, .04)
riser(SC['end'] + .9); hit(SC['end'] + .9, 36.7, .28)
for j, f in enumerate((293.7, 440, 587.3, 740)): bell(SC['end'] + 1.0 + j * .12, f, .04, 1.1)
air = lp(lp(noise, 450), 450) * .03 * np.clip(t / 3, 0, 1); L += air; R += np.roll(air, 1709)
fade = np.clip((D - t) / 3, 0, 1) * np.clip(t / .6, 0, 1); L *= fade; R *= fade
m = max(np.abs(L).max(), np.abs(R).max()); L, R = L / m * .8, R / m * .8
out = (np.stack([L, R], 1) * 32767).astype(np.int16)
with wave.open(sys.argv[1], 'wb') as w: w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(out.tobytes())
print('wrote', sys.argv[1], 'duration', D)
