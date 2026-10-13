# -*- coding: utf-8 -*-
"""Utilidades vectoriales compartidas (texto a trazados con fuentes OFL 1.1, degradados, guilloché, ornamentos).
Extraídas de brand_v2.py para la Ruta A v4."""
import os, sys, math, random
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

B = os.path.dirname(os.path.abspath(__file__))
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


def svg(w, h, body, name, bg=None, OUT="."):
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


