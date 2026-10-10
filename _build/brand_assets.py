# -*- coding: utf-8 -*-
"""Genera los activos gráficos de FOLIO como SVG vectoriales con el texto convertido a trazados
(no dependen de tener las fuentes instaladas). Fuentes: Cormorant Garamond e Inter (SIL OFL 1.1)."""
import os, sys
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

B = os.path.dirname(os.path.abspath(__file__))
OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)
F = lambda n: os.path.join(B, "fonts", n)
FONTS = {
    "cg500": TTFont(F("cormorant-garamond-latin-500-normal.woff2")),
    "cg400": TTFont(F("cormorant-garamond-latin-400-normal.woff2")),
    "cg400i": TTFont(F("cormorant-garamond-latin-400-italic.woff2")),
    "cg600": TTFont(F("cormorant-garamond-latin-600-normal.woff2")),
    "in400": TTFont(F("inter-latin-400-normal.woff2")),
    "in500": TTFont(F("inter-latin-500-normal.woff2")),
}

INK, IVORY, TOBACCO, VERM, GOLD, CEDAR, ASH = "#1B1A17", "#F2EDE3", "#5A3E2B", "#A23B2A", "#B08D57", "#C9A27E", "#8C877E"


def text_path(txt, font="cg500", size=100, x=0, y=0, tracking=0.0, anchor="start"):
    """Devuelve (svg_path_d, width). tracking en em."""
    f = FONTS[font]
    gs = f.getGlyphSet()
    cmap = f.getBestCmap()
    upm = f["head"].unitsPerEm
    sc = size / upm
    hmtx = f["hmtx"]
    names = [cmap.get(ord(ch)) for ch in txt]
    widths = [(hmtx[n][0] * sc if n else size * 0.3) for n in names]
    total = sum(widths) + tracking * size * (len(txt) - 1)
    if anchor == "middle":
        x -= total / 2
    elif anchor == "end":
        x -= total
    d = []
    cx = x
    for n, w in zip(names, widths):
        if n and n in gs:
            pen = SVGPathPen(gs)
            tp = TransformPen(pen, (sc, 0, 0, -sc, cx, y))
            gs[n].draw(tp)
            d.append(pen.getCommands())
        cx += w + tracking * size
    return " ".join(d), total


def T(txt, fill=INK, **kw):
    d, _ = text_path(txt, **kw)
    return f'<path d="{d}" fill="{fill}"/>'


def svg(w, h, body, bg=None, name=None):
    bgr = f'<rect width="{w}" height="{h}" fill="{bg}"/>' if bg else ""
    s = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}">{bgr}{body}</svg>'
    if name:
        open(os.path.join(OUT, name), "w").write(s)
    return s


def monogram(cx, cy, s, stroke=INK, fill_f=INK, sw=None):
    """Sello cuadrado con esquina doblada (pliego) y F de Cormorant."""
    sw = sw or s * 0.018
    h = s / 2
    fold = s * 0.22
    x0, y0, x1, y1 = cx - h, cy - h, cx + h, cy + h
    outline = f'<path d="M{x0},{y0} L{x1-fold},{y0} L{x1},{y0+fold} L{x1},{y1} L{x0},{y1} Z" fill="none" stroke="{stroke}" stroke-width="{sw}" stroke-linejoin="miter"/>'
    flap = f'<path d="M{x1-fold},{y0} L{x1-fold},{y0+fold} L{x1},{y0+fold}" fill="none" stroke="{stroke}" stroke-width="{sw}"/>'
    inner = f'<rect x="{x0+s*0.06}" y="{y0+s*0.06}" width="{s*0.88-fold*0.0}" height="{s*0.88}" fill="none" stroke="{stroke}" stroke-width="{sw*0.35}" opacity="0" />'
    f = T("F", fill=fill_f, font="cg500", size=s * 0.72, x=cx - s * 0.02, y=cy + s * 0.25, anchor="middle")
    return outline + flap + inner + f


def wordmark(cx, y, size, fill=INK, tracking=0.32):
    return T("FOLIO", fill=fill, font="cg500", size=size, x=cx, y=y, tracking=tracking, anchor="middle")


# 1. Wordmark
for nm, col, bg in [("folio-wordmark-ink.svg", INK, None), ("folio-wordmark-ivory.svg", IVORY, INK), ("folio-wordmark-gold.svg", GOLD, TOBACCO)]:
    svg(1200, 360, wordmark(600, 230, 170, col), bg=bg, name=nm)

# 2. Monograma
svg(600, 600, monogram(300, 300, 420), name="folio-monogram-ink.svg")
svg(600, 600, monogram(300, 300, 420, stroke=GOLD, fill_f=GOLD), bg=TOBACCO, name="folio-monogram-gold.svg")

# 3. Lockup principal (vertical)
body = monogram(600, 230, 220) + wordmark(600, 520, 150) + \
    f'<line x1="430" y1="575" x2="770" y2="575" stroke="{VERM}" stroke-width="2"/>' + \
    T("CIGARROS", fill=ASH, font="in500", size=26, x=600, y=630, tracking=0.6, anchor="middle")
svg(1200, 720, body, name="folio-lockup-vertical.svg")
# 4. Lockup horizontal
_d, _w = text_path("FOLIO", font="cg500", size=140, x=300, y=200, tracking=0.32)
body = monogram(150, 150, 170) + f'<path d="{_d}" fill="{INK}"/>' + \
    f'<line x1="300" y1="232" x2="{300+_w-0.0*140}" y2="232" stroke="{VERM}" stroke-width="2"/>' + \
    T("CIGARROS", fill=ASH, font="in500", size=22, x=300, y=272, tracking=0.6)
svg(1100, 300, body, name="folio-lockup-horizontal.svg")

# 5. Anilla (desarrollo plano, proporción 210 x 22 mm aprox -> 2100 x 220)
W, H = 2100, 220
band = f'<rect x="0" y="0" width="{W}" height="{H}" fill="{IVORY}"/>'
band += f'<rect x="0" y="14" width="{W}" height="4" fill="{GOLD}"/><rect x="0" y="{H-18}" width="{W}" height="4" fill="{GOLD}"/>'
mid = W / 2
band += f'<rect x="{mid-210}" y="0" width="420" height="{H}" fill="{INK}"/>'
band += f'<rect x="{mid-200}" y="10" width="400" height="{H-20}" fill="none" stroke="{GOLD}" stroke-width="2"/>'
band += wordmark(mid, 140, 92, IVORY, 0.30)
band += T("PLIEGO", fill=GOLD, font="in500", size=18, x=mid - 330, y=120, tracking=0.5, anchor="middle")
band += T("Nº 001", fill=INK, font="cg500", size=34, x=mid - 330, y=160, tracking=0.1, anchor="middle")
band += monogram(mid + 330, 110, 110, stroke=INK, fill_f=INK, sw=2.4)
for xx in (mid - 520, mid + 520):
    band += f'<line x1="{xx}" y1="60" x2="{xx}" y2="{H-60}" stroke="{GOLD}" stroke-width="2"/>'
band += f'<text x="20" y="{H+40}" font-family="Inter, sans-serif" font-size="22" fill="{ASH}">Desarrollo plano · zona de solape en extremos · stamping oro viejo · papel algodón marfil</text>'
svg(W, H + 60, band, name="folio-band-flat.svg")

# 6. Tapa de caja (10 u) 160 x 140 mm aprox -> 1600 x 1400
W, H = 1600, 1400
lid = f'<rect width="{W}" height="{H}" fill="{CEDAR}"/>'
for i in range(0, W, 28):
    lid += f'<line x1="{i}" y1="0" x2="{i+40}" y2="{H}" stroke="#B48E6A" stroke-width="1" opacity="0.35"/>'
lid += f'<rect x="200" y="200" width="1200" height="640" fill="{IVORY}"/>'
lid += f'<rect x="220" y="220" width="1160" height="600" fill="none" stroke="{GOLD}" stroke-width="3"/>'
lid += monogram(800, 380, 150) + wordmark(800, 640, 150)
lid += f'<line x1="600" y1="690" x2="1000" y2="690" stroke="{VERM}" stroke-width="3"/>'
lid += T("10 CIGARROS · OCTAVO", fill=ASH, font="in500", size=26, x=800, y=750, tracking=0.5, anchor="middle")
lid += f'<rect x="200" y="900" width="1200" height="380" fill="#FFFFFF" stroke="{INK}" stroke-width="3"/>'
lid += T("ZONA RESERVADA A LA ADVERTENCIA SANITARIA", fill=INK, font="in500", size=34, x=800, y=1060, tracking=0.08, anchor="middle")
lid += T("Texto y superficie conforme RD 579/2017 — validar porcentaje exacto", fill=ASH, font="in400", size=26, x=800, y=1120, anchor="middle")
svg(W, H, lid, name="folio-box-lid-mockup.svg")

# 7. Colofón (tarjeta interior) 90 x 120 mm -> 900 x 1200
W, H = 900, 1200
col = f'<rect width="{W}" height="{H}" fill="{IVORY}"/>' + f'<rect x="40" y="40" width="{W-80}" height="{H-80}" fill="none" stroke="{INK}" stroke-width="1.5"/>'
col += monogram(450, 190, 120, sw=2.2)
col += T("COLOFÓN", fill=INK, font="cg500", size=44, x=450, y=340, tracking=0.35, anchor="middle")
col += f'<line x1="330" y1="370" x2="570" y2="370" stroke="{VERM}" stroke-width="2"/>'
lines = [("Esta caja pertenece al", "cg400i", 34), ("PLIEGO Nº ___", "cg500", 40), ("Vitola: OCTAVO", "cg400", 32),
         ("Torcido a mano el ___ / ___ / ______", "cg400", 30), ("Fábrica: ______________________", "cg400", 30),
         ("Caja nº ____ de ____", "cg500", 34), ("Control de calidad: ______", "cg400", 30)]
yy = 460
for t, fnt, sz in lines:
    col += T(t, fill=INK, font=fnt, size=sz, x=450, y=yy, anchor="middle")
    yy += 80
col += T("Documento de trazabilidad · no promocional", fill=ASH, font="in400", size=20, x=450, y=H - 80, anchor="middle")
svg(W, H, col, name="folio-colophon-card.svg")

# 8. Precinto de garantía de marca (no fiscal) 200 x 15 mm -> 2000 x 150
W, H = 2000, 150
seal = f'<rect width="{W}" height="{H}" fill="{IVORY}"/>'
micro = "FOLIO·PLIEGO·" * 60
seal += T(micro[:150], fill=VERM, font="in400", size=11, x=10, y=28, tracking=0.05)
seal += T(micro[:150], fill=VERM, font="in400", size=11, x=10, y=H - 18, tracking=0.05)
seal += f'<rect x="0" y="40" width="{W}" height="70" fill="{VERM}"/>'
seal += wordmark(W / 2, 98, 48, IVORY, 0.3)
seal += T("Nº 000000", fill=IVORY, font="in500", size=26, x=W - 120, y=86, anchor="end")
svg(W, H, seal, name="folio-brand-seal.svg")

# 9. Tres direcciones creativas (tablero comparativo)
def board(x, title, bg, fg, accent, kind):
    s = f'<g transform="translate({x},0)"><rect width="560" height="760" fill="{bg}"/>'
    if kind == "d1":
        s += monogram(280, 200, 140, stroke=fg, fill_f=fg) + wordmark(280, 420, 92, fg)
        s += f'<line x1="180" y1="455" x2="380" y2="455" stroke="{accent}" stroke-width="2"/>'
    elif kind == "d2":
        s += f'<circle cx="280" cy="210" r="90" fill="none" stroke="{accent}" stroke-width="4"/>'
        s += T("F", fill=accent, font="in500", size=120, x=280, y=255, anchor="middle")
        s += T("FOLIO", fill=fg, font="in500", size=70, x=280, y=420, tracking=0.5, anchor="middle")
        s += f'<rect x="120" y="450" width="320" height="6" fill="{accent}"/>'
    else:
        for i in range(6):
            s += f'<rect x="{80+i*70}" y="120" width="50" height="{80+i*30}" fill="{accent}" opacity="{0.4+i*0.1}"/>'
        s += T("folio", fill=fg, font="in400", size=96, x=280, y=440, tracking=0.02, anchor="middle")
    s += T(title, fill=fg, font="in500", size=24, x=280, y=600, tracking=0.2, anchor="middle")
    s += "</g>"
    return s


body = board(0, "D1 · COLOFÓN", IVORY, INK, VERM, "d1") + board(600, "D2 · CEDRO Y LACA", TOBACCO, IVORY, GOLD, "d2") + board(1200, "D3 · TIERRA", "#E7D3BF", "#3B2A20", "#B5532F", "d3")
svg(1760, 760, body, name="folio-creative-directions.svg")

# 10. Paleta
pal = [("Tinta", INK), ("Marfil", IVORY), ("Tabaco", TOBACCO), ("Bermellón", VERM), ("Oro viejo", GOLD), ("Cedro", CEDAR), ("Ceniza", ASH)]
body = ""
for i, (n, c) in enumerate(pal):
    body += f'<rect x="{i*170}" y="0" width="160" height="200" fill="{c}" stroke="#CCCCCC"/>'
    body += T(n, fill=INK, font="in500", size=20, x=i * 170 + 8, y=232)
    body += T(c, fill=ASH, font="in400", size=18, x=i * 170 + 8, y=260)
svg(1190, 280, body, name="folio-palette.svg")
print("assets ok", len(os.listdir(OUT)))
