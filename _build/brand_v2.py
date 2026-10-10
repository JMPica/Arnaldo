# -*- coding: utf-8 -*-
"""FOLIO v2 — Dirección «Gran Habilitación»: gramática visual de la habilitación cubana clásica
(anilla con cartela central, oro en relieve, guilloché, litografía de tapa o «vista», filetes),
reinterpretada con elementos originales. NO usa escudos de Estado, medallas, «Habana», fechas
de fundación ni elementos de seguridad de Habanos. Texto convertido a trazados (fuentes OFL 1.1)."""
import os, sys, math, random
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

B = os.path.dirname(os.path.abspath(__file__))
OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)
FN = lambda n: TTFont(os.path.join(B, "fonts", n))
FONTS = {
    "cz9": FN("cinzel-latin-900-normal.woff2"), "cz7": FN("cinzel-latin-700-normal.woff2"),
    "cz4": FN("cinzel-latin-400-normal.woff2"), "pf9": FN("playfair-display-latin-900-normal.woff2"),
    "pf4i": FN("playfair-display-latin-400-italic.woff2"), "py": FN("pinyon-script-latin-400-normal.woff2"),
    "fell": FN("im-fell-english-latin-400-normal.woff2"), "felli": FN("im-fell-english-latin-400-italic.woff2"),
    "in5": FN("inter-latin-500-normal.woff2"), "in4": FN("inter-latin-400-normal.woff2"),
}
RED, RED_D, BLACK, IVORY, CREAM, TOB, GOLD = "#8E1B1B", "#5E0F0F", "#14100D", "#F4EBD8", "#E8D7B2", "#4A2E1C", "#C9A24A"


def tp(txt, font, size, x=0, y=0, tracking=0.0, anchor="middle"):
    f = FONTS[font]
    gs, cmap, sc = f.getGlyphSet(), f.getBestCmap(), size / f["head"].unitsPerEm
    names = [cmap.get(ord(c)) for c in txt]
    ws = [f["hmtx"][n][0] * sc if n else size * .3 for n in names]
    tot = sum(ws) + tracking * size * (len(txt) - 1)
    x -= tot / 2 if anchor == "middle" else (tot if anchor == "end" else 0)
    d, cx = [], x
    for n, w in zip(names, ws):
        if n and n in gs:
            pen = SVGPathPen(gs)
            gs[n].draw(TransformPen(pen, (sc, 0, 0, -sc, cx, y)))
            d.append(pen.getCommands())
        cx += w + tracking * size
    return " ".join(d), tot


def T(txt, font, size, x, y, fill, tracking=0.0, anchor="middle", extra=""):
    d, _ = tp(txt, font, size, x, y, tracking, anchor)
    return f'<path d="{d}" fill="{fill}" {extra}/>'


def arc_text(txt, font, size, cx, cy, r, a_center, fill, tracking=0.08, inside=False):
    """Texto sobre arco (a_center en grados, 0 = arriba). inside=True para arcos inferiores."""
    f = FONTS[font]
    cmap, sc = f.getBestCmap(), size / f["head"].unitsPerEm
    ws = [f["hmtx"][cmap[ord(c)]][0] * sc if ord(c) in cmap else size * .3 for c in txt]
    total = sum(ws) + tracking * size * (len(txt) - 1)
    ang_total = total / r * 180 / math.pi
    out, acc = [], 0
    for c, w in zip(txt, ws):
        mid = acc + w / 2
        a = (a_center - ang_total / 2 + mid / r * 180 / math.pi) if not inside else (a_center + ang_total / 2 - mid / r * 180 / math.pi)
        rad = math.radians(a - 90)
        px, py = cx + r * math.cos(rad), cy + r * math.sin(rad)
        rot = a if not inside else a + 180
        d, _ = tp(c, font, size, 0, size * 0.35, 0, "middle")
        out.append(f'<path d="{d}" fill="{fill}" transform="translate({px:.2f},{py:.2f}) rotate({rot:.2f})"/>')
        acc += w + tracking * size
    return "".join(out)


DEFS = f"""<defs>
<linearGradient id="gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7A5A1C"/><stop offset=".22" stop-color="#E9CF7E"/><stop offset=".42" stop-color="#FFF2C2"/><stop offset=".58" stop-color="#D1AB52"/><stop offset=".82" stop-color="#8A6620"/><stop offset="1" stop-color="#C8A04A"/></linearGradient>
<linearGradient id="goldH" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8A6620"/><stop offset=".3" stop-color="#F3DD95"/><stop offset=".5" stop-color="#FFF4C8"/><stop offset=".7" stop-color="#C79E45"/><stop offset="1" stop-color="#7A5A1C"/></linearGradient>
<radialGradient id="goldR" cx=".4" cy=".35" r=".8"><stop offset="0" stop-color="#FFF4C8"/><stop offset=".45" stop-color="#D9B55E"/><stop offset="1" stop-color="#6E5017"/></radialGradient>
<linearGradient id="lacre" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#A8261F"/><stop offset=".5" stop-color="#8E1B1B"/><stop offset="1" stop-color="#5E0F0F"/></linearGradient>
<radialGradient id="lacreR" cx=".5" cy=".45" r=".7"><stop offset="0" stop-color="#B42C22"/><stop offset="1" stop-color="#5E0F0F"/></radialGradient>
<linearGradient id="noir" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2B2420"/><stop offset=".5" stop-color="#14100D"/><stop offset="1" stop-color="#050403"/></linearGradient>
<radialGradient id="noirR" cx=".5" cy=".4" r=".75"><stop offset="0" stop-color="#2F2722"/><stop offset="1" stop-color="#080605"/></radialGradient>
<linearGradient id="ivory" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FBF5E8"/><stop offset="1" stop-color="#E6D8BB"/></linearGradient>
<linearGradient id="cedar" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#C08A5A"/><stop offset=".5" stop-color="#A86F42"/><stop offset="1" stop-color="#8A5530"/></linearGradient>
<linearGradient id="leaf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7A4E2E"/><stop offset=".45" stop-color="#9A6638"/><stop offset=".55" stop-color="#8B5A32"/><stop offset="1" stop-color="#4E2F1A"/></linearGradient>
<linearGradient id="cyl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity=".55"/><stop offset=".18" stop-color="#000" stop-opacity=".05"/><stop offset=".32" stop-color="#fff" stop-opacity=".22"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".6"/></linearGradient>
<filter id="emboss" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur in="SourceAlpha" stdDeviation="0.8" result="b"/><feOffset in="b" dx="1.2" dy="1.6" result="o"/><feFlood flood-color="#000" flood-opacity=".6"/><feComposite in2="o" operator="in" result="s"/><feOffset in="SourceAlpha" dx="-0.7" dy="-0.9" result="h0"/><feFlood flood-color="#FFF8DC" flood-opacity=".55"/><feComposite in2="h0" operator="in" result="h"/><feMerge><feMergeNode in="s"/><feMergeNode in="h"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
<filter id="shadow" x="-10%" y="-10%" width="120%" height="130%"><feGaussianBlur in="SourceAlpha" stdDeviation="6"/><feOffset dx="0" dy="8"/><feComponentTransfer><feFuncA type="linear" slope=".45"/></feComponentTransfer><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>
<filter id="paper" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="7"/><feColorMatrix type="matrix" values="0 0 0 0 .35  0 0 0 0 .25  0 0 0 0 .15  0 0 0 .09 0"/><feComposite in2="SourceGraphic" operator="in"/><feMerge><feMergeNode in="SourceGraphic"/><feMergeNode/></feMerge></filter>
<filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.012 0.25" numOctaves="3" seed="3"/><feColorMatrix type="matrix" values="0 0 0 0 .25  0 0 0 0 .13  0 0 0 0 .05  0 0 0 .35 0"/></filter>
</defs>"""


def svg(w, h, body, name, bg=None):
    s = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}">{DEFS}'
    if bg:
        s += f'<rect width="{w}" height="{h}" fill="{bg}"/>'
    s += body + "</svg>"
    open(os.path.join(OUT, name), "w").write(s)
    return s


# ------------------------------------------------------------------ ornamentos
def rosette(cx, cy, R, amp, k, n, stroke, sw=0.6, op=0.55, rx=1.0):
    out = []
    for j in range(n):
        ph = j * 2 * math.pi / (n * k) * 0.9
        pts = []
        for i in range(721):
            t = i / 720 * 2 * math.pi
            rad = R + amp * math.sin(k * t + ph) + amp * .35 * math.sin((2 * k + 1) * t - ph)
            pts.append(f"{cx + rad * math.cos(t) * rx:.2f},{cy + rad * math.sin(t):.2f}")
        out.append(f'<polyline points="{" ".join(pts)}" fill="none" stroke="{stroke}" stroke-width="{sw}" opacity="{op}"/>')
    return "".join(out)


def spiro(cx, cy, R, ratio, dd, n, stroke, sw=0.6, op=0.4, rx=1.0, ry=1.0):
    """Guilloché clásico: hipotrocoides superpuestos y girados (ratio entero = nº de lóbulos)."""
    out = []
    r = R / (ratio + 1)
    Rm = R - r
    for j in range(n):
        rot = 2 * math.pi * j / (n * ratio)
        pts = []
        for i in range(1441):
            t = i / 1440 * 2 * math.pi
            x = Rm * math.cos(t) + dd * math.cos(Rm / r * t)
            y = Rm * math.sin(t) - dd * math.sin(Rm / r * t)
            xr, yr = x * math.cos(rot) - y * math.sin(rot), x * math.sin(rot) + y * math.cos(rot)
            pts.append(f"{cx + xr*rx:.2f},{cy + yr*ry:.2f}")
        out.append(f'<polyline points="{" ".join(pts)}" fill="none" stroke="{stroke}" stroke-width="{sw}" opacity="{op}"/>')
    return "".join(out)


def waves(x0, x1, y0, y1, period, n, stroke, sw=0.6, op=0.5):
    out = []
    amp = (y1 - y0) * 0.38
    ym = (y0 + y1) / 2
    for j in range(n):
        ph = j * 2 * math.pi / n
        pts = []
        x = x0
        while x <= x1:
            y = ym + amp * math.sin(2 * math.pi * x / period + ph) * math.cos(math.pi * x / (period * 3.0) + ph / 2)
            pts.append(f"{x:.1f},{y:.2f}")
            x += 3
        out.append(f'<polyline points="{" ".join(pts)}" fill="none" stroke="{stroke}" stroke-width="{sw}" opacity="{op}"/>')
    return "".join(out)


def beads(x0, x1, y, r, gap, fill="url(#goldR)"):
    out, x = [], x0
    while x <= x1:
        out.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r}" fill="{fill}"/>')
        x += gap
    return "".join(out)


def beads_ellipse(cx, cy, rx, ry, r, n, fill="url(#goldR)"):
    return "".join(f'<circle cx="{cx + rx * math.cos(2*math.pi*i/n):.1f}" cy="{cy + ry * math.sin(2*math.pi*i/n):.1f}" r="{r}" fill="{fill}"/>' for i in range(n))


def rope(x0, x1, y, h, fill="url(#gold)"):
    out, x = [], x0
    while x < x1:
        out.append(f'<ellipse cx="{x:.1f}" cy="{y}" rx="{h*0.55}" ry="{h*0.22}" transform="rotate(-35 {x:.1f} {y})" fill="{fill}" stroke="#5a4012" stroke-width=".4"/>')
        x += h * 0.62
    return "".join(out)


def leaf_path(L, w):
    return (f"M0,0 C{w*.95:.1f},{-L*.12:.1f} {w*.82:.1f},{-L*.72:.1f} 0,{-L:.1f} "
            f"C{-w*.82:.1f},{-L*.72:.1f} {-w*.95:.1f},{-L*.12:.1f} 0,0 Z")


def tobacco_leaf(x, y, L, rot, fill="url(#gold)", line="#6E5017"):
    w = L * 0.36
    veins = "".join(f'<path d="M0,{-L*t:.1f} Q{w*.45:.1f},{-L*t - L*.06:.1f} {w*.7*math.sin(math.pi*t)+w*.1:.1f},{-L*t - L*.14:.1f}" fill="none" stroke="{line}" stroke-width="{L*.008:.2f}"/>'
                    f'<path d="M0,{-L*t:.1f} Q{-w*.45:.1f},{-L*t - L*.06:.1f} {-(w*.7*math.sin(math.pi*t)+w*.1):.1f},{-L*t - L*.14:.1f}" fill="none" stroke="{line}" stroke-width="{L*.008:.2f}"/>'
                    for t in [0.14, 0.27, 0.4, 0.53, 0.66, 0.78])
    stem = f'<path d="M0,{L*.12:.1f} L0,{-L*.96:.1f}" stroke="{line}" stroke-width="{L*.016:.2f}"/>'
    cid = f"lf{abs(int(x*7+y*3+L))}"
    return (f'<g transform="translate({x},{y}) rotate({rot})"><clipPath id="{cid}"><path d="{leaf_path(L, w*.96)}"/></clipPath>'
            f'<path d="{leaf_path(L, w)}" fill="{fill}" stroke="{line}" stroke-width="{L*.008:.2f}"/><g clip-path="url(#{cid})">{veins}</g>{stem}</g>')


def quill(x, y, L, rot, fill="url(#gold)", line="#6E5017"):
    vane = (f"M0,{-L*.18:.1f} C{L*.11:.1f},{-L*.35:.1f} {L*.13:.1f},{-L*.75:.1f} {L*.02:.1f},{-L:.1f} "
            f"C{-L*.07:.1f},{-L*.8:.1f} {-L*.08:.1f},{-L*.4:.1f} 0,{-L*.18:.1f} Z")
    barbs = "".join(f'<line x1="0" y1="{-L*t:.1f}" x2="{L*(.1*math.sin(math.pi*(t-.15)/.85)):.1f}" y2="{-L*t-L*.05:.1f}" stroke="{line}" stroke-width="{L*.005:.2f}"/>'
                    f'<line x1="0" y1="{-L*t:.1f}" x2="{-L*(.065*math.sin(math.pi*(t-.15)/.85)):.1f}" y2="{-L*t-L*.04:.1f}" stroke="{line}" stroke-width="{L*.005:.2f}"/>' for t in [i/30 for i in range(7, 29)])
    shaft = f'<path d="M0,{L*.02:.1f} L0,{-L*.97:.1f}" stroke="{line}" stroke-width="{L*.012:.2f}"/>'
    nib = f'<path d="M{-L*.018:.1f},{-L*.18:.1f} L{L*.018:.1f},{-L*.18:.1f} L0,{L*.04:.1f} Z" fill="{fill}" stroke="{line}" stroke-width="{L*.005:.2f}"/>'
    return f'<g transform="translate({x},{y}) rotate({rot})"><path d="{vane}" fill="{fill}" stroke="{line}" stroke-width="{L*.006:.2f}"/>{barbs}{shaft}{nib}</g>'


def laurel(cx, cy, R, a0, a1, n, size, fill="url(#gold)", line="#6E5017"):
    """Rama de laurel sobre un arco desde a0 (base) hasta a1 (punta); grados SVG (0 = derecha, horario)."""
    out, pts = [], []
    sgn = 1 if a1 > a0 else -1
    for i in range(n + 1):
        a = math.radians(a0 + (a1 - a0) * i / n)
        pts.append((cx + R * math.cos(a), cy + R * math.sin(a), math.degrees(a)))
    d = "M" + " L".join(f"{p[0]:.1f},{p[1]:.1f}" for p in pts)
    out.append(f'<path d="{d}" fill="none" stroke="url(#gold)" stroke-width="{size*.10:.1f}" stroke-linecap="round"/>')
    for i, (px, py, a) in enumerate(pts):
        direc = a + 90 * sgn              # dirección de avance de la rama
        s_ = size * (1.0 - 0.45 * i / n)
        offs = (-34, 34) if i < n else (0,)
        for off in offs:
            r = direc + 90 + off
            out.append(f'<path d="M0,0 C{s_*.32:.1f},{-s_*.3:.1f} {s_*.22:.1f},{-s_*.8:.1f} 0,{-s_:.1f} C{-s_*.22:.1f},{-s_*.8:.1f} {-s_*.32:.1f},{-s_*.3:.1f} 0,0 Z" transform="translate({px:.1f},{py:.1f}) rotate({r:.1f})" fill="{fill}" stroke="{line}" stroke-width=".7"/>')
            out.append(f'<path d="M0,0 L0,{-s_*.9:.1f}" transform="translate({px:.1f},{py:.1f}) rotate({r:.1f})" stroke="{line}" stroke-width=".6" opacity=".7"/>')
    return "".join(out)


def sunburst(cx, cy, r0, r1, n, color, op=.5):
    out = []
    for i in range(n):
        a = 2 * math.pi * i / n
        a2 = a + math.pi / n * 0.55
        out.append(f'<path d="M{cx + r0*math.cos(a):.1f},{cy + r0*math.sin(a):.1f} L{cx + r1*math.cos(a):.1f},{cy + r1*math.sin(a):.1f} L{cx + r1*math.cos(a2):.1f},{cy + r1*math.sin(a2):.1f} Z" fill="{color}" opacity="{op}"/>')
    return "".join(out)


def ribbon(cx, cy, w, h, text, font="cz7", size=None, fill="url(#lacre)", tfill="url(#gold)"):
    size = size or h * .48
    tail = h * .9
    body = (f'<path d="M{cx-w/2-tail},{cy+h*.25} L{cx-w/2},{cy-h*.05} L{cx-w/2},{cy+h*.95} L{cx-w/2-tail},{cy+h*1.25} L{cx-w/2-tail*.55},{cy+h*.75} Z" fill="#5E0F0F" stroke="url(#gold)" stroke-width="2"/>'
            f'<path d="M{cx+w/2+tail},{cy+h*.25} L{cx+w/2},{cy-h*.05} L{cx+w/2},{cy+h*.95} L{cx+w/2+tail},{cy+h*1.25} L{cx+w/2+tail*.55},{cy+h*.75} Z" fill="#5E0F0F" stroke="url(#gold)" stroke-width="2"/>'
            f'<path d="M{cx-w/2},{cy-h*.15} Q{cx},{cy-h*.55} {cx+w/2},{cy-h*.15} L{cx+w/2},{cy+h*.85} Q{cx},{cy+h*.45} {cx-w/2},{cy+h*.85} Z" fill="{fill}" stroke="url(#gold)" stroke-width="3"/>')
    d, _ = tp(text, font, size, cx, cy + h * .52, 0.18, "middle")
    # curvar ligeramente el texto con un desplazamiento proporcional
    return body + f'<path d="{d}" fill="{tfill}" filter="url(#emboss)" transform="translate(0,{-h*.18:.1f})"/>'


def fleuron(x, y, s, rot=0, fill="url(#gold)"):
    """Ornamento de esquina original: volutas en S con hoja central."""
    p = (f"M0,0 C{s*.3},{-s*.05} {s*.55},{-s*.3} {s*.5},{-s*.6} C{s*.45},{-s*.85} {s*.15},{-s*.85} {s*.15},{-s*.62} "
         f"C{s*.15},{-s*.48} {s*.32},{-s*.45} {s*.34},{-s*.58} C{s*.3},{-s*.4} {s*.12},{-s*.38} {s*.08},{-s*.55} "
         f"C{s*.02},{-s*.95} {s*.62},{-s*1.0} {s*.66},{-s*.6} C{s*.7},{-s*.25} {s*.35},{s*.05} 0,{s*.06} Z")
    m = f'<g transform="scale(-1,1) rotate(90)"><path d="{p}" fill="{fill}"/></g>'
    return f'<g transform="translate({x},{y}) rotate({rot})"><path d="{p}" fill="{fill}"/>{m}<circle cx="{s*.12}" cy="{-s*.12}" r="{s*.08}" fill="{fill}"/></g>'


# ------------------------------------------------------------------ EMBLEMA
def emblem(cx, cy, s, motto=True, laurels=True):
    """Medallón oval original: hoja de tabaco y pluma cruzadas (hoja = página), laurel, cinta."""
    rx, ry = s * .40, s * .50
    g = []
    if laurels:
        g.append(laurel(cx, cy, s * .53, 112, 228, 10, s * .085))
        g.append(laurel(cx, cy, s * .53, 68, -48, 10, s * .085))
    g.append(f'<ellipse cx="{cx}" cy="{cy}" rx="{rx+s*.035}" ry="{ry+s*.035}" fill="url(#gold)" filter="url(#emboss)"/>')
    g.append(f'<ellipse cx="{cx}" cy="{cy}" rx="{rx+s*.012}" ry="{ry+s*.012}" fill="#3a2a10"/>')
    g.append(f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="url(#lacreR)"/>')
    g.append(f'<clipPath id="ec{int(cx)}{int(cy)}"><ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}"/></clipPath>')
    g.append(f'<g clip-path="url(#ec{int(cx)}{int(cy)})">' + spiro(cx, cy, s * .30, 18, s * .09, 10, "#F3B9A2", s * .0011, .28, rx=.85, ry=1.05)
             + spiro(cx, cy, s * .52, 30, s * .06, 8, "#F3B9A2", s * .001, .2, rx=.85, ry=1.05) + "</g>")
    g.append(beads_ellipse(cx, cy, rx + s * .023, ry + s * .023, s * .006, 64, "#5a4012"))
    g.append(f'<ellipse cx="{cx}" cy="{cy}" rx="{rx-s*.03}" ry="{ry-s*.03}" fill="none" stroke="url(#gold)" stroke-width="{s*.006}"/>')
    g.append(f'<g filter="url(#emboss)">' + tobacco_leaf(cx + s * .05, cy + s * .33, s * .58, -28) + quill(cx - s * .06, cy + s * .34, s * .68, 26) + "</g>")
    # estrella superior
    st = []
    for i in range(16):
        a = math.pi * i / 8 - math.pi / 2
        r = s * .07 if i % 2 == 0 else s * .028
        st.append(f"{cx + r*math.cos(a):.1f},{cy - ry - s*.11 + r*math.sin(a):.1f}")
    g.append(f'<polygon points="{" ".join(st)}" fill="url(#gold)" filter="url(#emboss)"/>')
    if motto:
        g.append(ribbon(cx, cy + ry + s * .02, s * .74, s * .14, "SCRIPTA MANENT", size=s * .06))
    return "".join(g)


svg(1000, 1150, emblem(500, 520, 820), "folio2-emblem.svg", bg=None)
svg(1000, 1150, f'<rect width="1000" height="1150" fill="url(#noirR)"/>' + emblem(500, 520, 820), "folio2-emblem-on-black.svg")


# ------------------------------------------------------------------ WORDMARK
def wordmark(cx, y, size, fill="url(#gold)", outline="#2a1d08", flourish=True):
    d, w = tp("FOLIO", "cz9", size, cx, y, 0.14, "middle")
    g = f'<path d="{d}" fill="none" stroke="{outline}" stroke-width="{size*.05:.1f}" stroke-linejoin="round"/><path d="{d}" fill="{fill}" filter="url(#emboss)"/>'
    if flourish:
        for sgn in (-1, 1):
            x0 = cx + sgn * (w / 2 + size * .12)
            x1 = cx + sgn * (w / 2 + size * .95)
            ym = y - size * .36
            g += (f'<path d="M{x0:.1f},{ym:.1f} C{x0+sgn*size*.25:.1f},{ym-size*.18:.1f} {x0+sgn*size*.45:.1f},{ym+size*.18:.1f} {x1:.1f},{ym:.1f}" fill="none" stroke="{fill}" stroke-width="{size*.03:.1f}" stroke-linecap="round"/>'
                  f'<circle cx="{x1:.1f}" cy="{ym:.1f}" r="{size*.045:.1f}" fill="{fill}"/>'
                  f'<path d="M{x0+sgn*size*.2:.1f},{ym+size*.06:.1f} q{sgn*size*.15:.1f},{size*.14:.1f} {sgn*size*.3:.1f},0" fill="none" stroke="{fill}" stroke-width="{size*.02:.1f}"/>')
    return g, w


wm, wmw = wordmark(800, 330, 230)
lock = f'<rect width="1600" height="900" fill="url(#noirR)"/>' + emblem(800, 0, 0, False, False) if False else ""
body = f'<rect width="1600" height="980" fill="url(#noirR)"/>' + emblem(800, 300, 400) + \
       wordmark(800, 760, 190)[0] + T("Pliego de autor", "py", 70, 800, 860, "url(#goldH)") + \
       T("CIGARROS HECHOS A MANO", "cz7", 26, 800, 920, "#C9A24A", tracking=0.35)
svg(1600, 980, body, "folio2-lockup-black.svg")
body = f'<rect width="1600" height="980" fill="url(#ivory)" filter="url(#paper)"/>' + emblem(800, 300, 400) + \
       wordmark(800, 760, 190, fill=RED, outline="#3b0a0a")[0] + T("Pliego de autor", "py", 70, 800, 860, "#5a4012") + \
       T("CIGARROS HECHOS A MANO", "cz7", 26, 800, 920, "#5a4012", tracking=0.35)
svg(1600, 980, body, "folio2-lockup-ivory.svg")
svg(1400, 400, f'<rect width="1400" height="400" fill="url(#noirR)"/>' + wordmark(700, 270, 200)[0], "folio2-wordmark.svg")


# ------------------------------------------------------------------ ANILLA
def cartouche_path(cx, top, bot, w):
    h = bot - top
    return (f"M{cx},{top} C{cx+w*.12},{top+h*.02} {cx+w*.2},{top+h*.1} {cx+w*.28},{top+h*.12} "
            f"C{cx+w*.42},{top+h*.14} {cx+w*.5},{top+h*.2} {cx+w*.5},{top+h*.32} L{cx+w*.5},{top+h*.68} "
            f"C{cx+w*.5},{top+h*.8} {cx+w*.42},{top+h*.86} {cx+w*.28},{top+h*.88} "
            f"C{cx+w*.2},{top+h*.9} {cx+w*.12},{top+h*.98} {cx},{bot} "
            f"C{cx-w*.12},{top+h*.98} {cx-w*.2},{top+h*.9} {cx-w*.28},{top+h*.88} "
            f"C{cx-w*.42},{top+h*.86} {cx-w*.5},{top+h*.8} {cx-w*.5},{top+h*.68} L{cx-w*.5},{top+h*.32} "
            f"C{cx-w*.5},{top+h*.2} {cx-w*.42},{top+h*.14} {cx-w*.28},{top+h*.12} "
            f"C{cx-w*.2},{top+h*.1} {cx-w*.12},{top+h*.02} {cx},{top} Z")


def band(W=1800, field="url(#lacre)", center="url(#noir)", guil="#E28B6F", vitola="OCTAVO", numeral="I", tag="b", txt="url(#goldH)"):
    H, y0, y1 = 340, 80, 260  # cuerpo de la anilla entre y0 e y1; cartela de 0 a H
    cx = W / 2
    g = [f'<rect x="0" y="{y0}" width="{W}" height="{y1-y0}" fill="{field}"/>']
    g.append(f'<clipPath id="bf{tag}"><rect x="0" y="{y0+22}" width="{W}" height="{y1-y0-44}"/></clipPath>')
    g.append(f'<g clip-path="url(#bf{tag})">' + waves(0, W, y0 + 22, y1 - 22, 46, 10, guil, .9, .45) + "</g>")
    for yy in (y0, y1 - 22):
        g.append(f'<rect x="0" y="{yy}" width="{W}" height="22" fill="url(#gold)"/>')
        g.append(beads(8, W, yy + 11, 4.2, 14, "#6a4c14"))
    g.append(f'<rect x="0" y="{y0+24}" width="{W}" height="2" fill="url(#goldH)" opacity=".8"/><rect x="0" y="{y1-26}" width="{W}" height="2" fill="url(#goldH)" opacity=".8"/>')
    # medallones laterales
    for sgn in (-1, 1):
        mx = cx + sgn * 330
        my = (y0 + y1) / 2
        g.append(f'<circle cx="{mx}" cy="{my}" r="70" fill="url(#gold)" filter="url(#emboss)"/><circle cx="{mx}" cy="{my}" r="60" fill="url(#noirR)"/>')
        g.append(beads_ellipse(mx, my, 65, 65, 3, 36, "#6a4c14"))
        g.append(T("F", "py", 104, mx - 2, my + 34, "url(#gold)", extra='filter="url(#emboss)"'))
        tx = cx + sgn * 600
        g.append(T("HECHO A MANO" if sgn < 0 else vitola, "cz7", 24, tx, my + 9, txt, tracking=.28))
        g.append(f'<rect x="{tx-140}" y="{my-32}" width="280" height="1.6" fill="{txt}"/><rect x="{tx-140}" y="{my+26}" width="280" height="1.6" fill="{txt}"/>')
        g.append(fleuron(cx + sgn * 860, my, 34, 45 if sgn < 0 else -135))
    # cartela central
    g.append(f'<path d="{cartouche_path(cx, 0, H, 450)}" fill="url(#gold)" filter="url(#shadow)"/>')
    g.append(f'<path d="{cartouche_path(cx, 12, H-12, 424)}" fill="#3a2a10"/>')
    g.append(f'<path d="{cartouche_path(cx, 16, H-16, 416)}" fill="{center}"/>')
    g.append(f'<clipPath id="cc{tag}"><path d="{cartouche_path(cx, 16, H-16, 416)}"/></clipPath>')
    g.append(f'<g clip-path="url(#cc{tag})">' + spiro(cx, H / 2, 110, 22, 30, 8, "#C9A24A", .55, .14, rx=1.65, ry=1.2) + "</g>")
    g.append(f'<path d="{cartouche_path(cx, 30, H-30, 388)}" fill="none" stroke="url(#gold)" stroke-width="2.5"/>')
    g.append(T("PLIEGO", "cz7", 20, cx, 112, "url(#goldH)", tracking=.5))
    g.append(wordmark(cx, 210, 86, flourish=False)[0])
    g.append(T(f"Nº {numeral}", "pf4i", 28, cx, 252, "url(#goldH)"))
    # estrella superior e inferior
    for yy in (24, H - 24):
        g.append(f'<circle cx="{cx}" cy="{yy}" r="7" fill="url(#goldR)"/>')
    return "".join(g), W, H


b, W, H = band()
svg(W, H + 40, b, "folio2-band-octavo.svg")
b2, _, _ = band(field="url(#noir)", center="url(#lacre)", guil="#8a6a2a", vitola="CUARTO", numeral="II", tag="c")
svg(W, H + 40, b2, "folio2-band-cuarto.svg")
b3, _, _ = band(field="url(#ivory)", center="url(#lacre)", guil="#C9A24A", vitola="IMPERIAL", numeral="III", tag="i", txt="#8E1B1B")
svg(W, H + 40, b3, "folio2-band-imperial.svg")


# ------------------------------------------------------------------ CIGARRO CON ANILLA
BW = 1800          # longitud del desarrollo de la anilla
VIS = BW * 0.9 / math.pi   # parte visible de frente (= diámetro)


def band_symbol(id_, bandsvg):
    """Símbolo con la parte frontal visible de la anilla, centrado en el origen."""
    return (f'<defs><clipPath id="clip{id_}"><rect x="{BW/2-VIS/2}" y="0" width="{VIS}" height="340"/></clipPath>'
            f'<g id="{id_}"><g transform="translate({-BW/2},-170)" clip-path="url(#clip{id_})">{bandsvg}</g></g></defs>')


def cigar_v(x, y, L, d, bid):
    """Cigarro en pie (cabeza arriba). La anilla rodea el cigarro: se ve su frente."""
    r = d / 2
    body = f"M{x},{y+L} L{x},{y+r} A{r},{r} 0 0 1 {x+d},{y+r} L{x+d},{y+L} Z"
    cid = f"cv{bid}{int(x)}"
    g = f'<g filter="url(#shadow)"><path d="{body}" fill="url(#leafV)"/><clipPath id="{cid}"><path d="{body}"/></clipPath><g clip-path="url(#{cid})">'
    g += f'<rect x="{x}" y="{y}" width="{d}" height="{L}" filter="url(#grainV)" opacity=".9"/>'
    for i in range(9):
        yv = y + L * (.1 + i * .1)
        g += f'<path d="M{x},{yv:.1f} q{d*.5:.1f},{-d*.35:.1f} {d},{-d*.12:.1f}" fill="none" stroke="#2e1a0c" stroke-width="1.3" opacity=".3"/>'
    s_ = d / VIS
    g += f'<use href="#{bid}" transform="translate({x+r},{y+L*.2}) scale({s_:.4f})"/>'
    g += "</g>"
    g += f'<path d="{body}" fill="url(#cylV)"/>'
    g += f'<ellipse cx="{x+r}" cy="{y+L}" rx="{r}" ry="{r*.16}" fill="#5a3820"/><ellipse cx="{x+r}" cy="{y+L}" rx="{r*.8}" ry="{r*.11}" fill="#3a2414"/></g>'
    return g


def cigar_h(x, y, L, d, bid):
    """Cigarro tumbado visto desde arriba (en la caja): la anilla cruza el cigarro, girada 90°."""
    r = d / 2
    body = f"M{x},{y} L{x+L-r},{y} A{r},{r} 0 0 1 {x+L-r},{y+d} L{x},{y+d} Z"
    cid = f"ch{bid}{int(y)}"
    g = f'<path d="{body}" fill="url(#leaf)"/><clipPath id="{cid}"><path d="{body}"/></clipPath><g clip-path="url(#{cid})">'
    g += f'<rect x="{x}" y="{y}" width="{L}" height="{d}" filter="url(#grain)" opacity=".85"/>'
    g += f'<use href="#{bid}" transform="translate({x+L*.84},{y+r}) rotate(-90) scale({d/VIS:.4f})"/></g>'
    g += f'<path d="{body}" fill="url(#cyl)" opacity=".8"/>'
    return g


EXTRA_DEFS = """<defs>
<linearGradient id="leafV" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#4E2F1A"/><stop offset=".35" stop-color="#9A6638"/><stop offset=".55" stop-color="#8B5A32"/><stop offset="1" stop-color="#3E2414"/></linearGradient>
<linearGradient id="cylV" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity=".6"/><stop offset=".2" stop-color="#000" stop-opacity=".05"/><stop offset=".34" stop-color="#fff" stop-opacity=".22"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".65"/></linearGradient>
<filter id="grainV"><feTurbulence type="fractalNoise" baseFrequency="0.25 0.012" numOctaves="3" seed="5"/><feColorMatrix type="matrix" values="0 0 0 0 .25  0 0 0 0 .13  0 0 0 0 .05  0 0 0 .35 0"/></filter>
</defs>"""

syms = EXTRA_DEFS + band_symbol("bO", b) + band_symbol("bC", b2) + band_symbol("bI", b3)
trio = syms + '<rect width="1600" height="1500" fill="url(#noirR)"/>'
for i, (bid, L, d, n1, n2) in enumerate((("bO", 760, 150, "OCTAVO", "Robusto"), ("bC", 940, 150, "CUARTO", "Toro"), ("bI", 1100, 140, "IMPERIAL", "Churchill"))):
    x = 340 + i * 400
    trio += cigar_v(x, 1300 - L, L, d, bid)
    trio += T(n1, "cz7", 34, x + d / 2, 1390, "url(#goldH)", tracking=.25) + T(n2, "pf4i", 30, x + d / 2, 1436, "#C9A24A")
svg(1600, 1500, trio, "folio2-cigars-mockup.svg")


# ------------------------------------------------------------------ VISTA (litografía interior de tapa)
def vista(W=1800, H=1100):
    g = [f'<rect width="{W}" height="{H}" fill="url(#lacre)"/>']
    g.append(f'<rect x="0" y="0" width="{W}" height="{H}" fill="url(#lacre)" filter="url(#paper)"/>')
    # marco
    m = 40
    g.append(f'<rect x="{m}" y="{m}" width="{W-2*m}" height="{H-2*m}" fill="none" stroke="url(#gold)" stroke-width="10"/>')
    g.append(f'<rect x="{m+22}" y="{m+22}" width="{W-2*m-44}" height="{H-2*m-44}" fill="none" stroke="url(#gold)" stroke-width="2.5"/>')
    g.append(rope(m + 30, W - m - 30, m + 11, 18) + rope(m + 30, W - m - 30, H - m - 11, 18))
    for (x, y) in ((m + 11, m + 11), (W - m - 11, m + 11), (W - m - 11, H - m - 11), (m + 11, H - m - 11)):
        g.append(f'<circle cx="{x}" cy="{y}" r="46" fill="url(#gold)" filter="url(#emboss)"/><circle cx="{x}" cy="{y}" r="36" fill="url(#noirR)"/>')
        g.append(spiro(x, y, 30, 8, 9, 6, "#C9A24A", .7, .6))
        g.append(f'<circle cx="{x}" cy="{y}" r="6" fill="url(#goldR)"/>')
    # campo central crema con rayos
    cx, cy = W / 2, H * .47
    g.append(f'<ellipse cx="{cx}" cy="{cy}" rx="{W*.36}" ry="{H*.38}" fill="url(#ivory)" stroke="url(#gold)" stroke-width="8" filter="url(#shadow)"/>')
    g.append(f'<clipPath id="vc"><ellipse cx="{cx}" cy="{cy}" rx="{W*.36-6}" ry="{H*.38-6}"/></clipPath>')
    g.append(f'<g clip-path="url(#vc)">' + sunburst(cx, cy, 40, 900, 96, "#C9A24A", .28) + spiro(cx, cy, 420, 36, 70, 8, "#8E1B1B", .7, .14, rx=1.5) + "</g>")
    g.append(f'<ellipse cx="{cx}" cy="{cy}" rx="{W*.36-24}" ry="{H*.38-24}" fill="none" stroke="#8E1B1B" stroke-width="2"/>')
    g.append(emblem(cx, cy - 40, 520, motto=False))
    # paneles laterales con texto
    for sgn, l1, l2 in ((-1, "CIGARROS", "HECHOS A MANO"), (1, "EDICIÓN", "NUMERADA")):
        px = cx + sgn * W * .405
        g.append(f'<rect x="{px-150}" y="{cy-120}" width="300" height="240" rx="6" fill="url(#noir)" stroke="url(#gold)" stroke-width="5"/>')
        g.append(f'<rect x="{px-136}" y="{cy-106}" width="272" height="212" fill="none" stroke="url(#gold)" stroke-width="1.5"/>')
        g.append(T(l1, "cz7", 30, px, cy - 18, "url(#goldH)", tracking=.2) + T(l2, "cz7", 21, px, cy + 26, "url(#goldH)", tracking=.12))
        g.append(T("~ ✦ ~".replace("✦", "·"), "cz7", 30, px, cy + 74, "url(#goldH)"))
    # banda superior con wordmark
    g.append(f'<path d="M{cx-560},{H*.10} L{cx+560},{H*.10} L{cx+610},{H*.17} L{cx+560},{H*.24} L{cx-560},{H*.24} L{cx-610},{H*.17} Z" fill="url(#noir)" stroke="url(#gold)" stroke-width="6" filter="url(#shadow)"/>')
    g.append(wordmark(cx, H * .215, 130)[0])
    # cinta inferior con lema y script
    g.append(ribbon(cx, H * .755, 640, 92, "SCRIPTA MANENT", size=40))
    g.append(T("Pliego de autor", "py", 60, cx, H * .915, "url(#goldH)"))
    return "".join(g)


svg(1800, 1100, vista(), "folio2-vista-litho.svg")


# ------------------------------------------------------------------ CAJA ABIERTA (mockup)
def box_mockup():
    W, H = 2000, 2050
    g = [f'<rect width="{W}" height="{H}" fill="#1a1411"/>']
    # tapa abierta (vista)
    g.append(f'<g transform="translate(100,60)"><rect x="-20" y="-20" width="1840" height="1140" fill="url(#cedar)" filter="url(#shadow)"/>'
             f'<rect x="-20" y="-20" width="1840" height="1140" filter="url(#grain)" opacity=".7"/>' + vista() + '</g>')
    # bandeja con cigarros
    bx, by, bw, bh = 100, 1230, 1800, 760
    g.append(f'<rect x="{bx-20}" y="{by-20}" width="{bw+40}" height="{bh+40}" fill="url(#cedar)" filter="url(#shadow)"/>')
    g.append(f'<rect x="{bx-20}" y="{by-20}" width="{bw+40}" height="{bh+40}" filter="url(#grain)" opacity=".8"/>')
    g.append(f'<rect x="{bx}" y="{by}" width="{bw}" height="{bh}" fill="#6e4426"/>')
    # filete (habilitación) del borde: tira dorada y roja
    g.append(f'<rect x="{bx-20}" y="{by-20}" width="{bw+40}" height="16" fill="url(#gold)"/><rect x="{bx-20}" y="{by-4}" width="{bw+40}" height="6" fill="{RED}"/>')
    d = 70
    for i in range(10):
        g.append(cigar_h(bx + 40, by + 20 + i * (d + 3), 1720, d, "bO"))
    # papel de cubierta (hoja de cedro sobre parte de los cigarros)
    g.append(f'<path d="M{bx},{by} L{bx+380},{by} L{bx+300},{by+bh} L{bx},{by+bh} Z" fill="#d9b48a" opacity=".93"/>')
    g.append(f'<path d="M{bx},{by} L{bx+380},{by} L{bx+300},{by+bh} L{bx},{by+bh} Z" filter="url(#grain)" opacity=".5"/>')
    g.append(f'<g transform="translate({bx+160},{by+bh/2}) rotate(-84)">' + T("FOLIO", "cz9", 64, 0, 0, "#8a5a30", tracking=.3) + "</g>")
    return "".join(g), W, H


bx_body, W, H = box_mockup()
svg(W, H, EXTRA_DEFS + band_symbol("bO", b) + bx_body, "folio2-box-open-mockup.svg")


# ------------------------------------------------------------------ CUBIERTA (exterior de la caja)
def box_top():
    W, H = 1800, 1250
    g = [f'<rect width="{W}" height="{H}" fill="url(#cedar)"/><rect width="{W}" height="{H}" filter="url(#grain)"/>']
    # filetes en bordes
    for (x, y, w, h) in ((0, 0, W, 26), (0, H - 26, W, 26), (0, 0, 26, H), (W - 26, 0, 26, H)):
        g.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="url(#gold)"/>')
    g.append(f'<rect x="26" y="26" width="{W-52}" height="8" fill="{RED}"/><rect x="26" y="{H-34}" width="{W-52}" height="8" fill="{RED}"/>')
    # etiqueta central
    lx, ly, lw, lh = 330, 110, 1140, 660
    g.append(f'<rect x="{lx}" y="{ly}" width="{lw}" height="{lh}" fill="url(#noir)" stroke="url(#gold)" stroke-width="8" filter="url(#shadow)"/>')
    g.append(f'<clipPath id="lt"><rect x="{lx}" y="{ly}" width="{lw}" height="{lh}"/></clipPath><g clip-path="url(#lt)">' + spiro(lx + lw / 2, ly + lh / 2, 330, 32, 60, 8, "#C9A24A", .7, .14, rx=1.7) + "</g>")
    g.append(f'<rect x="{lx+22}" y="{ly+22}" width="{lw-44}" height="{lh-44}" fill="none" stroke="url(#gold)" stroke-width="2"/>')
    g.append(emblem(lx + lw / 2, ly + 250, 300, motto=False))
    g.append(wordmark(lx + lw / 2, ly + 540, 120)[0])
    g.append(T("OCTAVO · 10 CIGARROS", "cz7", 26, lx + lw / 2, ly + 610, "url(#goldH)", tracking=.3))
    # sello en seco y advertencia sanitaria
    g.append(f'<rect x="200" y="860" width="{W-400}" height="300" fill="#ffffff" stroke="{BLACK}" stroke-width="4"/>')
    g.append(T("ZONA RESERVADA A LA ADVERTENCIA SANITARIA", "in5", 36, W / 2, 1000, BLACK, tracking=.06))
    g.append(T("Texto y superficie conforme RD 579/2017 — validar porcentaje exacto con asesor regulatorio", "in4", 26, W / 2, 1056, "#555"))
    return "".join(g), W, H


bt, W, H = box_top()
svg(W, H, bt, "folio2-box-top.svg")


# ------------------------------------------------------------------ SELLO DE PLIEGO (no imita el sello de Habanos)
W, H = 2200, 170
g = f'<rect width="{W}" height="{H}" fill="url(#lacre)"/>' + waves(0, W, 30, 140, 38, 9, "#E28B6F", .8, .5)
g += f'<rect x="0" y="0" width="{W}" height="16" fill="url(#gold)"/><rect x="0" y="{H-16}" width="{W}" height="16" fill="url(#gold)"/>'
g += f'<rect x="{W/2-330}" y="22" width="660" height="126" fill="url(#noir)" stroke="url(#gold)" stroke-width="4"/>'
g += T("FOLIO · PLIEGO Nº I", "cz7", 46, W / 2, 102, "url(#goldH)", tracking=.2)
g += T("CAJA 0001 / 0500", "cz7", 30, 240, 98, IVORY, tracking=.2) + T("CONTROL DE PLIEGO", "cz7", 30, W - 260, 98, IVORY, tracking=.2)
svg(W, H, g, "folio2-pliego-seal.svg")


# ------------------------------------------------------------------ COLOFÓN v2
W, H = 1000, 1400
g = f'<rect width="{W}" height="{H}" fill="url(#ivory)" filter="url(#paper)"/>'
g += f'<rect x="40" y="40" width="{W-80}" height="{H-80}" fill="none" stroke="{RED}" stroke-width="4"/><rect x="58" y="58" width="{W-116}" height="{H-116}" fill="none" stroke="#C9A24A" stroke-width="1.5"/>'
g += emblem(500, 280, 300, motto=False)
g += T("COLOFÓN", "cz9", 56, 500, 560, RED, tracking=.3)
g += f'<path d="M330,590 L670,590" stroke="#C9A24A" stroke-width="2"/>'
yy = 670
for t, f_, sz in (("Esta caja pertenece al", "felli", 40), ("PLIEGO Nº ____", "cz7", 44), ("de la vitola OCTAVO,", "felli", 38),
                  ("torcido a mano el ___ / ___ / ______", "fell", 36), ("en la fábrica ______________________", "fell", 36),
                  ("Caja nº ______ de ______", "cz7", 38), ("Control de calidad: ____________", "fell", 34)):
    g += T(t, f_, sz, 500, yy, "#2a1d10")
    yy += 86
g += T("Documento de trazabilidad · sin finalidad promocional", "in4", 20, 500, H - 90, "#7a6a55")
svg(W, H, g, "folio2-colophon.svg")

# ------------------------------------------------------------------ PALETA
pal = [("Lacre", "#8E1B1B"), ("Lacre profundo", "#5E0F0F"), ("Negro tabaco", "#14100D"), ("Oro (foil)", "#C9A24A"),
       ("Marfil litografía", "#F4EBD8"), ("Cedro", "#A86F42"), ("Hoja", "#7A4E2E")]
g = ""
for i, (n, c) in enumerate(pal):
    fill = "url(#gold)" if "Oro" in n else c
    g += f'<rect x="{i*190}" y="0" width="175" height="220" fill="{fill}" stroke="#bbb"/>' + T(n, "in5", 20, i * 190 + 6, 252, BLACK, anchor="start") + T(c, "in4", 18, i * 190 + 6, 280, "#666", anchor="start")
svg(1330, 300, g, "folio2-palette.svg")
print("v2 ok", len([f for f in os.listdir(OUT) if f.startswith('folio2')]))
