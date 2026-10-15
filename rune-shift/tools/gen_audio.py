#!/usr/bin/env python3
"""Synthesises RUNE SHIFT's original audio: retro SFX and three chiptune loops.
Standard library only, deterministic. Usage: python3 tools/gen_audio.py
Music is written as WAV and then converted to Ogg Vorbis with ffmpeg (see README)."""
import math, os, random, struct, wave

SR = 22050
OUT = os.path.join(os.path.dirname(__file__), "..", "assets", "audio")
rng = random.Random(77)


def write(name, s, gain=0.8):
    peak = max(1e-6, max(abs(x) for x in s))
    k = gain / peak
    with wave.open(os.path.join(OUT, name + ".wav"), "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(b"".join(struct.pack("<h", int(max(-1, min(1, x * k)) * 32767)) for x in s))


def env(t, a, d):
    return t / a if t < a else math.exp(-(t - a) / d)


def osc(kind, ph):
    x = ph % 1.0
    if kind == "sq":
        return 1.0 if x < 0.5 else -1.0
    if kind == "sq25":
        return 1.0 if x < 0.25 else -1.0
    if kind == "tri":
        return 4 * abs(x - 0.5) - 1
    if kind == "saw":
        return 2 * x - 1
    return math.sin(2 * math.pi * x)


def tone(f0, f1, dur, kind="sq", a=0.002, d=0.08, vib=0.0):
    n = int(SR * dur); out = []; ph = 0.0
    for i in range(n):
        t = i / SR
        f = f0 + (f1 - f0) * t / dur + vib * math.sin(2 * math.pi * 9 * t)
        ph += f / SR
        out.append(osc(kind, ph) * env(t, a, d))
    return out


def noise(dur, d=0.05, lp=0.5):
    n = int(SR * dur); y = 0.0; out = []
    for i in range(n):
        y += lp * (rng.uniform(-1, 1) - y)
        out.append(y * env(i / SR, 0.001, d))
    return out


def mix(*ts):
    n = max(len(t) for t in ts)
    return [sum(t[i] for t in ts if i < len(t)) for i in range(n)]


def sfx():
    write("click", tone(900, 1200, 0.05, "sq", d=0.02), 0.4)
    write("cast_orb", tone(700, 1100, 0.09, "sq25", d=0.04), 0.35)
    write("cast_cone", mix(noise(0.12, 0.05, 0.6), tone(300, 160, 0.12, "saw", d=0.05)), 0.45)
    write("orbit_hit", tone(1400, 900, 0.05, "tri", d=0.02), 0.3)
    write("hit", mix(noise(0.06, 0.02, 0.8), tone(220, 120, 0.06, "sq", d=0.02)), 0.4)
    write("kill", mix(noise(0.18, 0.06, 0.4), tone(400, 80, 0.18, "sq", d=0.07)), 0.5)
    write("player_hit", mix(tone(320, 90, 0.25, "saw", d=0.1), noise(0.15, 0.05, 0.5)), 0.6)
    write("block", tone(1800, 1600, 0.08, "tri", d=0.03), 0.4)
    write("explosion", mix(noise(0.45, 0.15, 0.3), tone(120, 40, 0.4, "sq", d=0.15)), 0.7)
    write("discharge", mix([osc("sq", i * 0.07) * env(i / SR, 0.001, 0.08) * (1 if rng.random() > 0.3 else -1) for i in range(int(SR * 0.25))],
                          tone(1600, 400, 0.25, "saw", d=0.08)), 0.5)
    write("spawn", tone(200, 600, 0.3, "tri", a=0.15, d=0.1, vib=20), 0.35)
    write("pick", mix(tone(660, 660, 0.08, "sq", d=0.05), [0] * int(SR * 0.07) + tone(990, 990, 0.12, "sq", d=0.08)), 0.45)
    room = []
    for f in [523, 659, 784]:
        room += tone(f, f, 0.09, "sq25", d=0.07)
    write("room_clear", room, 0.45)
    write("boss_roar", mix(tone(90, 55, 1.0, "saw", a=0.05, d=0.4, vib=6), noise(0.8, 0.3, 0.15)), 0.75)
    vic = []
    for f in [523, 659, 784, 1046, 784, 1046]:
        vic += tone(f, f, 0.14, "sq", d=0.12)
    write("victory", vic, 0.5)
    dft = []
    for f in [392, 330, 262, 196]:
        dft += tone(f, f * 0.98, 0.22, "tri", d=0.2, vib=4)
    write("defeat", dft, 0.5)


NOTE = {n: i for i, n in enumerate(["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"])}


def hz(name):
    n, octv = name[:-1], int(name[-1])
    return 440.0 * 2 ** ((NOTE[n] + 12 * (octv + 1) - 69) / 12)


def track(bpm, bars, chords, lead_fn, bass_kind="tri", lead_kind="sq25", drums=True, dark=0.0):
    """A looping chiptune bar sequence. chords: list of (root, minor) per bar."""
    beat = 60.0 / bpm
    bar_len = int(SR * beat * 4)
    total = bar_len * bars
    out = [0.0] * total
    for b in range(bars):
        root, minor = chords[b % len(chords)]
        r = hz(root)
        third = r * (2 ** ((3 if minor else 4) / 12))
        fifth = r * 1.5
        start = b * bar_len
        # Bass: eighth notes.
        for e in range(8):
            f = (r / 2) if e % 2 == 0 else (fifth / 2)
            seg = tone(f, f, beat / 2, bass_kind, d=beat * 0.4)
            for i, x in enumerate(seg):
                out[start + int(e * bar_len / 8) + i] += 0.35 * x
        # Arpeggio: sixteenths.
        arp = [r, third, fifth, r * 2]
        for s16 in range(16):
            f = arp[s16 % 4] * (0.5 if dark > 0 and s16 % 8 >= 4 else 1.0)
            seg = tone(f, f, beat / 4, "sq25", d=beat * 0.12)
            for i, x in enumerate(seg):
                p = start + int(s16 * bar_len / 16) + i
                if p < total:
                    out[p] += 0.10 * x
        # Lead.
        for (pos, length, f) in lead_fn(b, r, third, fifth):
            seg = tone(f, f, beat * length, lead_kind, a=0.01, d=beat * length * 0.8, vib=3)
            for i, x in enumerate(seg):
                p = start + int(pos * beat * SR) + i
                if p < total:
                    out[p] += 0.16 * x
        if drums:
            for q in range(4):
                p0 = start + int(q * bar_len / 4)
                kick = tone(120, 40, 0.12, "sine", d=0.05)
                for i, x in enumerate(kick):
                    if p0 + i < total:
                        out[p0 + i] += 0.5 * x if q % 2 == 0 else 0.0
                hat = noise(0.04, 0.01, 0.9)
                for half in (0, 1):
                    ph = p0 + int(half * bar_len / 8)
                    for i, x in enumerate(hat):
                        if ph + i < total:
                            out[ph + i] += 0.12 * x
                if q % 2 == 1:
                    sn = noise(0.12, 0.05, 0.6)
                    for i, x in enumerate(sn):
                        if p0 + i < total:
                            out[p0 + i] += 0.3 * x
    return out


def music():
    menu = track(84, 8, [("A3", True), ("F3", False), ("C4", False), ("G3", False)],
                 lambda b, r, t, f: [(0, 1.5, r * 2), (2, 1, t * 2), (3, 1, f)] if b % 2 == 0 else [(0, 2, f * 2), (2.5, 1.5, t * 2)],
                 drums=False)
    write("music_menu", menu, 0.6)
    combat = track(132, 8, [("D3", True), ("D3", True), ("A#2", False), ("C3", False)],
                   lambda b, r, t, f: [(0, 0.5, r * 2), (0.5, 0.5, t * 2), (1, 1, f * 2), (2.5, 0.5, t * 2), (3, 1, r * 2)])
    write("music_combat", combat, 0.6)
    boss = track(148, 8, [("E3", True), ("C3", False), ("D3", False), ("B2", True)],
                 lambda b, r, t, f: [(0, 1, r * 2), (1, 0.5, f * 2), (1.5, 0.5, t * 2), (2, 2, r * 4 if b % 2 else f * 2)],
                 lead_kind="saw", dark=1.0)
    write("music_boss", boss, 0.6)


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    sfx()
    music()
    print("audio written to", os.path.abspath(OUT))
