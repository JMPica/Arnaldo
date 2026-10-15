#!/usr/bin/env python3
"""Pixel-art source for RUNE SHIFT. Original art, drawn as character maps.

Run:  python3 art/sprites_src.py   -> writes scripts/view/sprite_data.gd

A sprite is a list of rows; each char is a palette key ('.' = transparent).
Rows starting with '|' are HALF rows: they are mirrored to make symmetric art
(e.g. '|..kv' -> '..kvvk..'). Every sprite is validated: same width per row.
"""
import os, sys

PALETTE = {
    'k': '0b0a12',  # outline
    'n': '1b2140',  # night blue
    'N': '2b3563',  # night blue light
    'g': '3a3d4f',  # graphite
    'G': '5a5e74',  # graphite light
    'h': '8a8fa8',  # stone highlight
    'v': '4b2a73',  # dark violet (ancient magic)
    'V': '7e4fc2',  # violet
    'p': 'c9a6ff',  # pale violet glow
    'o': 'ff8a3d',  # fire orange
    'O': 'ffc36b',  # light orange
    'r': 'c8352f',  # red
    'R': 'ff5a4e',  # bright red
    'i': '7fd8ff',  # glacier blue
    'I': 'd6f4ff',  # pale ice
    'y': 'ffe14d',  # electric yellow
    'Y': 'fff6b0',  # pale yellow
    'm': '6fae7a',  # muted green (rewards)
    'M': 'a6d6a0',  # pale green
    'w': 'f4f1ff',  # white
    'b': '6b4a3a',  # brown
    'B': '9a6b4f',  # light brown
    'c': 'd9d2b8',  # bone
    'C': 'a39c86',  # bone shadow
    's': '5f7fa3',  # steel
    'S': '9db7d1',  # steel light
}

def H(*rows):
    """Mirror half rows into full symmetric rows."""
    return ['|' + r for r in rows]

SPRITES = {
    # ---------------------------------------------------------------- hero
    'hero_0': H(
        '....kk',
        '...kvV',
        '..kvVV',
        '..kvkk',
        '..kvyk',
        '..kvkk',
        '.kvvvv',
        'kGkvpV',
        '.kkvvp',
        '..kvvv',
        '..kbkk',
        '..kk..',
    ),
    'hero_1': H(
        '....kk',
        '...kvV',
        '..kvVV',
        '..kvkk',
        '..kvyk',
        '..kvkk',
        '.kvvvv',
        'kGkvpV',
        '.kkvvp',
        '..kvvv',
        '...kbk',
        '...kk.',
    ),
    # ------------------------------------------------------------- enemies
    'crawler_0': H(
        '......',
        '......',
        '...kkk',
        '..kGGG',
        '.kGgGG',
        '.kgRkg',
        'kggggg',
        'kgkgkg',
        '.k.k.k',
        '......',
        '......',
        '......',
    ),
    'crawler_1': H(
        '......',
        '......',
        '......',
        '...kkk',
        '..kGGG',
        '.kGgGG',
        '.kgRkg',
        'kggggg',
        'kgkgkg',
        'k.k.k.',
        '......',
        '......',
    ),
    'archer_0': H(
        '....kk',
        '...kcc',
        '...kck',
        '...kRc',
        '....kk',
        '..kkCc',
        '.kbkck',
        'kb.kCc',
        '.kbkcc',
        '..kkck',
        '...kck',
        '...kk.',
    ),
    'archer_1': H(
        '....kk',
        '...kcc',
        '...kck',
        '...kRc',
        '....kk',
        '..kkCc',
        '.kbkck',
        'kb.kCc',
        '.kbkcc',
        '..kkck',
        '..kck.',
        '..kk..',
    ),
    'charger_0': H(
        'kc....',
        'kck...',
        '.kckkk',
        '..krrr',
        '.krRrr',
        '.krOkr',
        'krrrrr',
        'krbrrr',
        '.kbkbb',
        '.kk.kk',
        '......',
        '......',
    ),
    'charger_1': H(
        'kc....',
        'kck...',
        '.kckkk',
        '..krrr',
        '.krRrr',
        '.krOkr',
        'krrrrr',
        'krbrrr',
        '.kbkbb',
        '..kk.k',
        '......',
        '......',
    ),
    'guardian_0': H(
        '...kkk',
        '..kSSS',
        '.kSsss',
        '.kspkk',
        '.ksssk',
        'kSkkss',
        'kSsSss',
        'kssGss',
        '.ksSss',
        '.kskks',
        '.kGk.k',
        '.kkk..',
    ),
    'guardian_1': H(
        '...kkk',
        '..kSSS',
        '.kSsss',
        '.kspkk',
        '.ksssk',
        'kSkkss',
        'kSsSss',
        'kssGss',
        '.ksSss',
        '.kskks',
        '..kGkk',
        '..kkk.',
    ),
    # ---------------------------------------------------------------- props
    'pillar': [
        'kkkkkkkkkkkk',
        'khhhhhhhhhhk',
        'kGGGGGGGGGGk',
        'kkkkkkkkkkkk',
        '.kGghGGghGk.',
        '.kGghGGghGk.',
        '.kGghVVghGk.',
        '.kGghVVghGk.',
        '.kGghGGghGk.',
        'kkkkkkkkkkkk',
        'kGGGGGGGGGGk',
        'kkkkkkkkkkkk',
    ],
    'portal': H(
        '....kk',
        '..kkVV',
        '.kVVpp',
        '.kVp..',
        'kVp...',
        'kVp...',
        'kVp...',
        'kVp...',
        '.kVp..',
        '.kVVpp',
        '..kkVV',
        '....kk',
    ),
    # ----------------------------------------------------------- rune icons
    'orb': H(
        '.....',
        '...kk',
        '..kVV',
        '.kVpw',
        '.kVpp',
        '.kVVp',
        '..kVV',
        '...kk',
        '.....',
    ),
    'orbit': [
        '....p....',
        '...pVp...',
        '..p...p..',
        '.p.....p.',
        'pV..y..Vp',
        '.p.....p.',
        '..p...p..',
        '...pVp...',
        '....p....',
    ],
    'cone': [
        '.........',
        'kk.......',
        'kVkk.....',
        'kVVVkk...',
        'kpVVVVkk.',
        'kVVVkk...',
        'kVkk.....',
        'kk.......',
        '.........',
    ],
    'fire': H(
        '....k',
        '...ko',
        '...ko',
        '..koo',
        '.koOo',
        '.koOO',
        '.koOY',
        '..koO',
        '...kk',
    ),
    'ice': [
        '....i....',
        '.i..I..i.',
        '..i.I.i..',
        '...iIi...',
        'iIIIwIIIi',
        '...iIi...',
        '..i.I.i..',
        '.i..I..i.',
        '....i....',
    ],
    'storm': [
        '.....kkk.',
        '....kyyk.',
        '...kyyk..',
        '..kyyykk.',
        '.kYyyyyk.',
        '..kkyyk..',
        '...kyk...',
        '..kyk....',
        '..kk.....',
    ],
    'echo': [
        '.........',
        '..ppp....',
        '.p...p...',
        'p.VV..p..',
        'p.VyV.p.p',
        'p.VV..p..',
        '.p...p...',
        '..ppp....',
        '.........',
    ],
    'rupture': [
        '....y....',
        '.y..o..y.',
        '..y.o.o..',
        '...oRo...',
        'yooRwRooy',
        '...oRo...',
        '..o.o.y..',
        '.y..o..y.',
        '....y....',
    ],
    'rebound': [
        '.........',
        'pp.......',
        'pVp...pp.',
        '.pVp.pVp.',
        '..pVpVp..',
        '...pVp...',
        '....p..yy',
        '......yYy',
        '.......y.',
    ],
    'stat_damage': [
        '.......kk',
        '......kSk',
        '.....kSk.',
        '....kSk..',
        'k..kSk...',
        '.kbSk....',
        '..kbk....',
        '.kbkbk...',
        'kk...k...',
    ],
    'stat_rate': H(
        'kkkkk',
        '.kyyy',
        '..kyy',
        '...ky',
        '....k',
        '...ky',
        '..kyy',
        '.kyyy',
        'kkkkk',
    ),
    'stat_speed': [
        '.........',
        '..kkk....',
        '..kBk....',
        '..kBk....',
        '..kBkkk..',
        '.kBBBBBk.',
        '.kBBBBBBk',
        '.kkkkkkkk',
        '.........',
    ],
    'stat_hp': [
        '.........',
        '.kk...kk.',
        'kRRk.kRRk',
        'kRwRkRRRk',
        'kRRRRRRRk',
        '.kRRRRRk.',
        '..kRRRk..',
        '...kRk...',
        '....k....',
    ],
    'stat_element': H(
        '....k',
        '...kp',
        '..kpp',
        '.kpVV',
        '.kpVV',
        'kpVVV',
        'kpVVV',
        '.kpVV',
        '..kkk',
    ),
    'stat_catalyst': [
        '...k.k...',
        '.k.kmk.k.',
        '..kmmmk..',
        'kkmmkmmkk',
        '.kmk.kmk.',
        'kkmmkmmkk',
        '..kmmmk..',
        '.k.kmk.k.',
        '...k.k...',
    ],
    'heal': [
        '.........',
        '.kk...kk.',
        'kmmk.kmmk',
        'kmMmkmmmk',
        'kmmmMmmmk',
        '.kmMMMmk.',
        '..kmMmk..',
        '...kmk...',
        '....k....',
    ],
    'challenge': H(
        '..kkk',
        '.kccc',
        'kcccc',
        'kckkc',
        'kckRk',
        'kcccc',
        '.kcck',
        '..kck',
        '...kk',
    ),
    'fragment': [
        '...k...',
        '..kpk..',
        '.kpVVk.',
        'kpVVVVk',
        '.kVVVk.',
        '..kVk..',
        '...k...',
    ],
}


def expand(rows):
    out = []
    for r in rows:
        if r.startswith('|'):
            half = r[1:]
            out.append(half + half[::-1])
        else:
            out.append(r)
    return out


def main():
    errors = []
    sprites = {}
    for name, rows in SPRITES.items():
        full = expand(rows)
        widths = {len(r) for r in full}
        if len(widths) != 1:
            errors.append(f'{name}: rows have different widths {sorted(widths)}')
        for r in full:
            for ch in r:
                if ch != '.' and ch not in PALETTE:
                    errors.append(f"{name}: unknown palette key '{ch}'")
        sprites[name] = full
    if errors:
        print('\n'.join(errors))
        sys.exit(1)
    root = os.path.join(os.path.dirname(__file__), '..')
    lines = ['class_name SpriteData', 'extends RefCounted',
             '## GENERATED by art/sprites_src.py - edit the source there, not here.', '',
             'const PALETTE := {']
    for k, v in PALETTE.items():
        lines.append(f'\t"{k}": Color("{v}"),')
    lines.append('}')
    lines.append('')
    lines.append('const SPRITES := {')
    for name, rows in sprites.items():
        lines.append(f'\t"{name}": [')
        for r in rows:
            lines.append(f'\t\t"{r}",')
        lines.append('\t],')
    lines.append('}')
    out = os.path.join(root, 'scripts', 'view', 'sprite_data.gd')
    open(out, 'w').write('\n'.join(lines) + '\n')
    print(f'{len(sprites)} sprites -> {os.path.relpath(out, root)}')


if __name__ == '__main__':
    main()
