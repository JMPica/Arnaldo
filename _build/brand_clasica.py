# -*- coding: utf-8 -*-
"""ARNALDO · Anilla clásica (diseño de la casa, elegido por el promotor el 13/10/2026).

Redibujo vectorial del render «anilla clásica» (01_BRAND/renders/arnaldo-render-anilla-clasica.png):
banda lacre con cantos de oro perlados, óvalo central troquelado con marco de oro en guilloché de red,
centro negro laca, ARNALDO en capitales romanas de oro en arco y la firma debajo. Sin monograma ni emblema:
la firma hace de signo, como en el origen de la anilla.
Códigos de referencia: medallón oval central (Hoyo de Monterrey); nombre en romanas de lectura a distancia
y paleta corta (Montecristo). Sin elementos de sus anillas.
La firma es PROVISIONAL (caligrafía Pinyon Script): se sustituirá por la firma real de Arnaldo vectorizada.
Todo el texto se convierte a trazados (fuentes OFL 1.1). Uso: python3 brand_clasica.py DIR_SALIDA"""
import os, sys, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from brand_lib import tp, T, DEFS, FONTS, beads, beads_ellipse, waves

OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)
LACRE, NOIR, MARFIL, ORO = "#8E1B1B", "#14100D", "#F4EBD8", "#C9A24A"

EXTRA = """<defs>
<linearGradient id="lacreB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7A1414"/><stop offset=".35" stop-color="#9A2420"/><stop offset=".7" stop-color="#7E1717"/><stop offset="1" stop-color="#4E0B0B"/></linearGradient>
<linearGradient id="noirB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2A221D"/><stop offset=".5" stop-color="#16110E"/><stop offset="1" stop-color="#060504"/></linearGradient>
<linearGradient id="marfilB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFBF1"/><stop offset=".55" stop-color="#F4EBD8"/><stop offset="1" stop-color="#E2D2B0"/></linearGradient>
<radialGradient id="laca" cx=".38" cy=".3" r=".85"><stop offset="0" stop-color="#3B3430"/><stop offset=".35" stop-color="#1A1512"/><stop offset="1" stop-color="#050404"/></radialGradient>
<linearGradient id="brillo" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".16"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/></linearGradient>
</defs>"""


def svg(w, h, body, name, bg=None):
    s = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}">{DEFS}{EXTRA}'
    if bg:
        s += f'<rect width="{w}" height="{h}" fill="{bg}"/>'
    open(os.path.join(OUT, name), "w").write(s + body + "</svg>")


def net(cx, cy, rx, ry, step, color, sw, tag):
    """Guilloché en red (dos familias de diagonales), recortado a la elipse exterior dada."""
    g = []
    for k in range(-int(2 * rx / step) - 4, int(2 * rx / step) + 5):
        x = cx + k * step
        g.append(f'<line x1="{x - ry * 1.2:.1f}" y1="{cy - ry * 1.2:.1f}" x2="{x + ry * 1.2:.1f}" y2="{cy + ry * 1.2:.1f}" stroke="{color}" stroke-width="{sw}"/>')
        g.append(f'<line x1="{x + ry * 1.2:.1f}" y1="{cy - ry * 1.2:.1f}" x2="{x - ry * 1.2:.1f}" y2="{cy + ry * 1.2:.1f}" stroke="{color}" stroke-width="{sw}"/>')
    return "".join(g)


def scroll(cx, cy, s, flip=1, fill="url(#gold)"):
    """Filigrana simétrica (volutas en C) para arriba/abajo del óvalo."""
    out = []
    for sx in (-1, 1):
        d = (f"M0,0 C{sx*s*.35},{-flip*s*.02} {sx*s*.62},{-flip*s*.22} {sx*s*.9},{-flip*s*.12} "
             f"C{sx*s*1.12},{-flip*s*.04} {sx*s*1.1},{flip*s*.2} {sx*s*.92},{flip*s*.2} "
             f"C{sx*s*.8},{flip*s*.2} {sx*s*.78},{flip*s*.08} {sx*s*.88},{flip*s*.05}")
        out.append(f'<path d="{d}" fill="none" stroke="{fill}" stroke-width="{s*.07:.1f}" stroke-linecap="round"/>')
        d2 = (f"M{sx*s*.12},{flip*s*.02} C{sx*s*.3},{flip*s*.18} {sx*s*.55},{flip*s*.2} {sx*s*.66},{flip*s*.1}")
        out.append(f'<path d="{d2}" fill="none" stroke="{fill}" stroke-width="{s*.05:.1f}" stroke-linecap="round"/>')
    out.append(f'<path d="M0,{-flip*s*.16} L{s*.09},0 L0,{flip*s*.16} L{-s*.09},0 Z" fill="{fill}"/>')
    return f'<g transform="translate({cx},{cy})">{"".join(out)}</g>'


def arch(txt, font, size, cx, base_y, R, fill, tracking=0.07):
    """Texto en arco simétrico: línea de base sobre un círculo de radio R cuyo punto más alto es (cx, base_y)."""
    f = FONTS[font]
    cmap, sc = f.getBestCmap(), size / f["head"].unitsPerEm
    ws = [f["hmtx"][cmap[ord(c)]][0] * sc for c in txt]
    tot = sum(ws) + tracking * size * (len(txt) - 1)
    out, acc = [], -tot / 2
    for c, w in zip(txt, ws):
        th = (acc + w / 2) / R
        x, y = cx + R * math.sin(th), base_y + R * (1 - math.cos(th))
        d, _ = tp(c, font, size, 0, 0, 0, "middle")
        out.append(f'<path d="{d}" fill="{fill}" transform="translate({x:.2f},{y:.2f}) rotate({math.degrees(th):.2f})"/>')
        acc += w + tracking * size
    return "".join(out)


def firma(cx, cy, size, fill="url(#goldH)", rot=-7):
    """Firma PROVISIONAL: «Arnaldo» caligráfico con rúbrica (se sustituirá por la firma real)."""
    d, w = tp("Arnaldo", "py", size, 0, 0, 0.0, "middle")
    ru = (f'<path d="M{-w*.24:.1f},{size*.36:.1f} C{-w*.02:.1f},{size*.3:.1f} {w*.3:.1f},{size*.24:.1f} {w*.54:.1f},{size*.08:.1f}" '
          f'fill="none" stroke="{fill}" stroke-width="{size*.04:.1f}" stroke-linecap="round"/>')
    return f'<g transform="translate({cx},{cy}) rotate({rot})"><path d="{d}" fill="{fill}" stroke="{fill}" stroke-width="{size*.012:.2f}"/>{ru}</g>'


def medallon(cx, cy, rx, ry, tag, center="url(#laca)", name_fill="url(#goldH)", firma_on=True):
    """Óvalo de la casa: oro fino · red guilloché · filete lacre · oro · laca negra con ARNALDO en arco y firma."""
    g = [f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="url(#gold)" filter="url(#shadow)"/>']
    g.append(f'<ellipse cx="{cx}" cy="{cy}" rx="{rx-7}" ry="{ry-7}" fill="#6B2A12"/>')
    g.append(f'<clipPath id="nr{tag}"><ellipse cx="{cx}" cy="{cy}" rx="{rx-9}" ry="{ry-9}"/></clipPath>')
    g.append(f'<ellipse cx="{cx}" cy="{cy}" rx="{rx-9}" ry="{ry-9}" fill="url(#gold)"/>')
    g.append(f'<g clip-path="url(#nr{tag})" opacity=".75">' + net(cx, cy, rx, ry, rx * .028, "#5A3A0E", rx * .004, tag) + "</g>")
    w = rx * .14                      # ancho del anillo de red
    g.append(f'<ellipse cx="{cx}" cy="{cy}" rx="{rx-9-w}" ry="{ry-9-w*ry/rx}" fill="none" stroke="#4E0B0B" stroke-width="{rx*.022:.1f}"/>')
    g.append(f'<ellipse cx="{cx}" cy="{cy}" rx="{rx-9-w*1.12}" ry="{ry-9-w*1.12*ry/rx}" fill="url(#gold)"/>')
    irx, iry = rx - 9 - w * 1.24, ry - 9 - w * 1.24 * ry / rx
    g.append(f'<ellipse cx="{cx}" cy="{cy}" rx="{irx}" ry="{iry}" fill="{center}"/>')
    g.append(f'<ellipse cx="{cx}" cy="{cy}" rx="{irx}" ry="{iry}" fill="url(#brillo)"/>')
    g.append(f'<ellipse cx="{cx}" cy="{cy}" rx="{irx-rx*.03}" ry="{iry-rx*.03}" fill="none" stroke="url(#gold)" stroke-width="{rx*.006:.1f}" opacity=".8"/>')
    # perlado del canto exterior
    g.append(beads_ellipse(cx, cy, rx - 3.5, ry - 3.5, rx * .006, 140, "#7A5A1C"))
    # filigranas arriba y abajo
    g.append(scroll(cx, cy - ry + rx * .02, rx * .2, 1) + scroll(cx, cy + ry - rx * .02, rx * .2, -1))
    # nombre en arco (capitales romanas) y firma
    size = irx * .29
    R = irx * 6.0
    g.append(arch("ARNALDO", "cz7", size, cx, cy + iry * .06, R, name_fill))
    if firma_on:
        g.append(firma(cx + irx * .04, cy + iry * .56, irx * .24))
    return "".join(g)


def band(W=1800, field="url(#lacreB)", edge_dark="#4E0B0B", center="url(#laca)", tag="n1", side=None, side_fill="url(#goldH)"):
    H, cy = 360, 180
    y0, y1 = cy - 110, cy + 110
    cx = W / 2
    g = [f'<rect x="0" y="{y0}" width="{W}" height="{y1-y0}" fill="{field}"/>']
    # cantos: oro, perlado, filete, segundo perlado fino (como en la anilla clásica)
    for top in (True, False):
        yb = y0 if top else y1 - 16
        g.append(f'<rect x="0" y="{yb}" width="{W}" height="16" fill="url(#gold)"/>')
        g.append(beads(6, W, yb + 8, 3.2, 10.5, "#6a4c14"))
        yl = y0 + 20 if top else y1 - 22
        g.append(f'<rect x="0" y="{yl}" width="{W}" height="2" fill="url(#goldH)"/>')
        g.append(beads(4, W, (y0 + 28) if top else (y1 - 28), 1.7, 7, "url(#goldR)"))
        g.append(f'<rect x="0" y="{(y0 + 33) if top else (y1 - 35)}" width="{W}" height="1.4" fill="url(#goldH)" opacity=".8"/>')
    if side:
        for sgn, txt in ((-1, side[0]), (1, side[1])):
            g.append(T(txt, "cz7", 24, cx + sgn * 600, cy + 8.5, side_fill, tracking=.3))
    g.append(medallon(cx, cy, 300, 158, tag, center=center))
    return "".join(g), W, H


def band2(W=1800, txt="PLIEGO DE AUTOR", field="url(#lacreB)", tfill="url(#goldH)"):
    y0, y1 = 10, 104
    cx, cy = W / 2, (y0 + y1) / 2
    g = [f'<rect x="0" y="{y0}" width="{W}" height="{y1-y0}" fill="{field}"/>']
    for yy in (y0, y1 - 10):
        g.append(f'<rect x="0" y="{yy}" width="{W}" height="10" fill="url(#gold)"/>')
        g.append(beads(4, W, yy + 5, 2.2, 7.5, "#6a4c14"))
    g.append(f'<rect x="0" y="{y0+13}" width="{W}" height="1.4" fill="url(#goldH)"/><rect x="0" y="{y1-14.4}" width="{W}" height="1.4" fill="url(#goldH)"/>')
    g.append(T(txt, "cz7", 30, cx, cy + 10.5, tfill, tracking=.34))
    for sgn in (-1, 1):
        x = cx + sgn * 300
        g.append(f'<path d="M{x},{cy-8} L{x+8},{cy} L{x},{cy+8} L{x-8},{cy} Z" fill="url(#gold)"/>')
        g.append(f'<rect x="{min(x + sgn*22, x + sgn*222)}" y="{cy-.8}" width="200" height="1.6" fill="url(#goldH)"/>')
    return "".join(g), W, 114


def vista(W=1800, H=1120, vignette=None):
    """Interior de tapa: papel marfil, marco lacre y oro, el óvalo de la casa al centro.
    vignette (PNG sin texto) opcional: escena grabada en una cartela a cada lado."""
    cx, cy = W / 2, H / 2
    g = [f'<rect width="{W}" height="{H}" fill="url(#marfilB)"/>',
         f'<rect width="{W}" height="{H}" fill="url(#marfilB)" filter="url(#paper)"/>']
    for m, sw, col in ((22, 28, "url(#lacreB)"), (42, 5, "url(#gold)"), (62, 2, LACRE)):
        g.append(f'<rect x="{m}" y="{m}" width="{W-2*m}" height="{H-2*m}" fill="none" stroke="{col}" stroke-width="{sw}"/>')
    g.append(beads(46, W - 40, 22, 3.6, 13, "url(#goldR)") + beads(46, W - 40, H - 22, 3.6, 13, "url(#goldR)"))
    g.append(medallon(cx, cy, 560, 380, "vista"))
    g.append(T("Pliego de autor", "py", 64, cx, H - 86, LACRE))
    return "".join(g)


def brand_stamp(W=1400, H=560, ink="#3B2414"):
    """Marca a fuego para la tapa (una tinta): ARNALDO entre filetes y la firma. Sin emblema."""
    cx = W / 2
    g = [f'<g fill="{ink}">',
         f'<rect x="{cx-540}" y="40" width="1080" height="6"/><rect x="{cx-540}" y="54" width="1080" height="2.5"/>',
         T("ARNALDO", "cz7", 200, cx, 270, ink, tracking=.08),
         f'<rect x="{cx-540}" y="312" width="1080" height="2.5"/><rect x="{cx-540}" y="322" width="1080" height="6"/>',
         "</g>", firma(cx, 448, 120, fill=ink, rot=-5)]
    return "".join(g), W, H


if __name__ == "__main__":
    b, W, H = band()
    svg(W, H, b, "arnaldo-anilla-n1.svg")
    b, W, H = band(field="url(#marfilB)", tag="n2")
    svg(W, H, b, "arnaldo-anilla-n2.svg")
    b, W, H = band(field="url(#noirB)", tag="n3")
    svg(W, H, b, "arnaldo-anilla-n3-negra.svg")
    p, W, H = band2()
    svg(W, H, p, "arnaldo-anilla-pliego.svg")
    svg(760, 520, medallon(380, 260, 360, 236, "m"), "arnaldo-medallon.svg")
    svg(1800, 1120, vista(), "arnaldo-vista.svg")
    st, W, H = brand_stamp()
    svg(W, H, st, "arnaldo-marca-fuego.svg")
