# Soundtrack for the square social film: pulsing synth pad, a soft four-on-the-floor from the question onwards,
# risers into each reveal and a resolved ending. Deterministic (seeded). Usage: python3 sound-linkedin-square.py out.wav
import sys, wave, numpy as np
from scipy.signal import lfilter
SR, D = 48000, 65.0; N = int(SR * D); t = np.arange(N) / SR
SC = dict(hook=0, ask=5, lean=11, decide=18, reason=24, cost=31, next=36, mbse=41.5, verdict=50.5, human=55.5, end=59.5)
BPM = 100; BEAT = 60 / BPM
rng = np.random.default_rng(41); noise = rng.standard_normal(N)
def lp(x, fc): a = np.exp(-2 * np.pi * fc / SR); return lfilter([1 - a], [1, -a], x)
def hp(x, fc): return x - lp(x, fc)
L = np.zeros(N); R = np.zeros(N)
def add(tc, s, pan=0.0):
    i0 = int(tc * SR); n = min(len(s), N - i0)
    if n > 0 and i0 >= 0: L[i0:i0 + n] += s[:n] * (1 - pan) ** .5; R[i0:i0 + n] += s[:n] * (1 + pan) ** .5
def env(n, a, r): e = np.ones(n); ka, kr = max(1, int(a * SR)), max(1, int(r * SR)); e[:ka] = np.linspace(0, 1, ka); e[-kr:] *= np.linspace(1, 0, kr); return e
# pad: chord per chapter (D minor → Bb → F → C → D major at the end)
chords = [(0, SC['ask'], [73.4, 146.8, 220, 293.7, 349.2]), (SC['ask'], SC['decide'], [58.3, 116.5, 174.6, 233.1, 293.7]),
          (SC['decide'], SC['next'], [87.3, 174.6, 261.6, 349.2, 440]), (SC['next'], SC['verdict'], [65.4, 130.8, 196, 261.6, 329.6]),
          (SC['verdict'], SC['end'], [58.3, 116.5, 174.6, 233.1, 349.2]), (SC['end'], D, [73.4, 146.8, 220, 293.7, 370])]
for a, b, fs in chords:
    n = int((b - a + 1.2) * SR); tt = np.arange(n) / SR; s = np.zeros(n)
    for k, f in enumerate(fs):
        for det in (-.15, .15): s += np.sin(2 * np.pi * (f + det * (k + 1)) * tt + k) * (.05 if k else .09)
    gate = .75 + .25 * np.sin(2 * np.pi * (BPM / 60 / 2) * tt) ** 2   # gentle rhythmic pumping
    add(max(0, a - .6), lp(s, 2500) * gate * env(n, 1.0, 1.2) * .9)
# beat: kick on every beat, hat on off-beats, from the question to the human line; breakdown in the MBSE chapter
def kick(tc, g=.32): n = int(.35 * SR); tt = np.arange(n) / SR; f = 46 + 70 * np.exp(-tt * 28); add(tc, np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 9) * g)
def hat(tc, g=.035, pan=.25): n = int(.05 * SR); i0 = int(tc * SR) % (N - n); add(tc, hp(noise[i0:i0 + n], 6000) * np.exp(-np.linspace(0, 9, n)) * g, pan)
b = SC['ask']
while b < SC['human']:
    soft = .45 if SC['mbse'] <= b < SC['mbse'] + 4 else 1.0
    kick(b, .3 * soft); hat(b + BEAT / 2, .03 * soft, .3 * np.sin(b))
    b += BEAT
# risers and hits on the reveals
def riser(t_end, dur=1.4, g=.08):
    n = int(dur * SR); i0 = int((t_end - dur) * SR); tt = np.linspace(0, 1, n)
    s = hp(noise[i0:i0 + n], 800) * tt ** 2.2 * g; add(t_end - dur, s, 0)
def hit(tc, f=55, g=.35): n = int(2.2 * SR); tt = np.arange(n) / SR; add(tc, (np.sin(2 * np.pi * f * tt) + .4 * lp(noise[:n], 900) * np.exp(-tt * 18)) * np.exp(-tt * 2.6) * g)
def bell(tc, f, g=.05, dec=2.2, pan=0): n = int(3 * SR); tt = np.arange(n) / SR; add(tc, (np.sin(2 * np.pi * f * tt) + .3 * np.sin(2 * np.pi * f * 2.01 * tt)) * np.exp(-tt * dec) * g, pan)
for tc in (SC['hook'] + 2.8, SC['ask'] + 3.5, SC['lean'] + 4.0, SC['reason'] + 2.6, SC['cost'] + 2.5, SC['next'] + 3.5, SC['verdict'] + .4, SC['end']):
    riser(tc); hit(tc, 49 if tc != SC['end'] else 36.7, .3)
bell(SC['hook'] + 2.8, 587.3); bell(SC['lean'] + 4.0, 880, .04); bell(SC['decide'] + 1.3, 698.5, .035, pan=-.3); bell(SC['decide'] + 2.0, 784, .035, pan=.3)
bell(SC['reason'] + 2.6, 880, .045); bell(SC['verdict'] + 1.1, 987.8, .04)
for i, f in enumerate((440, 554.4, 659.3)): bell(SC['human'] + .2 + i * .8, f, .045)
for i, f in enumerate((293.7, 440, 587.3, 740)): bell(SC['end'] + .1 + i * .12, f, .04, 1.4)
air = lp(lp(noise, 600), 600) * .04 * np.clip(t / 3, 0, 1); L += air; R += np.roll(air, 1201)
fade = np.clip((D - t) / 2.5, 0, 1) * np.clip(t / .5, 0, 1); L *= fade; R *= fade
m = max(np.abs(L).max(), np.abs(R).max()); L, R = L / m * .8, R / m * .8
out = (np.stack([L, R], 1) * 32767).astype(np.int16)
with wave.open(sys.argv[1], 'wb') as w: w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(out.tobytes())
print('wrote', sys.argv[1])
