# -*- coding: utf-8 -*-
"""ARNALDO · Anilla clásica (diseño de la casa, elegido por el promotor el 13/10/2026) — arte de imprenta.

Redibujo del render «anilla clásica» (01_BRAND/renders/arnaldo-render-anilla-clasica.png) con criterios de
diseño de producción:
  · proporciones reales: desarrollo 72 × 16 mm para cepo 50, óvalo troquelado 23 × 20 mm (escala 20 px = 1 mm);
  · colores planos de imprenta (lacre, negro laca) y oro como foil, sin brillos de pantalla;
  · grabado fino: perlado en relieve seco, guilloché en red en el marco del óvalo, ondas tono sobre tono;
  · ARNALDO en capitales romanas (Cinzel) en arco suave y la firma debajo.
Sin monograma ni emblema: la firma hace de signo. La firma es PROVISIONAL (Pinyon Script, OFL 1.1, como en la foto de referencia) hasta
tener la firma real de Arnaldo vectorizada. Todo el texto va en trazados.
Uso: python3 brand_clasica.py DIR_SALIDA"""
import os, sys, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from brand_lib import tp, T, FONTS

OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)
MM = 20                                   # px por mm en las piezas de anilla
LACRE, LACRE_D, NOIR, MARFIL = "#8C1D1A", "#5E1110", "#0F0C0A", "#F3EAD6"
INK_GOLD = "#6E5218"                      # trazo del grabado sobre el oro

DEFS = """<defs>
<linearGradient id="foil" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#B08A3E"/><stop offset=".38" stop-color="#E4C981"/><stop offset=".62" stop-color="#CBA552"/><stop offset="1" stop-color="#9E7A31"/></linearGradient>
<radialGradient id="pearl" cx=".35" cy=".3" r=".75"><stop offset="0" stop-color="#F6E3A8"/><stop offset=".55" stop-color="#C9A24A"/><stop offset="1" stop-color="#7A5A1C"/></radialGradient>
<radialGradient id="laca" cx=".42" cy=".28" r=".9"><stop offset="0" stop-color="#2B2522"/><stop offset=".5" stop-color="#14110F"/><stop offset="1" stop-color="#070605"/></radialGradient>
<linearGradient id="lacreF" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7E1917"/><stop offset=".5" stop-color="#8C1D1A"/><stop offset="1" stop-color="#761715"/></linearGradient>
<linearGradient id="marfilF" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F7F0E0"/><stop offset="1" stop-color="#EBDFC5"/></linearGradient>
<linearGradient id="noirF" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1B1714"/><stop offset=".5" stop-color="#110E0C"/><stop offset="1" stop-color="#0A0807"/></linearGradient>
<filter id="relieve" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur in="SourceAlpha" stdDeviation=".5" result="b"/><feOffset in="b" dx=".6" dy=".8" result="o"/><feFlood flood-color="#000" flood-opacity=".55"/><feComposite in2="o" operator="in" result="s"/><feMerge><feMergeNode in="s"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
<filter id="sombra" x="-10%" y="-10%" width="120%" height="130%"><feGaussianBlur in="SourceAlpha" stdDeviation="5"/><feOffset dy="5"/><feComponentTransfer><feFuncA type="linear" slope=".35"/></feComponentTransfer><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>
<filter id="papel" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="5"/><feColorMatrix type="matrix" values="0 0 0 0 .3  0 0 0 0 .22  0 0 0 0 .12  0 0 0 .06 0"/><feComposite in2="SourceGraphic" operator="in"/><feMerge><feMergeNode in="SourceGraphic"/><feMergeNode/></feMerge></filter>
</defs>"""


def svg(w, h, body, name, bg=None):
    s = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}">{DEFS}'
    if bg:
        s += f'<rect width="{w}" height="{h}" fill="{bg}"/>'
    open(os.path.join(OUT, name), "w").write(s + body + "</svg>")


# ------------------------------------------------------------------ primitivas de grabado
def pearls_line(x0, x1, y, r, gap):
    out, x = [], x0
    while x <= x1:
        out.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r}" fill="url(#pearl)"/>')
        x += gap
    return "".join(out)


def pearls_ellipse(cx, cy, rx, ry, r, gap):
    per = math.pi * (3 * (rx + ry) - math.sqrt((3 * rx + ry) * (rx + 3 * ry)))
    n = int(per / gap)
    return "".join(f'<circle cx="{cx + rx * math.cos(2*math.pi*i/n):.1f}" cy="{cy + ry * math.sin(2*math.pi*i/n):.1f}" r="{r}" fill="url(#pearl)"/>' for i in range(n))


def lattice_ring(cx, cy, rx0, ry0, rx1, ry1, step, stroke, sw, tag):
    """Red de rombos (guilloché en red) recortada al anillo entre dos elipses, con punto en cada cruce."""
    cid = f"lr{tag}"
    g = [f'<clipPath id="{cid}"><path fill-rule="evenodd" d="M{cx-rx1},{cy} a{rx1},{ry1} 0 1,0 {2*rx1},0 a{rx1},{ry1} 0 1,0 {-2*rx1},0 Z '
         f'M{cx-rx0},{cy} a{rx0},{ry0} 0 1,0 {2*rx0},0 a{rx0},{ry0} 0 1,0 {-2*rx0},0 Z"/></clipPath><g clip-path="url(#{cid})">']
    n = int(2 * rx1 / step) + 4
    for k in range(-n, n + 1):
        x = cx + k * step
        g.append(f'<line x1="{x - ry1:.1f}" y1="{cy - ry1:.1f}" x2="{x + ry1:.1f}" y2="{cy + ry1:.1f}" stroke="{stroke}" stroke-width="{sw}"/>')
        g.append(f'<line x1="{x + ry1:.1f}" y1="{cy - ry1:.1f}" x2="{x - ry1:.1f}" y2="{cy + ry1:.1f}" stroke="{stroke}" stroke-width="{sw}"/>')
    g.append("</g>")
    return "".join(g)


def rosette_ring(cx, cy, rx0, ry0, rx1, ry1, n, k, stroke, sw):
    """Guilloché de roseta entre dos elipses: n curvas onduladas (k lóbulos) desfasadas y escalonadas."""
    out = []
    for j in range(n):
        f = (j + .5) / n
        rx, ry = rx0 + (rx1 - rx0) * f, ry0 + (ry1 - ry0) * f
        amp = (rx1 - rx0) * .55
        ph = j * math.pi / n * 2
        pts = []
        for i in range(1441):
            t = 2 * math.pi * i / 1440
            d = amp * math.sin(k * t + ph)
            pts.append(f"{cx + (rx + d) * math.cos(t):.2f},{cy + (ry + d * ry / rx) * math.sin(t):.2f}")
        out.append(f'<polyline points="{" ".join(pts)}" fill="none" stroke="{stroke}" stroke-width="{sw}"/>')
    return "".join(out)


def waves_tone(x0, x1, y0, y1, period, n, stroke, sw):
    out, amp, ym = [], (y1 - y0) * .42, (y0 + y1) / 2
    for j in range(n):
        ph = 2 * math.pi * j / n
        pts, x = [], x0
        while x <= x1:
            pts.append(f"{x:.1f},{ym + amp * math.sin(2*math.pi*x/period + ph):.2f}")
            x += 2
        out.append(f'<polyline points="{" ".join(pts)}" fill="none" stroke="{stroke}" stroke-width="{sw}"/>')
    return "".join(out)


def scroll(cx, cy, s, flip=1):
    """Remate de filigrana (volutas en C enfrentadas y rombo central), en foil."""
    out = []
    for sx in (-1, 1):
        d = (f"M{sx*s*.08},0 C{sx*s*.32},{-flip*s*.05} {sx*s*.55},{-flip*s*.24} {sx*s*.82},{-flip*s*.16} "
             f"C{sx*s*1.02},{-flip*s*.1} {sx*s*1.02},{flip*s*.13} {sx*s*.86},{flip*s*.15} "
             f"C{sx*s*.76},{flip*s*.16} {sx*s*.72},{flip*s*.06} {sx*s*.8},{flip*s*.03}")
        out.append(f'<path d="{d}" fill="none" stroke="url(#foil)" stroke-width="{s*.055:.2f}" stroke-linecap="round"/>')
        out.append(f'<path d="M{sx*s*.1},{flip*s*.04} C{sx*s*.28},{flip*s*.16} {sx*s*.48},{flip*s*.15} {sx*s*.58},{flip*s*.07}" fill="none" stroke="url(#foil)" stroke-width="{s*.04:.2f}" stroke-linecap="round"/>')
    out.append(f'<path d="M0,{-flip*s*.17} L{s*.075},0 L0,{flip*s*.17} L{-s*.075},0 Z" fill="url(#foil)"/>')
    return f'<g transform="translate({cx},{cy})">{"".join(out)}</g>'


def arch(txt, font, size, cx, base_y, R, fill, tracking=0.06, extra=""):
    """Texto en arco simétrico; el punto más alto de la línea de base es (cx, base_y)."""
    f = FONTS[font]
    cmap, sc = f.getBestCmap(), size / f["head"].unitsPerEm
    ws = [f["hmtx"][cmap[ord(c)]][0] * sc for c in txt]
    tot = sum(ws) + tracking * size * (len(txt) - 1)
    out, acc = [], -tot / 2
    for c, w in zip(txt, ws):
        th = (acc + w / 2) / R
        x, y = cx + R * math.sin(th), base_y + R * (1 - math.cos(th))
        d, _ = tp(c, font, size, 0, 0, 0, "middle")
        out.append(f'<path d="{d}" fill="{fill}" {extra} transform="translate({x:.2f},{y:.2f}) rotate({math.degrees(th):.2f})"/>')
        acc += w + tracking * size
    return "".join(out)


def firma(cx, cy, size, fill="url(#foil)", rot=-6):
    """Firma PROVISIONAL (caligrafía manuscrita tipográfica) con rúbrica; se sustituirá por la firma real."""
    d, w = tp("Arnaldo", "py", size, 0, 0, 0.0, "middle")
    ru = (f'<path d="M{-w*.42:.1f},{size*.16:.1f} C{-w*.15:.1f},{size*.12:.1f} {w*.2:.1f},{size*.08:.1f} {w*.46:.1f},{-size*.04:.1f}" '
          f'fill="none" stroke="{fill}" stroke-width="{size*.032:.2f}" stroke-linecap="round"/>')
    return f'<g transform="translate({cx},{cy}) rotate({rot})"><path d="{d}" fill="{fill}"/>{ru}</g>'


# ------------------------------------------------------------------ óvalo de la casa
def medallon(cx, cy, rx, ry, tag, name=True):
    s = rx / 270.0                                            # escala relativa al óvalo de la anilla
    g = [f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="url(#foil)" stroke="{INK_GOLD}" stroke-width="{.9*s:.2f}" filter="url(#sombra)"/>']
    g.append(f'<ellipse cx="{cx}" cy="{cy}" rx="{rx-4*s}" ry="{ry-4*s}" fill="none" stroke="{INK_GOLD}" stroke-width="{.6*s:.2f}"/>')
    g.append(pearls_ellipse(cx, cy, rx - 10 * s, ry - 10 * s, 3.1 * s, 9.5 * s))
    g.append(f'<ellipse cx="{cx}" cy="{cy}" rx="{rx-17*s}" ry="{ry-17*s}" fill="none" stroke="{INK_GOLD}" stroke-width="{.7*s:.2f}"/>')
    g.append(lattice_ring(cx, cy, rx - 48 * s, ry - 48 * s, rx - 19 * s, ry - 19 * s, 7.5 * s, INK_GOLD, f"{min(1.1*s, 1.6):.2f}", tag))
    g.append(f'<ellipse cx="{cx}" cy="{cy}" rx="{rx-50*s}" ry="{ry-50*s}" fill="none" stroke="{INK_GOLD}" stroke-width="{.7*s:.2f}"/>')
    g.append(f'<ellipse cx="{cx}" cy="{cy}" rx="{rx-52*s}" ry="{ry-52*s}" fill="{LACRE_D}"/>')
    g.append(f'<ellipse cx="{cx}" cy="{cy}" rx="{rx-57*s}" ry="{ry-57*s}" fill="url(#foil)"/>')
    irx, iry = rx - 60 * s, ry - 60 * s
    g.append(f'<ellipse cx="{cx}" cy="{cy}" rx="{irx}" ry="{iry}" fill="url(#laca)"/>')
    g.append(f'<ellipse cx="{cx}" cy="{cy}" rx="{irx-8*s}" ry="{iry-8*s}" fill="none" stroke="url(#foil)" stroke-width="{.8*s:.2f}"/>')
    g.append(scroll(cx, cy - ry + 3 * s, 46 * s, 1) + scroll(cx, cy + ry - 3 * s, 46 * s, -1))
    if name:
        g.append(arch("ARNALDO", "cz7", 59 * s, cx, cy - 4 * s, 760 * s, "url(#foil)", tracking=.07, extra='filter="url(#relieve)"'))
        g.append(firma(cx + 4 * s, cy + 70 * s, 66 * s))
    return "".join(g)


# ------------------------------------------------------------------ anilla (desarrollo plano)
BAND_W, BAND_H, BAND_CY, BODY_H = 72 * MM, 24 * MM, 12 * MM, 16 * MM
OVAL_RX, OVAL_RY = 11.5 * MM, 10 * MM


def band(field="url(#lacreF)", tone=LACRE_D, tag="n1", line="url(#foil)"):
    W, H, cy = BAND_W, BAND_H, BAND_CY
    y0, y1 = cy - BODY_H / 2, cy + BODY_H / 2
    cx = W / 2
    g = [f'<rect x="0" y="{y0}" width="{W}" height="{BODY_H}" fill="{field}"/>',
         f'<rect x="0" y="{y0}" width="{W}" height="{BODY_H}" fill="{field}" filter="url(#papel)" opacity=".8"/>']
    g.append(f'<clipPath id="tb{tag}"><rect x="0" y="{y0+34}" width="{W}" height="{BODY_H-68}"/></clipPath>')
    g.append(f'<g clip-path="url(#tb{tag})" opacity=".55">' + waves_tone(0, W, y0 + 40, y1 - 40, 46, 7, tone, .7) + "</g>")
    for top in (True, False):
        yb = y0 if top else y1 - 9
        g.append(f'<rect x="0" y="{yb}" width="{W}" height="9" fill="url(#foil)"/>')
        yp = y0 + 18 if top else y1 - 18
        g.append(pearls_line(5, W, yp, 3.1, 9.5))
        yl = y0 + 27 if top else y1 - 28.4
        g.append(f'<rect x="0" y="{yl}" width="{W}" height="1.4" fill="{line}"/>')
    g.append(medallon(cx, cy, OVAL_RX, OVAL_RY, tag))
    return "".join(g), W, H


def band2(field="url(#lacreF)"):
    """Segunda anilla «PLIEGO DE AUTOR»: desarrollo 72 × 7 mm."""
    W, H = BAND_W, 7 * MM
    cx, cy = W / 2, H / 2
    g = [f'<rect width="{W}" height="{H}" fill="{field}"/>']
    for yb in (0, H - 7):
        g.append(f'<rect x="0" y="{yb}" width="{W}" height="7" fill="url(#foil)"/>')
    g.append(f'<rect x="0" y="13" width="{W}" height="1.2" fill="url(#foil)"/><rect x="0" y="{H-14.2}" width="{W}" height="1.2" fill="url(#foil)"/>')
    g.append(T("PLIEGO DE AUTOR", "cz6", 27, cx, cy + 9.5, "url(#foil)", tracking=.3))
    for sgn in (-1, 1):
        x = cx + sgn * 262
        g.append(f'<path d="M{x},{cy-6} L{x+6},{cy} L{x},{cy+6} L{x-6},{cy} Z" fill="url(#foil)"/>')
        g.append(f'<rect x="{min(x + sgn*16, x + sgn*176)}" y="{cy-.6}" width="160" height="1.2" fill="url(#foil)"/>')
    return "".join(g), W, H


# ------------------------------------------------------------------ hoja de especificación
def spec_sheet():
    """Anilla Nº 1 y segunda anilla a escala, con cotas y notas de producción (propuesta)."""
    W, H = 1900, 1150
    ox, oy = 230, 150
    b, bw, bh = band()
    p, pw, ph_ = band2()
    ink = "#5B5148"
    g = [f'<rect width="{W}" height="{H}" fill="#FBF7EF"/>',
         f'<g transform="translate({ox},{oy})">{b}</g>', f'<g transform="translate({ox},{oy + bh + 40})">{p}</g>']

    def dim_h(x0, x1, y, label):
        return (f'<line x1="{x0}" y1="{y}" x2="{x1}" y2="{y}" stroke="{ink}" stroke-width="1"/>'
                f'<line x1="{x0}" y1="{y-8}" x2="{x0}" y2="{y+8}" stroke="{ink}" stroke-width="1"/><line x1="{x1}" y1="{y-8}" x2="{x1}" y2="{y+8}" stroke="{ink}" stroke-width="1"/>'
                + T(label, "in5", 20, (x0 + x1) / 2, y - 10, ink))

    def dim_v(x, y0, y1, label, side=-1):
        return (f'<line x1="{x}" y1="{y0}" x2="{x}" y2="{y1}" stroke="{ink}" stroke-width="1"/>'
                f'<line x1="{x-8}" y1="{y0}" x2="{x+8}" y2="{y0}" stroke="{ink}" stroke-width="1"/><line x1="{x-8}" y1="{y1}" x2="{x+8}" y2="{y1}" stroke="{ink}" stroke-width="1"/>'
                + T(label, "in5", 20, x + side * 12, (y0 + y1) / 2 + 7, ink, anchor="end" if side < 0 else "start"))
    y_body0, y_body1 = oy + BAND_CY - BODY_H / 2, oy + BAND_CY + BODY_H / 2
    g.append(dim_h(ox, ox + bw, oy - 40, "72 mm · desarrollo (cepo 50 + solape)"))
    g.append(dim_v(ox - 40, y_body0, y_body1, "16 mm"))
    cxo = ox + bw / 2
    g.append(dim_h(cxo - OVAL_RX, cxo + OVAL_RX, oy + bh + 40 + ph_ + 60, f"{2 * OVAL_RX / MM:g} mm · óvalo troquelado"))
    g.append(dim_v(ox + bw + 40, oy + BAND_CY - OVAL_RY, oy + BAND_CY + OVAL_RY, f"{2 * OVAL_RY / MM:g} mm", side=1))
    g.append(dim_v(ox - 40, oy + bh + 40, oy + bh + 40 + ph_, "7 mm"))
    notes = [("Papel", "Estucado mate 90–100 g, fibra larga"), ("Lacre", "Directo, una tinta; a fijar con prueba"),
             ("Negro laca", "Negro enriquecido + UV brillante en reserva"), ("Oro", "Foil en caliente (stamping), un solo oro"),
             ("Perlado", "Relieve seco en registro con el foil"), ("Óvalo", "Troquel de contorno; guilloché grabado en el cliché"),
             ("Firma", "Provisional: se sustituye por la firma real vectorizada")]
    chip = {"Lacre": LACRE, "Negro laca": NOIR, "Oro": "#C9A24A"}
    ny = oy + bh + 40 + ph_ + 150
    for i, (k, v) in enumerate(notes):
        x = ox + (i % 2) * 760
        y = ny + (i // 2) * 52
        g.append(f'<rect x="{x}" y="{y-16}" width="14" height="14" fill="{chip.get(k, "#D8CCB4")}"/>')
        g.append(T(k.upper(), "in5", 17, x + 28, y - 2, LACRE, tracking=.14, anchor="start") + T(v, "in4", 19, x + 190, y - 2, ink, anchor="start"))
    return "".join(g), W, H


# ------------------------------------------------------------------ vista (interior de tapa, 200 × 120 mm a 9 px/mm)
def vista():
    W, H = 1800, 1080
    cx, cy = W / 2, H / 2 - 10
    g = [f'<rect width="{W}" height="{H}" fill="url(#marfilF)"/>', f'<rect width="{W}" height="{H}" fill="url(#marfilF)" filter="url(#papel)"/>']
    rays = []
    for i in range(180):
        a = 2 * math.pi * i / 180
        rays.append(f'<line x1="{cx}" y1="{cy}" x2="{cx + 1400*math.cos(a):.1f}" y2="{cy + 1400*math.sin(a):.1f}" stroke="#D9C9A6" stroke-width="1.1"/>')
    g.append(f'<clipPath id="vf"><rect x="70" y="70" width="{W-140}" height="{H-140}"/></clipPath><g clip-path="url(#vf)" opacity=".7">{"".join(rays)}</g>')
    g.append(f'<rect x="0" y="0" width="{W}" height="{H}" fill="none" stroke="url(#lacreF)" stroke-width="96"/>')
    for m, sw in ((6, 4), (42, 1.6)):
        g.append(f'<rect x="{m}" y="{m}" width="{W-2*m}" height="{H-2*m}" fill="none" stroke="url(#foil)" stroke-width="{sw}"/>')
    g.append(f'<rect x="54" y="54" width="{W-108}" height="{H-108}" fill="none" stroke="url(#foil)" stroke-width="3"/>')
    g.append(f'<rect x="64" y="64" width="{W-128}" height="{H-128}" fill="none" stroke="{LACRE}" stroke-width="1.2"/>')
    g.append(pearls_line(30, W - 24, 25, 3.4, 11) + pearls_line(30, W - 24, H - 25, 3.4, 11))
    for (x, y) in ((24, 24), (W - 24, 24), (W - 24, H - 24), (24, H - 24)):
        g.append(f'<circle cx="{x}" cy="{y}" r="15" fill="url(#foil)"/><circle cx="{x}" cy="{y}" r="9" fill="{LACRE_D}"/><circle cx="{x}" cy="{y}" r="4" fill="url(#pearl)"/>')
    for sgn, l1, l2 in ((-1, "HECHO", "A MANO"), (1, "PLIEGO", "DE AUTOR")):
        px = cx + sgn * 640
        g.append(f'<rect x="{px-125}" y="{cy-62}" width="250" height="124" fill="url(#lacreF)" stroke="url(#foil)" stroke-width="4"/>')
        g.append(f'<rect x="{px-115}" y="{cy-52}" width="230" height="104" fill="none" stroke="url(#foil)" stroke-width="1"/>')
        g.append(T(l1, "cz6", 26, px, cy - 6, "url(#foil)", tracking=.3) + T(l2, "cz6", 26, px, cy + 32, "url(#foil)", tracking=.3))
    g.append(medallon(cx, cy, 470, 366, "vista"))
    return "".join(g), W, H


# ------------------------------------------------------------------ marca a fuego y logotipo
def brand_stamp(ink="#3B2414"):
    W, H = 1400, 560
    cx = W / 2
    g = [f'<g fill="{ink}"><rect x="{cx-540}" y="40" width="1080" height="6"/><rect x="{cx-540}" y="54" width="1080" height="2.4"/>',
         T("ARNALDO", "cz7", 200, cx, 270, ink, tracking=.08),
         f'<rect x="{cx-540}" y="312" width="1080" height="2.4"/><rect x="{cx-540}" y="322" width="1080" height="6"/></g>',
         firma(cx, 440, 170, fill=ink, rot=-4)]
    return "".join(g), W, H


def lockup(fill="url(#foil)", sub="#C9A24A"):
    """Logotipo de la casa: ARNALDO + firma + PLIEGO DE AUTOR."""
    W, H = 1400, 590
    cx = W / 2
    _, tw = tp("PLIEGO DE AUTOR", "cz6", 26, 0, 0, .36, "middle")
    g = [T("ARNALDO", "cz6", 190, cx, 210, fill, tracking=.12),
         firma(cx + 10, 390, 150, fill=fill, rot=-4),
         f'<rect x="{cx - tw/2 - 190}" y="{518}" width="160" height="1.6" fill="{sub}"/><rect x="{cx + tw/2 + 30}" y="{518}" width="160" height="1.6" fill="{sub}"/>',
         T("PLIEGO DE AUTOR", "cz6", 26, cx, 528, sub, tracking=.36)]
    return "".join(g), W, H


if __name__ == "__main__":
    for field, tone, name in (("url(#lacreF)", LACRE_D, "arnaldo-anilla-n1.svg"), ("url(#marfilF)", "#D8C7A0", "arnaldo-anilla-n2.svg"),
                              ("url(#noirF)", "#2A221C", "arnaldo-anilla-n3-negra.svg")):
        b, W, H = band(field=field, tone=tone, tag=name[15:17])
        svg(W, H, b, name)
    p, W, H = band2()
    svg(W, H, p, "arnaldo-anilla-pliego.svg")
    s, W, H = spec_sheet()
    svg(W, H, s, "arnaldo-anilla-especificacion.svg")
    svg(720, 560, medallon(360, 280, 340, 264, "m"), "arnaldo-medallon.svg")
    v, W, H = vista()
    svg(W, H, v, "arnaldo-vista.svg")
    st, W, H = brand_stamp()
    svg(W, H, st, "arnaldo-marca-fuego.svg")
    lk, W, H = lockup()
    svg(W, H, lk, "arnaldo-logotipo-oro.svg")
    lk, W, H = lockup(fill=LACRE, sub=LACRE)
    svg(W, H, lk, "arnaldo-logotipo-lacre.svg")
