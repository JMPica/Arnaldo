#!/usr/bin/env python3
"""Synthesises the game's original sound effects (no samples, no licences needed).

Usage: python3 tools/gen_audio.py  -> writes assets/audio/*.wav (22.05 kHz, mono, 16-bit)
Deterministic: the same script always produces the same files.
"""
import math, os, random, struct, wave

SR = 22050
OUT = os.path.join(os.path.dirname(__file__), "..", "assets", "audio")
rng = random.Random(1234)


def env(t, attack, decay):
    if t < attack:
        return t / attack
    return math.exp(-(t - attack) / decay)


def write(name, samples, gain=0.8):
    peak = max(1e-6, max(abs(s) for s in samples))
    k = gain / peak
    with wave.open(os.path.join(OUT, name + ".wav"), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(b"".join(struct.pack("<h", int(max(-1, min(1, s * k)) * 32767)) for s in samples))


def lowpass(xs, a):
    y, out = 0.0, []
    for x in xs:
        y += a * (x - y)
        out.append(y)
    return out


def noise(n):
    return [rng.uniform(-1, 1) for _ in range(n)]


def tone(freqs, dur, attack=0.002, decay=0.1, shape="sine"):
    n = int(SR * dur)
    out = []
    for i in range(n):
        t = i / SR
        v = 0.0
        for f, amp in freqs:
            ph = 2 * math.pi * f * t
            v += amp * (math.sin(ph) if shape == "sine" else (1 if math.sin(ph) > 0 else -1) * 0.6 + 0.4 * math.sin(ph))
        out.append(v * env(t, attack, decay))
    return out


def mix(*tracks):
    n = max(len(t) for t in tracks)
    return [sum(t[i] for t in tracks if i < len(t)) for i in range(n)]


def sweep(f0, f1, dur, decay, vibrato=0.0):
    n = int(SR * dur)
    out, ph = [], 0.0
    for i in range(n):
        t = i / SR
        f = f0 + (f1 - f0) * (t / dur) + vibrato * math.sin(2 * math.pi * 14 * t)
        ph += 2 * math.pi * f / SR
        out.append(math.sin(ph) * env(t, 0.004, decay))
    return out


def main():
    os.makedirs(OUT, exist_ok=True)
    write("click", tone([(1300, 1.0), (2600, 0.3)], 0.06, 0.001, 0.015), 0.5)
    write("thud", mix(tone([(85, 1.0), (130, 0.4)], 0.18, 0.002, 0.05),
                      [x * env(i / SR, 0.001, 0.02) * 0.6 for i, x in enumerate(lowpass(noise(int(SR * 0.1)), 0.15))]), 0.7)
    write("land", mix(tone([(70, 1.0)], 0.14, 0.003, 0.04),
                      [x * env(i / SR, 0.001, 0.03) for i, x in enumerate(lowpass(noise(int(SR * 0.12)), 0.2))]), 0.5)
    write("hit_glass", mix(tone([(2480, 0.8), (3710, 0.6), (5150, 0.4), (6300, 0.2)], 0.45, 0.001, 0.12),
                           [x * env(i / SR, 0.0005, 0.01) for i, x in enumerate(noise(int(SR * 0.05)))]), 0.7)
    write("hit_piano", mix(tone([(110, 1.0), (138.6, 0.8), (164.8, 0.7), (220, 0.5), (311, 0.3)], 0.7, 0.002, 0.2),
                           [x * env(i / SR, 0.001, 0.03) for i, x in enumerate(lowpass(noise(int(SR * 0.1)), 0.3))]), 0.8)
    write("hit_cake", [x * env(i / SR, 0.002, 0.05) for i, x in enumerate(
        lowpass([n * math.sin(2 * math.pi * (300 - 1200 * i / SR) * i / SR) for i, n in enumerate(noise(int(SR * 0.2)))], 0.25))], 0.7)
    pings = [tone([(rng.uniform(2500, 7000), 1.0)], 0.3, 0.001, 0.05) for _ in range(9)]
    shatter = [x * env(i / SR, 0.001, 0.12) for i, x in enumerate(noise(int(SR * 0.8)))]
    for k, p in enumerate(pings):
        off = int(SR * rng.uniform(0.0, 0.35))
        for i, v in enumerate(p):
            if off + i < len(shatter):
                shatter[off + i] += v * 0.5
    write("shatter", shatter, 0.8)
    write("crash_piano", mix(tone([(55, 1.0), (82.4, 0.8), (116.5, 0.7), (155.6, 0.6), (233, 0.4), (369, 0.3)], 1.4, 0.002, 0.45),
                             [x * env(i / SR, 0.001, 0.15) for i, x in enumerate(lowpass(noise(int(SR * 0.6)), 0.25))]), 0.9)
    write("splat", [x * env(i / SR, 0.003, 0.12) for i, x in enumerate(lowpass(noise(int(SR * 0.45)), 0.08))], 0.8)
    write("bonk", sweep(520, 180, 0.3, 0.12, vibrato=40), 0.6)
    notes = [523.25, 659.25, 783.99, 1046.5]
    succ = []
    for k, f in enumerate(notes):
        seg = tone([(f, 1.0), (f * 2, 0.25)], 0.5 if k == 3 else 0.12, 0.004, 0.25 if k == 3 else 0.08, "square")
        succ.extend(seg[: int(SR * 0.11)] if k < 3 else seg)
    write("success", succ, 0.55)
    fail = []
    for f in [392, 349.2, 311.1]:
        fail.extend(sweep(f, f * 0.97, 0.22, 0.2, vibrato=6))
    fail.extend(sweep(277, 240, 0.6, 0.3, vibrato=9))
    write("fail", fail, 0.55)
    write("start", [x * (i / (SR * 0.3)) * env(i / SR, 0.25, 0.05) for i, x in enumerate(lowpass(noise(int(SR * 0.35)), 0.3))], 0.4)
    # Seamless jetpack loop: low rumble + band-limited hiss, crossfaded at the seam.
    n = SR
    base = [0.6 * x for x in lowpass(noise(n + 2000), 0.12)]
    hiss = [0.25 * x for x in lowpass(noise(n + 2000), 0.5)]
    rumble = [0.3 * math.sin(2 * math.pi * 55 * i / SR) for i in range(n + 2000)]
    raw = [base[i] + hiss[i] + rumble[i] for i in range(n + 2000)]
    fade = 2000
    loop = raw[:n]
    for i in range(fade):
        a = i / fade
        loop[i] = raw[n + i] * (1 - a) + raw[i] * a
    write("jet_loop", loop, 0.5)


if __name__ == "__main__":
    main()
    print("audio written to", os.path.abspath(OUT))
