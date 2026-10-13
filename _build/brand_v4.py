# -*- coding: utf-8 -*-
"""ARNALDO · Ruta A v4 «Montecristo × Hoyo de Monterrey»: arte final vectorial de la habilitación.

Traduce códigos, no elementos protegidos:
  · Hoyo de Monterrey → anilla de dominante blanca/marfil con un medallón rojo al centro y el nombre en
    blanco; segunda anilla de línea («Epicure» → «Pliego de autor»); vista con escena grabada en óvalo.
  · Montecristo → un solo emblema fuerte, nombre en romanas gruesas legibles a distancia, filigrana de oro
    en ondas, paleta reducida y versión oscura.
Sin triángulo de espadas, flor de lis, jardín o fuente, «José Gener», «Habana», escudos, medallas ni fechas.
Todo el texto se convierte a trazados (fuentes OFL 1.1): sin errores de letra posibles.
Uso: python3 brand_v4.py DIR_SALIDA"""
import os, sys, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from brand_lib import (tp, T, DEFS, waves, beads, beads_ellipse, spiro, sunburst, fleuron)

OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)
LACRE, LACRE_D, NOIR, MARFIL, ORO = "#8E1B1B", "#5E0F0F", "#14100D", "#F4EBD8", "#C9A24A"

EXTRA = """<defs>
<radialGradient id="lacreO" cx=".5" cy=".42" r=".62"><stop offset="0" stop-color="#B8322A"/><stop offset=".7" stop-color="#8E1B1B"/><stop offset="1" stop-color="#5A0E0E"/></radialGradient>
<radialGradient id="noirO" cx=".5" cy=".42" r=".62"><stop offset="0" stop-color="#3A302A"/><stop offset=".7" stop-color="#17120F"/><stop offset="1" stop-color="#050403"/></radialGradient>
<linearGradient id="marfilB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFBF1"/><stop offset=".55" stop-color="#F4EBD8"/><stop offset="1" stop-color="#E2D2B0"/></linearGradient>
<linearGradient id="noirB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2A221D"/><stop offset=".5" stop-color="#16110E"/><stop offset="1" stop-color="#060504"/></linearGradient>
</defs>"""


def svg(w, h, body, name, bg=None):
    s = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}">{DEFS}{EXTRA}'
    if bg:
        s += f'<rect width="{w}" height="{h}" fill="{bg}"/>'
    open(os.path.join(OUT, name), "w").write(s + body + "</svg>")


# ------------------------------------------------------------------ EMBLEMA (un solo signo fuerte)
def emblem(cx, cy, s, ground="url(#lacreO)", letter="url(#goldH)", ring=True):
    """Monograma «A» en óvalo vertical con filete doble y perlado. s = alto total."""
    rx, ry = s * .40, s * .5
    g = [f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="url(#gold)" filter="url(#emboss)"/>',
         f'<ellipse cx="{cx}" cy="{cy}" rx="{rx*.86}" ry="{ry*.88}" fill="{ground}"/>']
    if ring:
        g.append(beads_ellipse(cx, cy, rx * .93, ry * .94, s * .0085, 60, "#6a4c14"))
    g.append(f'<clipPath id="em{int(cx)}{int(cy)}"><ellipse cx="{cx}" cy="{cy}" rx="{rx*.86}" ry="{ry*.88}"/></clipPath>')
    g.append(f'<g clip-path="url(#em{int(cx)}{int(cy)})">' + spiro(cx, cy, s * .36, 18, s * .09, 6, ORO, s * .0016, .22, rx=.9, ry=1.15) + "</g>")
    g.append(f'<ellipse cx="{cx}" cy="{cy}" rx="{rx*.76}" ry="{ry*.79}" fill="none" stroke="url(#gold)" stroke-width="{s*.008:.1f}"/>')
    g.append(T("A", "cz9", s * .56, cx, cy + s * .2, letter, extra='filter="url(#emboss)"'))
    return "".join(g)


# ------------------------------------------------------------------ ANILLA PRINCIPAL
def band(W=1800, field="url(#marfilB)", fil="#B8913A", oval="url(#lacreO)", name_fill="#FBF5E8",
         side_fill=LACRE, num="Nº 1", side_r="ROBUSTO", tag="n1", dark=False):
    H, cy = 420, 236
    y0, y1 = cy - 82, cy + 82
    cx = W / 2
    g = [f'<rect x="0" y="{y0}" width="{W}" height="{y1-y0}" fill="{field}"/>']
    if not dark:
        g.append(f'<rect x="0" y="{y0}" width="{W}" height="{y1-y0}" fill="url(#marfilB)" filter="url(#paper)" opacity=".9"/>')
    # filigrana de oro en ondas (código Montecristo), contenida entre filetes
    g.append(f'<clipPath id="f{tag}"><rect x="0" y="{y0+24}" width="{W}" height="{y1-y0-48}"/></clipPath>')
    g.append(f'<g clip-path="url(#f{tag})">' + waves(0, W, y0 + 24, y1 - 24, 52, 8, fil, 1.0, .55 if dark else .5) + "</g>")
    # cantos de oro con perlado y filete interior
    for yy in (y0, y1 - 16):
        g.append(f'<rect x="0" y="{yy}" width="{W}" height="16" fill="url(#gold)"/>')
        g.append(beads(7, W, yy + 8, 3.4, 12, "#6a4c14"))
    line = "#F4EBD8" if dark else LACRE
    g.append(f'<rect x="0" y="{y0+19}" width="{W}" height="2.2" fill="{line}"/><rect x="0" y="{y1-21}" width="{W}" height="2.2" fill="{line}"/>')
    # paneles laterales: texto en romanas, sin ornamento superfluo
    for sgn, txt in ((-1, "HECHO A MANO"), (1, side_r)):
        tx = cx + sgn * 610
        g.append(f'<rect x="{tx-190}" y="{cy-30}" width="380" height="60" fill="{field}"/>')
        for yy in (cy - 30, cy + 28):
            g.append(f'<rect x="{tx-190}" y="{yy}" width="380" height="2" fill="url(#goldH)"/>')
        g.append(T(txt, "cz7", 26, tx, cy + 9.5, side_fill, tracking=.26))
        g.append(fleuron(cx + sgn * 868, cy, 30, 45 if sgn < 0 else -135))
    # medallón central troquelado (código Hoyo): óvalo horizontal rojo con canto de oro perlado
    rx, ry = 362, 150
    g.append(f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="url(#gold)" filter="url(#shadow)"/>')
    g.append(beads_ellipse(cx, cy, rx - 11, ry - 11, 4.2, 120, "#6a4c14"))
    g.append(f'<ellipse cx="{cx}" cy="{cy}" rx="{rx-22}" ry="{ry-22}" fill="{oval}"/>')
    g.append(f'<clipPath id="o{tag}"><ellipse cx="{cx}" cy="{cy}" rx="{rx-22}" ry="{ry-22}"/></clipPath>')
    g.append(f'<g clip-path="url(#o{tag})">' + spiro(cx, cy, 300, 30, 46, 8, ORO, .7, .13, rx=1.25, ry=.55) + "</g>")
    g.append(f'<ellipse cx="{cx}" cy="{cy}" rx="{rx-34}" ry="{ry-34}" fill="none" stroke="#F4EBD8" stroke-width="2.4"/>')
    g.append(f'<ellipse cx="{cx}" cy="{cy}" rx="{rx-42}" ry="{ry-42}" fill="none" stroke="url(#gold)" stroke-width="1.4"/>')
    # emblema arriba, nombre en el eje (código Montecristo), número abajo
    g.append(emblem(cx, cy - 150, 128, ground=oval))
    g.append(T("ARNALDO", "pf9", 100, cx, cy + 40, name_fill, tracking=.07, extra='filter="url(#emboss)"'))
    for sgn in (-1, 1):
        x_a, x_b = (cx - 190, cx - 62) if sgn < 0 else (cx + 62, cx + 190)
        g.append(f'<rect x="{x_a}" y="{cy+86}" width="{x_b-x_a}" height="1.6" fill="url(#goldH)"/>')
    g.append(T(num, "pf4i", 30, cx, cy + 97, "url(#goldH)"))
    return "".join(g), W, H


def band2(W=1800, txt="PLIEGO DE AUTOR", field="url(#lacre)", tfill="#F4EBD8", tag="p"):
    """Segunda anilla de línea (como «Epicure» en Hoyo): estrecha, solo texto."""
    y0, y1 = 10, 110
    cx, cy = W / 2, (y0 + y1) / 2
    g = [f'<rect x="0" y="{y0}" width="{W}" height="{y1-y0}" fill="{field}"/>']
    for yy in (y0, y1 - 10):
        g.append(f'<rect x="0" y="{yy}" width="{W}" height="10" fill="url(#gold)"/>')
    g.append(f'<rect x="0" y="{y0+13}" width="{W}" height="1.6" fill="{tfill}" opacity=".7"/><rect x="0" y="{y1-14.6}" width="{W}" height="1.6" fill="{tfill}" opacity=".7"/>')
    g.append(T(txt, "cz7", 34, cx, cy + 12, tfill, tracking=.32))
    for sgn in (-1, 1):
        x = cx + sgn * 330
        g.append(f'<path d="M{x},{cy-9} L{x+9},{cy} L{x},{cy+9} L{x-9},{cy} Z" fill="url(#gold)"/>')
        g.append(f'<rect x="{min(x + sgn*24, x + sgn*240)}" y="{cy-.8}" width="216" height="1.6" fill="url(#goldH)"/>')
    return "".join(g), W, 120


# ------------------------------------------------------------------ VISTA (interior de tapa, código Hoyo)
def vista(W=1800, H=1120, vignette=None):
    """Litografía interior de tapa. vignette = PNG de una escena grabada sin texto (óvalo central);
    sin ella se usa el emblema sobre rayos."""
    cx, cy = W / 2, H * .53
    g = [f'<rect width="{W}" height="{H}" fill="url(#marfilB)"/>',
         f'<rect width="{W}" height="{H}" fill="url(#marfilB)" filter="url(#paper)"/>']
    for m, sw, col in ((22, 26, "url(#lacre)"), (40, 5, "url(#gold)"), (60, 2, LACRE)):
        g.append(f'<rect x="{m}" y="{m}" width="{W-2*m}" height="{H-2*m}" fill="none" stroke="{col}" stroke-width="{sw}"/>')
    g.append(beads(46, W - 40, 22, 4, 16, "url(#goldR)") + beads(46, W - 40, H - 22, 4, 16, "url(#goldR)"))
    for (x, y) in ((22, 22), (W - 22, 22), (W - 22, H - 22), (22, H - 22)):
        g.append(f'<circle cx="{x}" cy="{y}" r="30" fill="url(#gold)" filter="url(#emboss)"/><circle cx="{x}" cy="{y}" r="22" fill="url(#lacreO)"/><circle cx="{x}" cy="{y}" r="6" fill="url(#goldR)"/>')
    # óvalo central con viñeta grabada
    rx, ry = 430, 330
    g.append(f'<ellipse cx="{cx}" cy="{cy}" rx="{rx+26}" ry="{ry+26}" fill="url(#gold)" filter="url(#shadow)"/>')
    g.append(beads_ellipse(cx, cy, rx + 13, ry + 13, 4.5, 150, "#6a4c14"))
    g.append(f'<clipPath id="vov"><ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}"/></clipPath>')
    if vignette:
        g.append(f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="#F1E6CF"/>'
                 f'<image href="{vignette}" x="{cx-rx}" y="{cy-ry}" width="{2*rx}" height="{2*ry}" preserveAspectRatio="xMidYMid slice" clip-path="url(#vov)"/>')
    else:
        g.append(f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="url(#lacreO)"/>')
        g.append('<g clip-path="url(#vov)">' + sunburst(cx, cy, 30, 700, 120, "#C9A24A", .16) + "</g>")
        g.append(emblem(cx, cy, 420, ring=True))
    g.append(f'<ellipse cx="{cx}" cy="{cy}" rx="{rx-14}" ry="{ry-14}" fill="none" stroke="{LACRE}" stroke-width="2.5"/>')
    # cartela superior con el nombre (legibilidad Montecristo)
    bw, by, bh = 1180, 92, 150
    g.append(f'<path d="M{cx-bw/2},{by} L{cx+bw/2},{by} L{cx+bw/2+50},{by+bh/2} L{cx+bw/2},{by+bh} L{cx-bw/2},{by+bh} L{cx-bw/2-50},{by+bh/2} Z" fill="url(#lacre)" stroke="url(#gold)" stroke-width="7" filter="url(#shadow)"/>')
    g.append(f'<path d="M{cx-bw/2+14},{by+14} L{cx+bw/2-14},{by+14} L{cx+bw/2+24},{by+bh/2} L{cx+bw/2-14},{by+bh-14} L{cx-bw/2+14},{by+bh-14} L{cx-bw/2-24},{by+bh/2} Z" fill="none" stroke="#F4EBD8" stroke-width="2"/>')
    g.append(T("ARNALDO", "pf9", 124, cx, by + bh / 2 + 44, "#FBF5E8", tracking=.1, extra='filter="url(#emboss)"'))
    # paneles laterales y pie
    for sgn, l1, l2 in ((-1, "HECHO", "A MANO"), (1, "EDICIÓN", "NUMERADA")):
        px = cx + sgn * 690
        g.append(f'<rect x="{px-150}" y="{cy-90}" width="300" height="180" fill="url(#lacre)" stroke="url(#gold)" stroke-width="5"/>')
        g.append(f'<rect x="{px-138}" y="{cy-78}" width="276" height="156" fill="none" stroke="#F4EBD8" stroke-width="1.5"/>')
        g.append(T(l1, "cz7", 30, px, cy - 8, "url(#goldH)", tracking=.22) + T(l2, "cz7", 30, px, cy + 38, "url(#goldH)", tracking=.22))
    g.append(T("Pliego de autor", "py", 66, cx, H - 92, LACRE))
    return "".join(g)


def brand_stamp(W=1400, H=700, ink="#3B2414"):
    """Marca a fuego para la tapa (una tinta): emblema + nombre + filetes."""
    cx = W / 2
    g = [f'<g fill="{ink}" stroke="none">']
    rx, ry = 120, 150
    g.append(f'<ellipse cx="{cx}" cy="200" rx="{rx}" ry="{ry}" fill="none" stroke="{ink}" stroke-width="10"/>')
    g.append(f'<ellipse cx="{cx}" cy="200" rx="{rx-22}" ry="{ry-24}" fill="none" stroke="{ink}" stroke-width="4"/>')
    g.append(T("A", "cz9", 190, cx, 266, ink))
    g.append(f'<rect x="{cx-520}" y="398" width="1040" height="5"/>')
    g.append(T("ARNALDO", "pf9", 190, cx, 590, ink, tracking=.1))
    g.append(f'<rect x="{cx-520}" y="628" width="1040" height="5"/>')
    g.append(T("PLIEGO DE AUTOR", "cz7", 34, cx, 680, ink, tracking=.4))
    g.append("</g>")
    return "".join(g), W, H + 20


if __name__ == "__main__":
    b, W, H = band()
    svg(W, H, b, "arnaldo-v4-anilla-n1.svg")
    b, W, H = band(oval="url(#noirO)", num="Nº 2", side_r="TORO", tag="n2")
    svg(W, H, b, "arnaldo-v4-anilla-n2.svg")
    b, W, H = band(field="url(#noirB)", fil="#C9A24A", oval="url(#lacreO)", side_fill="url(#goldH)",
                   num="Nº 3", side_r="CHURCHILL", tag="n3", dark=True)
    svg(W, H, b, "arnaldo-v4-anilla-n3-negra.svg")
    p, W, H = band2()
    svg(W, H, p, "arnaldo-v4-anilla-pliego.svg")
    svg(400, 500, emblem(200, 250, 460), "arnaldo-v4-emblema.svg")
    vig = os.environ.get("ARNALDO_VIGNETTE")
    svg(1800, 1120, vista(vignette=vig), "arnaldo-v4-vista.svg")
    st, W, H = brand_stamp()
    svg(W, H, st, "arnaldo-v4-marca-fuego.svg")
