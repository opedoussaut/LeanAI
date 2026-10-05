#!/usr/bin/env python3
"""Synthesises the LeanAI film soundtrack from audio/cues.json (numpy + scipy only).

Every sound is generated here: no samples, no third-party music, no licences to clear.
Character: restrained sub bass, soft electronic pulse, tiny tactile clicks, muted impacts,
rising tension during the trap, a resolved chord when the macro-policy succeeds, an
understated final hit.

    node --experimental-strip-types scripts/export-cues.ts   # writes audio/cues.json
    python3 audio/synth.py                                    # writes public/audio/soundtrack.wav
"""
import json
import os

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt

SR = 48000
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
rng = np.random.default_rng(20261005)


def t_axis(dur):
    return np.arange(int(dur * SR)) / SR


def env_exp(dur, decay, attack=0.002):
    t = t_axis(dur)
    a = np.clip(t / max(attack, 1e-4), 0, 1)
    return a * np.exp(-t / decay)


def env_adsr(dur, a, r):
    t = t_axis(dur)
    up = np.clip(t / max(a, 1e-4), 0, 1)
    down = np.clip((dur - t) / max(r, 1e-4), 0, 1)
    return np.minimum(up, down) ** 1.5


def lp(x, f, order=2):
    return sosfilt(butter(order, f, 'low', fs=SR, output='sos'), x)


def hp(x, f, order=2):
    return sosfilt(butter(order, f, 'high', fs=SR, output='sos'), x)


def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], 'band', fs=SR, output='sos'), x)


def sine(freq, dur, phase=0.0):
    t = t_axis(dur)
    if callable(freq):
        f = freq(t)
        return np.sin(2 * np.pi * np.cumsum(f) / SR + phase)
    return np.sin(2 * np.pi * freq * t + phase)


def fit(x, dur):
    n = int(dur * SR)
    out = np.zeros(n)
    m = min(n, len(x))
    out[:m] = x[:m]
    return out


def noise(dur):
    return rng.standard_normal(int(dur * SR))


# ------------------------------------------------------------------ voices (mono)
def v_sub(c):
    d = 2.2
    s = sine(lambda t: 38 + 34 * np.exp(-t / 0.09), d) * env_exp(d, 0.6, 0.004)
    s += 0.25 * lp(noise(d), 300) * env_exp(d, 0.05)
    return 0.9 * s


def v_tick(c):
    d = 0.06
    p = c.get('pitch', 1.0)
    s = bp(noise(d), 2600 * p, 5200 * p) * env_exp(d, 0.006, 0.0005)
    s += 0.3 * sine(1800 * p, d) * env_exp(d, 0.01)
    return 0.35 * s


def v_counter(c):
    out = np.zeros(int(0.7 * SR))
    for k in range(9):
        tk = v_tick({'pitch': 1.2 + k * 0.05}) * (0.5 + 0.06 * k)
        i = int(k * 0.07 * SR)
        out[i:i + len(tk)] += tk[: len(out) - i]
    return out


def v_lock(c):
    d = 0.12
    s = sine(lambda t: 150 + 90 * np.exp(-t / 0.01), d) * env_exp(d, 0.028, 0.0008)
    s += 0.35 * bp(noise(d), 1500, 4000) * env_exp(d, 0.004, 0.0003)
    return 0.42 * s


def v_ghostlock(c):
    return 0.5 * lp(v_lock(c), 1200)


def v_clear(c):
    d = 0.4
    s = lp(noise(d), 900) * env_exp(d, 0.06, 0.002)
    s += 0.6 * sine(lambda t: 95 + 40 * np.exp(-t / 0.03), d) * env_exp(d, 0.12)
    s += 0.12 * sine(880, d) * env_exp(d, 0.08)
    return 0.45 * s


def v_late(c):
    d = 0.32
    s = sine(lambda t: np.where(t < 0.12, 311.0, 233.0), d) * env_exp(d, 0.09, 0.003)
    return 0.22 * lp(s, 2000)


def v_topout(c):
    d = 1.6
    s = sine(lambda t: 52 + 20 * np.exp(-t / 0.2), d) * env_exp(d, 0.5, 0.005)
    s += 0.5 * lp(noise(d), 220) * env_exp(d, 0.25, 0.01)
    return 0.7 * s


def pad(freqs, d, a=0.8, r=1.2, bright=1800):
    t = t_axis(d)
    s = np.zeros(len(t))
    for i, f in enumerate(freqs):
        for det in (-0.12, 0.0, 0.13):
            s += np.sin(2 * np.pi * (f * (1 + det / 100)) * t + i)
    s = lp(s / (3 * len(freqs)), bright)
    return s * env_adsr(d, a, r)


def v_swell(c):
    d = c.get('dur', 2.0)
    return 0.5 * pad([55, 82.4, 110, 164.8], d, a=d * 0.5, r=d * 0.45, bright=900)


def v_resolve(c):
    d = c.get('dur', 3.0)
    return 0.55 * pad([110, 164.8, 220, 277.2, 329.6], d, a=0.4, r=2.2, bright=2400)


def v_chord(c):
    d = c.get('dur', 2.0)
    return 0.5 * pad([146.8, 220, 293.7, 370], d, a=0.15, r=1.6, bright=3000)


def v_success(c):
    d = c.get('dur', 2.5)
    s = 0.6 * pad([110, 164.8, 220, 277.2, 329.6, 440], d, a=0.05, r=2.0, bright=4200)
    cl = v_clear({})
    s[: len(cl)] += 0.5 * cl
    return s


def v_pad(c):
    d = c.get('dur', 8)
    return 0.42 * pad([55, 110, 164.8, 246.9], d, a=1.5, r=2.5, bright=1200)


def v_tension(c):
    d = c.get('dur', 3.0)
    t = t_axis(d)
    rise = (t / d) ** 1.6
    s = np.zeros(len(t))
    for f0 in (110, 116.5, 164.8):
        s += np.sin(2 * np.pi * np.cumsum(f0 * (1 + 0.12 * rise)) / SR)
    s = s / 3 * (0.3 + 0.7 * rise)
    n = bp(noise(d), 600, 2400) * 0.15 * rise
    return 0.5 * lp(s + n, 1600) * env_adsr(d, 0.3, 0.25)


def v_trap(c):
    d = 1.4
    s = sine(lambda t: 69 + 0 * t, d) + 0.6 * sine(73.4, d) + 0.3 * sine(103.8, d)
    s = lp(s, 700) * env_exp(d, 0.45, 0.003)
    s += 0.35 * lp(noise(d), 400) * env_exp(d, 0.08)
    return 0.55 * s


def v_glow(c):
    d = 1.2
    return 0.18 * (sine(659.3, d) + 0.5 * sine(987.8, d)) * env_adsr(d, 0.25, 0.8)


def v_whoosh(c):
    d = c.get('dur', 1.5)
    t = t_axis(d)
    n = noise(d)
    lo = bp(n, 200, 900)
    hi = bp(n, 900, 3500)
    mix = np.clip(t / d, 0, 1)
    s = lo * (1 - mix) + hi * mix * 0.6
    return 0.22 * s * env_adsr(d, d * 0.55, d * 0.4)


def v_rewind(c):
    d = c.get('dur', 0.5)
    t = t_axis(d)
    s = sine(lambda t: 900 * np.exp(-t / 0.18) + 120, d) * env_adsr(d, 0.03, 0.3)
    return 0.12 * s + 0.08 * hp(noise(d), 3000) * env_adsr(d, 0.05, 0.4)


def v_shimmer(c):
    d = c.get('dur', 1.6)
    out = np.zeros(int(d * SR))
    notes = [880, 1108.7, 1318.5, 1760, 1318.5, 1108.7, 1480, 1760]
    for k, f in enumerate(notes):
        dd = 0.5
        tone = sine(f, dd) * env_exp(dd, 0.16, 0.004) * 0.12
        i = int(k * d / len(notes) * SR)
        out[i:i + len(tone)] += tone[: len(out) - i]
    return out


def v_hit(c):
    d = 2.4
    s = 0.7 * fit(v_sub({}), d)
    s += 0.5 * lp(noise(d), 1200) * env_exp(d, 0.05, 0.002)
    s += 0.25 * pad([220, 329.6, 440], d, a=0.01, r=2.0, bright=3000)
    return 0.7 * s


def v_blip(c):
    p = c.get('pitch', 1.0)
    d = 0.08
    return 0.25 * sine(880 * p, d) * env_exp(d, 0.015, 0.001)


def v_deliberate(c):
    d = c.get('dur', 1.1) + 0.3
    s = 0.22 * (sine(196, d) + 0.6 * sine(293.7, d) + 0.3 * sine(392, d))
    s *= env_adsr(d, 0.15, 0.3) * (0.75 + 0.25 * np.sin(2 * np.pi * 6 * t_axis(d)))
    return lp(s, 2200)


def v_ping(c):
    d = 1.0
    return 0.22 * (sine(1318.5, d) + 0.4 * sine(1975.5, d)) * env_exp(d, 0.3, 0.002)


def v_final(c):
    d = c.get('dur', 3.6)
    s = fit(v_sub({}), d)
    s += 0.55 * pad([55, 110, 164.8, 220, 277.2, 329.6], d, a=0.02, r=3.0, bright=2600)
    s += 0.12 * (sine(1318.5, d) + 0.5 * sine(1760, d)) * env_exp(d, 1.2, 0.01)
    return 0.8 * s


def pulse_bed(c):
    d = c.get('dur', 10)
    out = np.zeros(int(d * SR))
    beat = 0.5
    k = 0
    while k * beat < d:
        b = sine(lambda t: 58 + 25 * np.exp(-t / 0.02), 0.4) * env_exp(0.4, 0.11, 0.003)
        if k % 2 == 1:
            b = b * 0.6
        i = int(k * beat * SR)
        out[i:i + len(b)] += b[: len(out) - i]
        k += 1
    hat = np.zeros_like(out)
    k = 0
    while k * beat / 2 < d:
        h = hp(noise(0.03), 7000) * env_exp(0.03, 0.006)
        i = int((k * beat / 2 + beat / 4) * SR)
        if i < len(hat):
            hat[i:i + len(h)] += h[: len(hat) - i] * 0.05
        k += 1
    return 0.5 * (out + hat) * env_adsr(d, 0.8, 0.8)


VOICES = {
    'sub': v_sub, 'tick': v_tick, 'counter': v_counter, 'lock': v_lock, 'ghostlock': v_ghostlock, 'clear': v_clear,
    'late': v_late, 'topout': v_topout, 'swell': v_swell, 'resolve': v_resolve, 'chord': v_chord, 'success': v_success,
    'pad': v_pad, 'tension': v_tension, 'trap': v_trap, 'glow': v_glow, 'whoosh': v_whoosh, 'rewind': v_rewind,
    'shimmer': v_shimmer, 'hit': v_hit, 'blip': v_blip, 'deliberate': v_deliberate, 'ping': v_ping, 'final': v_final,
    'pulse_bed': pulse_bed,
}


def main():
    cues = json.load(open(os.path.join(HERE, 'cues.json')))
    dur = cues['duration']
    n = int(dur * SR)
    L = np.zeros(n)
    R = np.zeros(n)
    duck = np.ones(n)
    for c in cues['cues']:
        if c['type'] == 'silence':
            i0 = int(c['t'] * SR)
            i1 = int((c['t'] + c['dur']) * SR)
            duck[max(0, i0 - int(0.03 * SR)):i1] = 0.0
            continue
        v = VOICES[c['type']](c) * c.get('gain', 1.0)
        i = int(c['t'] * SR)
        if i >= n:
            continue
        v = v[: n - i]
        pan = c.get('pan', 0.0)
        gl = np.cos((pan + 1) * np.pi / 4)
        gr = np.sin((pan + 1) * np.pi / 4)
        L[i:i + len(v)] += v * gl * 1.414
        R[i:i + len(v)] += v * gr * 1.414
    # silence: hard duck with short release
    rel = int(0.12 * SR)
    d = duck.copy()
    for k in range(1, n):
        if d[k] > d[k - 1]:
            d[k] = min(1.0, d[k - 1] + 1.0 / rel)
    L *= d
    R *= d
    mix = np.stack([L, R], axis=1)
    mix = hp(mix.T, 25).T  # remove DC / infrasonic
    peak = np.max(np.abs(mix))
    mix = np.tanh(mix / peak * 1.25) / np.tanh(1.25)  # gentle saturation / limiting
    mix *= 10 ** (-1.0 / 20)  # -1 dBFS peak
    # fade the last 0.6 s to true silence: the film ends on black
    f = int(0.6 * SR)
    mix[-f:] *= np.linspace(1, 0, f)[:, None] ** 2
    out = os.path.join(ROOT, 'public', 'audio', 'soundtrack.wav')
    os.makedirs(os.path.dirname(out), exist_ok=True)
    wavfile.write(out, SR, (mix * 32767).astype(np.int16))
    rms = np.sqrt(np.mean(mix ** 2))
    print(f'wrote {out}  {dur:.1f}s  rms {20 * np.log10(rms):.1f} dBFS')


if __name__ == '__main__':
    main()
