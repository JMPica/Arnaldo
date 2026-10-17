# -*- coding: utf-8 -*-
"""ARNALDO VALLÉS — Dossier de marca para inversores (PDF apaisado A4, HTML + Chromium).

Todas las cifras proceden de los documentos del proyecto (docs/40_brand_strategy.md, 41_product.md,
42_identity.md, 10_cuba_legal.md, 01_memo.md) y de metrics.json. Las imágenes son renders de exploración
de 01_BRAND/renders; las que aún no existen se omiten sin romper la maquetación.

Uso: python3 build_dossier.py  →  PROYECTO_CIGARS_CUBA_2027/01_BRAND/ARNALDO VALLÉS Brand Dossier.pdf
"""
import os, json, subprocess, tempfile
from PIL import Image

B = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(B, "..", "PROYECTO_CIGARS_CUBA_2027"))
REN = os.path.join(ROOT, "01_BRAND", "renders")
OUT = os.path.join(ROOT, "01_BRAND", "ARNALDO VALLÉS Brand Dossier.pdf")
CACHE = os.path.join(B, ".cache_dossier")
CHROME = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"
M = json.load(open(os.path.join(B, "metrics.json")))
FECHA = "10/10/2026"

# ---------------------------------------------------------------- datos pendientes del promotor
# Rellenar con texto y volver a generar. Mientras valgan None, el PDF muestra un marcador visible
# «[PENDIENTE · …]» y el script avisa al terminar: el dossier no debe enviarse con marcadores.
DATOS = {
    "promotor_nombre": None,            # nombre y apellidos tal como deben aparecer
    "promotor_experiencia": None,       # 3–5 líneas: sector, cargos, años; experiencia en tabaco, distribución, lujo o importación
    "promotor_dedicacion": None,        # completa / parcial (horas por semana)
    "promotor_capital": None,           # aportación propia: Fase 0 (≤ 15.000 €) y posterior
    "promotor_vinculo": None,           # relación con Arnaldo: desde cuándo y cómo
    "arnaldo_apellidos": "Vallés",    # aportado por el promotor (17/10/2026); segundo apellido, si lo hay, pendiente
    "arnaldo_categoria": None,          # categoría y años de oficio, solo si están acreditados
    "arnaldo_empresa": None,            # entidad o fábrica en la que trabaja
    "d12_opcion": None,                 # A: sin inversores hasta el Go · B: inversor para el tramo 1 · C: socio estratégico
    "d12_importe": None,                # importe aproximado a captar
    "d12_participacion": None,          # % de la sociedad a ceder, o «a negociar»
    "d12_instrumento": None,            # capital / préstamo participativo / a definir
    "d13_plan_b": None,                 # Sí: ARNALDO VALLÉS con origen R. Dominicana o Nicaragua como plan B · No: solo vía B3
}
PENDIENTES = []


def ph(key, label):
    """Valor de DATOS o marcador visible de dato pendiente."""
    v = DATOS.get(key)
    if v:
        return v
    PENDIENTES.append(label)
    return f'<span class="ph">{label}</span>'


# ---------------------------------------------------------------- imágenes
def img(name, maxw=2400):
    """Ruta file:// a una copia JPEG optimizada del render, o None si no existe."""
    src = os.path.join(REN, name)
    if not os.path.exists(src):
        return None
    os.makedirs(CACHE, exist_ok=True)
    dst = os.path.join(CACHE, os.path.splitext(name)[0] + ".jpg")
    if not os.path.exists(dst) or os.path.getmtime(dst) < os.path.getmtime(src):
        im = Image.open(src).convert("RGB")
        if im.width > maxw:
            im = im.resize((maxw, round(im.height * maxw / im.width)), Image.LANCZOS)
        im.save(dst, quality=90, optimize=True, progressive=True)
    return "file://" + dst


def img_crop(name, box, tag):
    """Recorte (x0, y0, x1, y1) de un render como JPEG en caché; None si el render no existe."""
    src = os.path.join(REN, name)
    if not os.path.exists(src):
        return None
    os.makedirs(CACHE, exist_ok=True)
    dst = os.path.join(CACHE, f"{os.path.splitext(name)[0]}-{tag}.jpg")
    Image.open(src).convert("RGB").crop(box).save(dst, quality=90, optimize=True)
    return "file://" + dst


ART = os.path.join(ROOT, "01_BRAND", "assets", "clasica")


def art(name):
    """Arte vectorial de la anilla clásica (SVG, se imprime como vector); None si no existe."""
    p = os.path.join(ART, name)
    return "file://" + p if os.path.exists(p) else None


# Diseño de la casa: «anilla clásica» (render elegido por el promotor) y su redibujo vectorial
I_CLASICA = (img("arnaldo-anilla-casa-referencia.png")       # foto de referencia del promotor (16/10): manda sobre todo lo demás
             or img("arnaldo-render-anilla-clasica-ret.png"))
A_N1, A_N2, A_N3 = art("arnaldo-anilla-n1.svg"), art("arnaldo-anilla-n2.svg"), art("arnaldo-anilla-n3-negra.svg")
A_PLIEGO, A_MEDALLON = art("arnaldo-anilla-pliego.svg"), art("arnaldo-medallon.svg")
A_SPEC, A_LOGO_ORO, A_LOGO_LACRE = art("arnaldo-anilla-especificacion.svg"), art("arnaldo-logotipo-oro.svg"), art("arnaldo-logotipo-lacre.svg")
A_VISTA, A_FUEGO = art("arnaldo-vista.svg"), art("arnaldo-marca-fuego.svg")
# Maquetas fotográficas: foto sin texto (IA) + arte vectorial compuesto encima
I_CAJA = img("arnaldo-caja-marca-fuego.png")
I_PURO = img("arnaldo-puro-anilla.png")
I_GAMA = img("arnaldo-tres-vitolas.png")
I_ABIERTA = img("arnaldo-caja-abierta.png")
I_HERO = img("arnaldo-av-1-anilla-nombre-completo-ret.png")     # foto principal con el nombre completo (17/10)
I_VINETA = img("arnaldo-v4-p5-vineta-grabada.png")              # grabado sin texto: vega y casa de tabaco


# ---------------------------------------------------------------- tipografías
def fontfaces():
    css = ""
    fams = [("Cinzel", "cinzel-latin-{w}-normal.woff2", (400, 600, 700), ("normal",)),
            ("Cormorant Garamond", "cormorant-garamond-latin-{w}-{s}.woff2", (300, 400, 500, 600), ("normal", "italic")),
            ("Inter", "inter-latin-{w}-normal.woff2", (300, 400, 500, 600), ("normal",)),
            ("Pinyon Script", "pinyon-script-latin-{w}-normal.woff2", (400,), ("normal",)),
            ("Herr Von Muellerhoff", "herr-von-muellerhoff-latin-{w}-normal.woff2", (400,), ("normal",)),
            ("Playfair Display", "playfair-display-latin-{w}-{s}.woff2", (400, 700, 900), ("normal", "italic"))]
    for fam, pat, ws, sts in fams:
        for w in ws:
            for s in sts:
                p = os.path.join(B, "fonts", pat.format(w=w, s=s))
                if os.path.exists(p):
                    css += f"@font-face{{font-family:'{fam}';font-weight:{w};font-style:{s};src:url('file://{p}') format('woff2');}}\n"
    return css


CSS = """
:root{--lacre:#8C1D1A;--noir:#110D0B;--oro:#C9A24A;--oro2:#E3C987;--marfil:#F3EAD6;--tinta:#1C1714;--ceniza:#8C8276;--linea:#DDD2BE;--papel:#F7F2E8}
@page{size:297mm 210mm;margin:0}
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{font-family:Inter,sans-serif;font-size:9.6pt;line-height:1.55;color:var(--tinta);-webkit-print-color-adjust:exact;print-color-adjust:exact}
.page{width:297mm;height:210mm;position:relative;overflow:hidden;page-break-after:always;break-after:page;background:var(--papel)}
.page:last-child{page-break-after:auto;break-after:auto}
.dark{background:var(--noir);color:var(--marfil)}
.ftr{position:absolute;bottom:9mm;left:22mm;right:22mm;display:flex;justify-content:space-between;font-family:Cinzel;font-size:6.2pt;letter-spacing:.38em;color:var(--ceniza)}
.dark .ftr{color:#8F8474}
.kick{font-family:Cinzel;font-size:7pt;letter-spacing:.42em;color:var(--lacre);text-transform:uppercase;margin:0 0 5mm}
.dark .kick{color:var(--oro)}
.display{font-family:'Cormorant Garamond',serif;font-weight:400;font-size:40pt;line-height:1.02;margin:0 0 7mm;color:var(--tinta);letter-spacing:-.005em}
.dark .display{color:var(--marfil)}
.display em{font-style:italic;color:var(--lacre)}
.dark .display em{color:var(--oro2)}
.lead{font-family:'Cormorant Garamond',serif;font-size:15pt;line-height:1.38;color:#3A2E25;margin:0 0 4mm}
.dark .lead{color:#E2D7C2}
p{margin:0 0 3mm}
.muted{color:var(--ceniza)}
.dark .muted{color:#A2968A}
.fine{font-size:6.8pt;line-height:1.45;color:var(--ceniza)}
.dark .fine{color:#8F8474}
h3{font-family:Cinzel;font-weight:600;font-size:7.4pt;letter-spacing:.26em;text-transform:uppercase;margin:0 0 2.5mm;color:var(--lacre)}
.dark h3{color:var(--oro)}
.figure{position:absolute;background-size:cover;background-position:center;background-repeat:no-repeat}
.big{font-family:'Cormorant Garamond',serif;font-weight:400;font-size:46pt;line-height:.95;color:var(--lacre);margin:0 0 2.5mm}
.dark .big{color:var(--oro2)}
.big small{font-size:16pt;margin-left:1mm}
.col{position:absolute}
.hair{height:1px;background:var(--oro);opacity:.8}
.rule-l{border-left:1px solid var(--oro);padding-left:6mm}
.grid{display:grid;gap:9mm}
.c2{grid-template-columns:1fr 1fr}.c3{grid-template-columns:repeat(3,1fr)}.c4{grid-template-columns:repeat(4,1fr)}
.tick{border-top:1px solid var(--lacre);padding-top:3.5mm}
.dark .tick{border-top-color:var(--oro)}
ul.dash{list-style:none;padding:0;margin:0}
ul.dash li{padding:0 0 2.6mm 5mm;position:relative}
ul.dash li:before{content:"";position:absolute;left:0;top:2.3mm;width:2.4mm;height:1px;background:var(--lacre)}
.dark ul.dash li:before{background:var(--oro)}
.ph{font-style:italic;color:#9A7A2E;border-bottom:1px dashed #C9A24A;font-weight:500}
.verdict{font-family:Cinzel;font-weight:700;letter-spacing:.2em;font-size:11pt;color:var(--oro)}
.cnum{font-family:'Cormorant Garamond',serif;font-size:22pt;line-height:1;color:var(--oro2);width:14mm;flex:none}
.cond{display:flex;gap:4mm;padding:3.2mm 0;border-bottom:1px solid #2E2620}
.scn{border-top:1px solid var(--linea);padding-top:4mm}
.scn.hl{border-top:2px solid var(--lacre)}
.scn .row{display:flex;justify-content:space-between;border-bottom:1px solid var(--linea);padding:1.8mm 0;font-size:8.6pt}
.scn .row span:first-child{color:var(--ceniza)}
.scn .row span:last-child{font-weight:600}
"""


# ---------------------------------------------------------------- helpers
def T(tag):
    cls = {"VERIFICADO": "v", "PROBABLE": "p", "HIPÓTESIS": "h", "BLOQUEADO": "b"}[tag]
    return f'<span class="tag {cls}">{tag}</span>'


def page(body, n, dark=False, title="", left="22mm", right="22mm", footer=True):
    cls = "page dark" if dark else "page"
    ftr = (f'<div class="ftr" style="left:{left};right:{right}"><span>ARNALDO VALLÉS{(" · " + title) if title else ""}</span>'
           f'<span>{n:02d}</span></div>') if (n > 1 and footer) else ""
    return f'<section class="{cls}">{body}{ftr}</section>'


def wordmark(h_mm, w_mm):
    """Wordmark provisional como SVG (Cinzel, las capitales romanas de la anilla clásica, con degradado oro)."""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w_mm}mm" height="{h_mm}mm" viewBox="0 0 1000 160">'
            '<defs><linearGradient id="wmg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8A6620"/>'
            '<stop offset=".25" stop-color="#E9CF7E"/><stop offset=".45" stop-color="#FFF2C2"/><stop offset=".62" stop-color="#D1AB52"/>'
            '<stop offset=".85" stop-color="#8A6620"/><stop offset="1" stop-color="#C8A04A"/></linearGradient></defs>'
            '<text x="500" y="126" text-anchor="middle" font-family="Cinzel" font-weight="600" font-size="92" letter-spacing="10" '
            'fill="url(#wmg)">ARNALDO VALLÉS</text></svg>')


def artimg(url, style):
    return f'<img src="{url}" style="position:absolute;{style}">' if url else ""


def fig(url, style):
    return f'<div class="figure" style="background-image:url(\'{url}\');{style}"></div>' if url else ""



def unidad_svg(pvp=24.0):
    """Barras horizontales: destino de cada euro del PVP (escenario Base, 2028). Gris = costes; lacre = marca.
    Importes exactos del modelo, redondeados a céntimos por resto mayor para que sumen el PVP."""
    g = lambda k: M[f"split_{k}_eur_raw"]
    rows = [("Estado", "IVA", g("vat")), ("Estado", "Impuesto especial", g("iee")), ("Estado", "Arancel (origen Cuba)", g("duty")),
            ("Canal", "Margen del expendedor", g("rm")), ("Canal", "Tarifa del distribuidor", g("dist")),
            ("Producción", "Fabricación, packaging, QC, flete y seguro", g("cif")),
            ("Producción", "Marcas fiscales, honorario, merma y muestras", g("fiscal") + g("merma") + g("royalty")),
            ("Marca", "Contribución de la marca", g("contrib"))]
    assert abs(sum(r[2] for r in rows) - pvp) < 1e-6, "el reparto no suma el PVP"
    cents = [int(r[2] * 100) for r in rows]
    for k in sorted(range(len(rows)), key=lambda k: rows[k][2] * 100 - cents[k], reverse=True)[:round(pvp * 100) - sum(cents)]:
        cents[k] += 1
    W, rh, x0, bw = 184, 8.2, 104, 50
    H = rh * len(rows) + 4
    mx = max(r[2] for r in rows)
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}mm" height="{H}mm" viewBox="0 0 {W} {H}">']
    prev = None
    for i, ((grp, lab, v), c) in enumerate(zip(rows, cents)):
        y = 2 + i * rh
        if grp != prev:
            out.append(f'<text x="0" y="{y + 5:.1f}" font-family="Cinzel" font-weight="600" font-size="2.9" letter-spacing=".4" fill="#8E1B1B">{grp.upper()}</text>')
            if i:
                out.append(f'<line x1="0" y1="{y - .9:.1f}" x2="{W}" y2="{y - .9:.1f}" stroke="#D8CCB4" stroke-width=".25"/>')
            prev = grp
        out.append(f'<text x="28" y="{y + 5:.1f}" font-family="Inter" font-size="3.3" fill="#1E1915">{lab}</text>')
        w = bw * v / mx
        col = "#8E1B1B" if grp == "Marca" else "#A89C8B"
        out.append(f'<path d="M{x0},{y + 1.4:.1f} h{w - 1:.2f} a1,1 0 0 1 1,1 v3.4 a1,1 0 0 1 -1,1 h{-(w - 1):.2f} z" fill="{col}"/>')
        eur = f"{c // 100},{c % 100:02d}"
        pc = f"{v / pvp * 100:.1f}".replace(".", ",")
        out.append(f'<text x="{x0 + w + 2.5:.1f}" y="{y + 5:.1f}" font-family="Inter" font-size="3.3" font-weight="{600 if grp == "Marca" else 400}" fill="#1E1915">{eur} € · {pc} %</text>')
    out.append("</svg>")
    return "".join(out)


# ---------------------------------------------------------------- escalera de precios (SVG en mm)
def precios_svg():
    """PVP oficiales en España (2026) de referencias de formato comparable; ARNALDO VALLÉS a 24 € (Base)."""
    # (nombre, PVP, lado: 1 arriba / -1 abajo, nivel, ancla del texto)
    pts = [("Corrida Robusto", 9.5, -1, 1, "middle"), ("Padrón 2000", 11.9, 1, 1, "middle"),
           ("Davidoff Short Robusto", 15.5, -1, 1, "middle"), ("Partagás Serie D No. 4", 21.2, 1, 1, "end"),
           ("Montecristo No. 2", 21.8, -1, 2, "end"), ("Romeo y Julieta Churchills", 24.8, -1, 2, "start"),
           ("Padrón 1926 80th", 42.0, 1, 1, "middle")]
    W, H, x0, x1, ya = 250, 66, 6, 244, 38
    X = lambda v: x0 + (v - 5) / (45 - 5) * (x1 - x0)
    o = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}mm" height="{H}mm" viewBox="0 0 {W} {H}">',
         f'<rect x="{X(18)}" y="{ya - 4}" width="{X(25) - X(18)}" height="8" fill="#EFE3CC"/>',
         f'<line x1="{x0}" y1="{ya}" x2="{x1}" y2="{ya}" stroke="#1C1714" stroke-width=".35"/>']
    for v in range(5, 50, 5):
        o.append(f'<line x1="{X(v)}" y1="{ya - 1}" x2="{X(v)}" y2="{ya + 1}" stroke="#1C1714" stroke-width=".3"/>'
                 f'<text x="{X(v)}" y="{ya + 5.2}" text-anchor="middle" font-family="Inter" font-size="2.5" fill="#A89C8B">{v}</text>')
    for name, v, side, lvl, anc in pts:
        L = 8 + 9 * (lvl - 1)
        y2 = ya - side * L
        ty = y2 - 1.2 if side > 0 else y2 + 3.2
        dx = {"middle": 0, "end": .8, "start": -.8}[anc]
        o.append(f'<line x1="{X(v)}" y1="{ya}" x2="{X(v)}" y2="{y2}" stroke="#A89C8B" stroke-width=".25"/>'
                 f'<circle cx="{X(v)}" cy="{ya}" r="1.2" fill="#A89C8B"/>'
                 f'<text x="{X(v) + dx}" y="{ty}" text-anchor="{anc}" font-family="Inter" font-size="2.6" fill="#3A2E25">{name} '
                 f'<tspan font-weight="600">{str(v).replace(".", ",")} €</tspan></text>')
    o.append(f'<line x1="{X(24)}" y1="{ya - 24}" x2="{X(24)}" y2="{ya}" stroke="#8C1D1A" stroke-width=".5"/>'
             f'<circle cx="{X(24)}" cy="{ya}" r="2.2" fill="#8C1D1A"/>'
             f'<text x="{X(24)}" y="{ya - 29}" text-anchor="middle" font-family="Cinzel" font-weight="700" font-size="3.6" letter-spacing=".5" fill="#8C1D1A">ARNALDO VALLÉS Nº 1</text>'
             f'<text x="{X(24)}" y="{ya - 25.2}" text-anchor="middle" font-family="Inter" font-weight="600" font-size="3" fill="#8C1D1A">24 € · escenario Base</text>')
    o.append("</svg>")
    return "".join(o)


# ---------------------------------------------------------------- vitolas a escala 1:1 (SVG en mm)
def vitolas_svg():
    rows = [("Nº 1", "Robusto", 124, 124, "50", (50,), "lacre"), ("Nº 2", "Toro", 152, "150–156", "50–52", (50, 52), "marfil"),
            ("Nº 3", "Churchill", 178, 178, "47", (47,), "negro")]
    W, H = 255, 84
    s = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}mm" height="{H}mm" viewBox="0 0 {W} {H}">',
         '<defs><linearGradient id="tob" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8A5A36"/>'
         '<stop offset=".35" stop-color="#6B4126"/><stop offset=".8" stop-color="#4A2C19"/><stop offset="1" stop-color="#3A2214"/></linearGradient>'
         '<linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8A6620"/><stop offset=".35" stop-color="#F3DD95"/>'
         '<stop offset=".6" stop-color="#C9A24A"/><stop offset="1" stop-color="#7A5A1C"/></linearGradient></defs>']
    mm = lambda ring: f"{ring / 64 * 25.4:.1f}".replace(".", ",")
    y, x0 = 4, 26
    for code, name, L, Ltxt, cep, rings, band in rows:
        d = max(rings) / 64 * 25.4  # cepo → mm (1/64 de pulgada)
        cy, r = y + d / 2, d / 2
        s.append(f'<text x="0" y="{cy - 1:.2f}" font-family="Cinzel" font-weight="700" font-size="5" fill="#8E1B1B">{code}</text>')
        s.append(f'<text x="0" y="{cy + 4.4:.2f}" font-family="Cormorant Garamond" font-style="italic" font-size="4.6" fill="#3A2E25">{name}</text>')
        s.append(f'<path d="M{x0 + r:.2f},{y:.2f} H{x0 + L:.2f} V{y + d:.2f} H{x0 + r:.2f} A{r:.2f},{r:.2f} 0 0 1 {x0 + r:.2f},{y:.2f} Z" fill="url(#tob)"/>')
        bx, bw = x0 + 16, 15
        fill = {"lacre": "#8E1B1B", "marfil": "#F4EBD8", "negro": "#14100D"}[band]   # banda de la anilla clásica
        s.append(f'<rect x="{bx}" y="{y:.2f}" width="{bw}" height="{d:.2f}" fill="{fill}" stroke="url(#g)" stroke-width=".7"/>')
        s.append(f'<ellipse cx="{bx + bw / 2}" cy="{cy:.2f}" rx="3.6" ry="{r * .62:.2f}" fill="#14100D" stroke="url(#g)" stroke-width=".8"/>')   # óvalo de laca negra con marco de oro
        ly = y + d + 3
        for x1, x2, y1, y2 in ((x0, x0 + L, ly, ly), (x0, x0, ly - 1.2, ly + 1.2), (x0 + L, x0 + L, ly - 1.2, ly + 1.2)):
            s.append(f'<line x1="{x1}" y1="{y1:.2f}" x2="{x2}" y2="{y2:.2f}" stroke="#8A8073" stroke-width=".25"/>')
        diam = "≈" + "–".join(mm(g) for g in rings) + " mm"
        s.append(f'<text x="{x0 + L + 4}" y="{cy - .6:.2f}" font-family="Inter" font-weight="600" font-size="3.4" fill="#3A2E25">≈{Ltxt} mm</text>')
        s.append(f'<text x="{x0 + L + 4}" y="{cy + 3.6:.2f}" font-family="Inter" font-size="3.1" fill="#6B6157">cepo {cep} ({diam})</text>')
        y += d + 8
    s.append("</svg>")
    return "".join(s)


# ---------------------------------------------------------------- páginas
def build():
    P = []
    n = 0

    def add(body, dark=False, title="", **kw):
        nonlocal n
        n += 1
        P.append(page(body, n, dark, title, **kw))

    dark_bg = lambda style: f'<div style="position:absolute;{style};background:radial-gradient(ellipse at 50% 42%,#3A2E26 0%,#110D0B 72%)"></div>'

    # 1 · Portada
    add(f"""
{fig(I_HERO, "left:112mm;top:0;width:185mm;height:210mm;background-position:42% 50%") if I_HERO else dark_bg("left:112mm;top:0;width:185mm;height:210mm")}
<div style="position:absolute;left:112mm;top:0;width:30mm;height:210mm;background:linear-gradient(90deg,#110D0B 0%,rgba(17,13,11,0) 100%)"></div>
<div class="col" style="left:22mm;top:26mm;width:86mm">
 <div class="kick">Dossier para inversores</div>
 <div style="margin:30mm 0 0 -2mm">{('<img src="' + A_LOGO_ORO + '" style="width:86mm;display:block">') if A_LOGO_ORO else wordmark(14, 86)}</div>
 <div class="lead" style="font-size:15pt;font-style:italic;margin-top:12mm;color:#E2D7C2">Cigarros hechos a mano,<br>con el nombre de quien los tuerce.</div>
</div>
<div class="col fine" style="left:22mm;bottom:14mm;width:84mm;color:#9A8E80">Confidencial · Octubre de 2026<br>No es material publicitario dirigido al consumidor.</div>""", dark=True)

    # 2 · La idea
    add(f"""
{fig(I_PURO, "right:0;top:0;width:118mm;height:210mm;background-position:50% 30%")}
<div class="col" style="left:24mm;top:30mm;width:132mm">
 <div class="kick">La idea</div>
 <div class="display" style="font-style:italic;font-size:42pt;color:var(--oro2)">«Que cada caja lleve la firma de quien la hizo.»</div>
 <div class="hair" style="width:60mm;margin:10mm 0 9mm"></div>
 <p class="lead">Las grandes marcas del puro nacieron de un nombre, un oficio y una anilla. ARNALDO VALLÉS parte de algo que no se puede copiar: un torcedor real.</p>
 <p class="muted" style="max-width:118mm">Cada lote es un <em>pliego</em> numerado. Cada caja lleva un colofón, «caja nº X de N», con la firma de Arnaldo Vallés.</p>
</div>""", dark=True, title="La idea")

    # 3 · Arnaldo Vallés
    add(f"""
{fig(I_VINETA, "left:0;top:0;width:128mm;height:210mm;background-position:50% 50%;filter:sepia(.25)")}
<div class="col" style="left:150mm;right:24mm;top:28mm">
 <div class="kick">El autor</div>
 <div class="display">Un torcedor,<br><em>no un personaje</em></div>
 <p class="lead">Arnaldo Vallés es el torcedor cubano que da nombre a la marca y participa en el proyecto. No hay historia que inventar: la persona existe y firma su trabajo.</p>
 <div class="grid c2" style="margin-top:7mm;gap:8mm">
  <div class="tick"><h3>Aporta</h3><p class="muted" style="margin:0">Su nombre, su firma y su criterio de construcción, con derecho de veto sobre ambos.</p></div>
  <div class="tick"><h3>Se formaliza</h3><p class="muted" style="margin:0">Consentimiento escrito, permiso de su empleador y licencia de nombre y firma a favor de la sociedad.</p></div>
 </div>
 <p class="fine" style="margin-top:8mm">No se le atribuye ningún mérito, premio ni año de oficio que no esté acreditado. Grabado ilustrativo.</p>
</div>""", title="El autor", left="150mm")

    # 4 · Oportunidad
    add(f"""<div class="col" style="left:24mm;right:24mm;top:26mm">
 <div class="kick">La oportunidad</div>
 <div class="display">Un mercado que paga<br><em>por el nombre</em></div>
 <div class="grid c4" style="margin-top:12mm;gap:10mm">
  <div class="tick"><div class="big">827<small>M USD</small></div><p class="muted">Ventas de Habanos S.A. en 2024, con crecimiento sobre todo por precio.</p></div>
  <div class="tick"><div class="big">54 %</div><p class="muted">Peso de Europa en esas ventas.</p></div>
  <div class="tick"><div class="big">2.º</div><p class="muted">Puesto de España entre los mercados del puro cubano, tras China.</p></div>
  <div class="tick"><div class="big">13.000</div><p class="muted">Expendedurías: la única red de venta autorizada en España.</p></div>
 </div>
 <div class="hair" style="margin:12mm 0 6mm;opacity:.5"></div>
 <p class="lead" style="max-width:200mm">La demanda accesible para una marca nueva se estima en <strong>1.600–6.000 puros al año</strong> en 40–150 puntos de venta. Se validará con 15 estanqueros especialistas antes de producir.</p>
</div>
<div class="col fine" style="left:24mm;right:24mm;bottom:17mm">Fuentes: Halfwheel y Habanos S.A. (2024), Comisionado para el Mercado de Tabacos, prensa sectorial; detalle en 09_RESEARCH/Source Register.xlsx. La demanda accesible es una estimación propia.</div>""", title="Oportunidad")

    # 5 · Precio
    add(f"""<div class="col" style="left:24mm;right:24mm;top:26mm">
 <div class="kick">Precio</div>
 <div class="display">Al precio de un clásico,<br><em>con un autor detrás</em></div>
 <div style="margin:2mm 0 0 -4mm">{precios_svg()}</div>
 <div class="grid c2" style="margin-top:2mm;gap:14mm">
  <div class="tick"><h3>El reto</h3><p class="muted" style="margin:0">A 24 €, una marca nueva compite de tú a tú con los Habanos que el fumador ya conoce. Solo lo justifican una habilitación de primer nivel y una autenticidad que se pueda comprobar.</p></div>
  <div class="tick"><h3>Por qué puede ganar</h3><p class="muted" style="margin:0">El estanquero vende lo que puede explicar. Un torcedor con nombre y apellido, lotes numerados y una ficha técnica son argumentos que ninguna marca de catálogo tiene.</p></div>
 </div>
</div>
<div class="col fine" style="left:24mm;right:24mm;bottom:17mm">PVP oficiales en España por unidad, 2026 (BOE). Banda sombreada: Habanos clásicos, 18–25 €. Cohiba Behike BHK 56, a 262,50 €, queda fuera de escala.</div>""", title="Precio")

    # 6 · La anilla
    add(f"""{dark_bg("left:0;top:0;width:297mm;height:210mm")}
<div class="col" style="left:24mm;top:26mm;width:120mm"><div class="kick">La casa</div><div class="display">La anilla</div></div>
{artimg(A_N1, "left:38mm;top:66mm;width:221mm")}
{artimg(A_PLIEGO, "left:38mm;top:142mm;width:221mm")}
<div class="col" style="left:24mm;right:24mm;top:166mm">
 <div class="grid c4" style="gap:8mm">
  <div class="tick"><h3>Banda lacre</h3><p class="muted" style="margin:0;font-size:8.4pt">Cantos de oro con perlado en relieve.</p></div>
  <div class="tick"><h3>Óvalo troquelado</h3><p class="muted" style="margin:0;font-size:8.4pt">Marco de oro en guilloché y centro de laca negra.</p></div>
  <div class="tick"><h3>El nombre</h3><p class="muted" style="margin:0;font-size:8.4pt">ARNALDO VALLÉS en capitales romanas de oro.</p></div>
  <div class="tick"><h3>La firma</h3><p class="muted" style="margin:0;font-size:8.4pt">Debajo, la firma de Arnaldo. Y una segunda anilla: «Pliego de autor».</p></div>
 </div>
</div>""", dark=True, title="La anilla", footer=False)

    # 7 · Gama
    add(f"""<div class="col" style="left:24mm;top:26mm;width:110mm">
 <div class="kick">La gama</div>
 <div class="display">Una anilla,<br><em>tres vitolas</em></div>
 <p class="muted">Un mismo óvalo en toda la gama; cambia el color de la banda. Se reconoce de lejos y se distingue de cerca.</p>
</div>
{artimg(A_N1, "left:22mm;top:92mm;width:96mm")}{artimg(A_N2, "left:22mm;top:124mm;width:96mm")}{artimg(A_N3, "left:22mm;top:156mm;width:96mm")}
<div class="col" style="left:122mm;top:99mm;width:40mm"><h3>Nº 1 · Robusto</h3><p class="fine" style="margin:0">Lanzamiento</p></div>
<div class="col" style="left:122mm;top:131mm;width:40mm"><h3>Nº 2 · Toro</h3><p class="fine" style="margin:0">Extensión</p></div>
<div class="col" style="left:122mm;top:163mm;width:40mm"><h3>Nº 3 · Churchill</h3><p class="fine" style="margin:0">Edición limitada</p></div>
<div style="position:absolute;left:168mm;top:0;width:129mm;height:210mm;background:#050403"></div>
{fig(I_GAMA, "left:168mm;top:40mm;width:129mm;height:129mm")}""", title="La gama", right="135mm")

    # 8 · La caja
    add(f"""
{fig(I_CAJA, "left:0;top:0;width:148mm;height:210mm;background-position:50% 45%")}
{fig(I_ABIERTA, "left:149mm;top:0;width:148mm;height:210mm;background-position:45% 50%")}
<div style="position:absolute;left:0;bottom:0;width:297mm;height:88mm;background:linear-gradient(0deg,rgba(10,8,6,.97) 35%,rgba(10,8,6,0) 100%)"></div>
<div class="col" style="left:24mm;bottom:22mm;width:120mm"><div class="kick">La caja</div><div class="display" style="margin:0">Cedro y fuego</div></div>
<div class="col" style="left:166mm;right:24mm;bottom:22mm"><p class="muted" style="margin:0">Caja de cedro con el nombre y la firma marcados a fuego. Dentro, la vista litografiada con el óvalo de la casa y el colofón numerado de cada caja.</p></div>""", dark=True, title="La caja")

    # 9 · Prueba
    add(f"""<div class="col" style="left:24mm;top:26mm;width:150mm">
 <div class="kick">La prueba</div>
 <div class="display">Autenticidad<br><em>que se puede comprobar</em></div>
 <div class="grid c3" style="margin-top:10mm;gap:8mm">
  <div class="tick"><h3>Pliego</h3><p class="muted" style="margin:0">Cada lote, numerado y documentado: fecha de torcido, unidades, rechazo, cata y expedición.</p></div>
  <div class="tick"><h3>Colofón</h3><p class="muted" style="margin:0">Cada caja dice qué lote es y qué número de caja sobre el total.</p></div>
  <div class="tick"><h3>Ficha técnica</h3><p class="muted" style="margin:0">Liga y construcción documentadas por la fábrica. Nada de fincas ni añadas que no consten.</p></div>
 </div>
 <p class="fine" style="margin-top:9mm">Control de calidad por muestreo ISO 2859-1 (AQL 1,0 en defectos mayores) y catas ciegas por pliego, a cerrar con la fábrica.</p>
</div>
<div class="col" style="left:196mm;top:40mm;width:78mm">
 <div style="background:#FBF6EA;border:1px solid #C9A24A;outline:1px solid #C9A24A;outline-offset:-3mm;padding:11mm 8mm;text-align:center;box-shadow:0 2mm 8mm rgba(0,0,0,.12)">
  <div style="font-family:Cinzel;font-weight:600;font-size:11pt;letter-spacing:.24em;color:#110D0B">ARNALDO VALLÉS</div>
  <div style="font-family:Cinzel;font-size:6.4pt;letter-spacing:.32em;color:#8C1D1A;margin:3mm 0 6mm">PLIEGO Nº 001</div>
  <div style="font-family:'Cormorant Garamond';font-size:12pt;line-height:1.35;color:#3A2E25">Nº 1 · Robusto<br>Caja <strong>0001</strong> de 0500</div>
  <div style="font-family:'Cormorant Garamond';font-style:italic;font-size:10pt;color:#3A2E25;margin-top:6mm">Torcido a mano por</div>
  <div style="font-family:'Pinyon Script';font-size:22pt;color:#3A2E25;line-height:1.3">Arnaldo Vallés</div>
 </div>
 <p class="fine" style="margin-top:3mm;text-align:center">El colofón · numeración de ejemplo</p>
</div>""", title="La prueba")

    # 10 · Economía de una unidad
    add(f"""<div class="col" style="left:24mm;right:24mm;top:26mm">
 <div class="kick">Economía de una unidad</div>
 <div class="display">De 24 € de PVP,<br><em>{M['split_contrib_eur']} para la marca</em></div>
</div>
<div class="col" style="left:20mm;top:84mm">{unidad_svg()}</div>
<div class="col" style="left:212mm;right:24mm;top:86mm">
 <div class="big">{M['split_contrib_eur']}</div><p class="muted">Contribución por puro antes de gastos fijos ({M['split_contrib']} del PVP), escenario Base.</p>
 <div class="hair" style="margin:6mm 0;opacity:.5"></div>
 <p class="muted" style="margin:0">Con origen Cuba, el Estado y el canal se llevan la mayor parte. Por eso el precio de fábrica es la palanca: hay que cerrarlo por debajo de 5 USD.</p>
</div>
<div class="col fine" style="left:24mm;right:24mm;bottom:17mm">Financial Model 2027–2031.xlsx, escenario Base (2028). IVA 21 % e impuesto especial 15,8 % verificados; arancel 26 % y margen del expendedor 9 % a confirmar; precio de fábrica pendiente de cotización formal.</div>""", title="Economía unitaria")

    # 11 · Escenarios
    sc = [("Conservador", "20 € · 7,0 USD", "cons", False), ("Base", "24 € · 6,0 USD", "base", True),
          ("Optimista", "28 € · 5,0 USD", "opt", False), ("Estrés", "24 € · 7,5 USD", "stress", False)]
    cols = "".join(f"""<div class="scn{' hl' if hl else ''}"><h3 style="color:{'#8C1D1A' if hl else '#1C1714'}">{nm}</h3><p class="fine" style="margin:0 0 3mm">PVP · precio de fábrica: {pf}</p>
<div class="row"><span>Puros en 2031</span><span>{M[k + '_units_2031']}</span></div>
<div class="row"><span>EBITDA 2031</span><span>{M[k + '_ebitda_2031']}</span></div>
<div class="row"><span>Financiación máxima</span><span>{M[k + '_need']}</span></div>
<div class="row"><span>VAN al 18 %</span><span>{M[k + '_npv']}</span></div></div>""" for nm, pf, k, hl in sc)
    add(f"""<div class="col" style="left:24mm;right:24mm;top:26mm">
 <div class="kick">Escenarios</div>
 <div class="display">Qué tiene que<br><em>ser verdad</em></div>
 <div class="grid c4" style="margin-top:8mm;gap:8mm">{cols}</div>
 <div class="grid c3" style="margin-top:10mm;gap:10mm">
  <div><h3>Precio de fábrica</h3><p class="muted" style="margin:0">≤ 5 USD por puro, con un PVP de 25 € aceptado por los estanqueros.</p></div>
  <div><h3>Demanda</h3><p class="muted" style="margin:0">El Optimista necesita {M['opt_pos_2031']} puntos de venta activos: el doble de lo que hoy se estima accesible.</p></div>
  <div><h3>Lectura honesta</h3><p class="muted" style="margin:0">Solo el Optimista tiene VAN positivo. Por eso nada se produce antes de validar precio y demanda.</p></div>
 </div>
</div>
<div class="col fine" style="left:24mm;right:24mm;bottom:17mm">Financial Model 2027–2031.xlsx, hoja «Scenarios». Sin probabilidades asignadas; el modelo no incluye retribución del promotor.</div>""", title="Escenarios")

    # 12 · Plan
    steps = [("30 días", M['plan_cost_30'], "Abogados en Cuba y España, identificación de la fábrica, consultas regulatorias y encargo del informe de marcas."),
             ("90 días", M['plan_cost_90'], "Comité Go / No-Go: vía legal de exportación, titularidad de la marca, sanciones, registro en la UE y 15 entrevistas a estanqueros."),
             ("180 días", M['plan_cost_180'], "Solo con Go: sociedad, diseño profesional, prototipos y catas, contrato con la fábrica y cartas de interés.")]
    tl = "".join(f"""<div style="position:relative;padding-top:9mm"><div style="position:absolute;top:0;left:0;width:4mm;height:4mm;border-radius:50%;background:#8C1D1A"></div>
<h3>{t}</h3><div class="big" style="font-size:34pt">{c}</div><p class="muted" style="margin:0">{d}</p></div>""" for t, c, d in steps)
    add(f"""<div class="col" style="left:24mm;right:24mm;top:26mm">
 <div class="kick">El plan</div>
 <div class="display">Una opción barata<br><em>antes de una apuesta cara</em></div>
 <div style="position:relative;margin-top:8mm">
  <div style="position:absolute;top:1.9mm;left:2mm;right:0;height:1px;background:#C9A24A"></div>
  <div class="grid c3" style="gap:12mm">{tl}</div>
 </div>
 <div class="grid c3" style="margin-top:11mm;gap:12mm">
  <div class="tick"><h3>Tramo 0 · Fase 0</h3><p class="muted" style="margin:0">Hasta 15.000 €, capital propio del promotor.</p></div>
  <div class="tick"><h3>Tramo 1 · Piloto</h3><p class="muted" style="margin:0">Pedido de 3.000 puros: {M['wc_peak']} de caja. Solo con las ocho condiciones cumplidas.</p></div>
  <div class="tick"><h3>Tramo 2 · Escalado</h3><p class="muted" style="margin:0">Hasta {M['cons_need']}, liberado por resultados de 12 meses.</p></div>
 </div>
</div>
<div class="col fine" style="left:24mm;right:24mm;bottom:17mm">Costes acumulados estimados (07_OPERATIONS/180-Day Execution Plan.xlsx). Si la vía cubana no se abre, el capital se redirige a la importación de marcas premium no cubanas.</div>""", title="El plan")

    # 13 · Canal y protección
    add(f"""<div class="col" style="left:24mm;right:24mm;top:26mm">
 <div class="kick">Canal y protección</div>
 <div class="display">Se vende en el humidor.<br><em>Se protege en Europa.</em></div>
 <div class="grid c2" style="margin-top:10mm;gap:18mm">
  <div><h3>Cómo se vende</h3><ul class="dash">
   <li>Solo en expendedurías, a través de un distribuidor habilitado.</li>
   <li>Sin venta online ni publicidad al consumidor: el prescriptor es el estanquero.</li>
   <li>Objetivo de validación: 10 expendedurías especialistas interesadas por escrito.</li></ul></div>
  <div><h3>Cómo se protege</h3><ul class="dash">
   <li>La marca, a nombre de la sociedad española: se registra en la UE antes de compartir nada con la fábrica.</li>
   <li>La firma de Arnaldo Vallés, registrada también como marca, con su consentimiento.</li>
   <li>Titularidad del 100 % como condición no negociable con la contraparte cubana.</li></ul></div>
 </div>
 <p class="fine" style="margin-top:10mm">Anterioridades a analizar en el informe de registrabilidad: DON VALLES (EE. UU., puros) y ARLONDO (tabaco). Ley 28/2005; RD 579/2017.</p>
</div>""", title="Canal y protección")

    # 14 · Equipo y propuesta
    add(f"""<div class="col" style="left:24mm;right:24mm;top:26mm">
 <div class="kick">Equipo y propuesta</div>
 <div class="display">Quién lo hace<br><em>y qué se pide</em></div>
 <div class="grid c3" style="margin-top:8mm;gap:12mm">
  <div class="tick"><h3>Promotor</h3><p style="margin:0 0 2mm"><strong>{ph('promotor_nombre', 'nombre y apellidos')}</strong></p>
   <p class="muted" style="margin:0 0 2mm">{ph('promotor_experiencia', 'experiencia')}</p>
   <p class="muted" style="margin:0">Dedicación: {ph('promotor_dedicacion', 'completa o parcial')} · {ph('promotor_vinculo', 'relación con Arnaldo')}</p></div>
  <div class="tick"><h3>Arnaldo Vallés</h3><p style="margin:0 0 2mm"><strong>Torcedor</strong></p>
   <p class="muted" style="margin:0 0 2mm">{ph('arnaldo_categoria', 'categoría y años de oficio acreditados')}</p>
   <p class="muted" style="margin:0">{ph('arnaldo_empresa', 'entidad en la que trabaja')}</p></div>
  <div class="tick"><h3>Asesores (Fase 0)</h3><p class="muted" style="margin:0">Abogados en Cuba y en España, asesor fiscal, agente de marcas, asesor regulatorio, operador logístico y, tras el Go, un estudio de packaging premium.</p></div>
 </div>
 <div style="margin-top:12mm;border:1px solid #C9A24A;padding:7mm 9mm;display:grid;grid-template-columns:52mm 1fr 1fr 1fr;gap:8mm;align-items:start">
  <div><h3 style="margin:0">La propuesta</h3><p class="fine" style="margin:2mm 0 0">Ningún capital externo antes del Go de la Fase 0.</p></div>
  <div><p class="fine" style="margin:0 0 1mm">Opción</p>{ph('d12_opcion', 'sin inversores hasta el Go · tramo 1 · socio')}</div>
  <div><p class="fine" style="margin:0 0 1mm">Importe y participación</p>{ph('d12_importe', 'importe')} · {ph('d12_participacion', '% o a negociar')}</div>
  <div><p class="fine" style="margin:0 0 1mm">Instrumento</p>{ph('d12_instrumento', 'capital o préstamo participativo')}</div>
 </div>
 <p class="fine" style="margin-top:4mm"><span class="ph">En dorado</span>: datos por completar antes de enviar el dossier. Aportación del promotor: {ph('promotor_capital', 'capital propio')}. Plan B de origen (República Dominicana o Nicaragua): {ph('d13_plan_b', 'decisión D13')}.</p>
</div>""", title="Equipo y propuesta")

    # 15 · Condiciones
    conds = [("Fábrica", "Autorización documentada para fabricar y exportar una marca de titularidad extranjera."),
             ("Marca", "Titularidad del 100 % aceptada en la UE y en Cuba."),
             ("Precio", "Precio de fábrica firme compatible con ≤ 5 USD a PVP 24 €."),
             ("Pagos", "Canal bancario validado y dictamen de sanciones UE / EE. UU."),
             ("Distribuidor", "Distribuidor habilitado dispuesto, con carta de intención."),
             ("Estanqueros", "Al menos 10 expendedurías especialistas interesadas por escrito."),
             ("Registro", "Informe de registrabilidad favorable."),
             ("Capital", "Capital o financiación ≥ necesidad del Conservador + 25 %.")]
    cl = "".join(f'<div class="cond"><div class="cnum">C{i+1}</div><div><h3 style="margin:0 0 1mm">{t}</h3><p class="muted" style="margin:0;font-size:8.8pt">{d}</p></div></div>' for i, (t, d) in enumerate(conds))
    add(f"""<div class="col" style="left:24mm;right:24mm;top:26mm">
 <div class="kick">Estado</div>
 <div class="display">Una marca preparada.<br><em>Una inversión condicionada.</em></div>
 <p style="margin:0 0 6mm"><span class="verdict">CONDITIONAL GO</span> <span class="muted">— solo la Fase 0. Ningún anticipo, producción ni stock hasta cumplir las ocho condiciones.</span></p>
 <div class="grid c2" style="gap:0 16mm">{cl}</div>
</div>""", dark=True, title="Estado")

    # 16 · Notas
    add(f"""<div class="col" style="left:24mm;right:24mm;top:26mm">
 <div class="kick">Notas</div>
 <div class="display" style="font-size:30pt">Sobre este documento</div>
 <div class="grid c3" style="margin-top:6mm;gap:12mm">
  <div><h3>Imágenes</h3><p class="muted">Conceptos de diseño, no producto existente: fotografías generadas con inteligencia artificial y arte vectorial provisional de la anilla, revisados letra por letra. La firma es provisional hasta disponer de la de Arnaldo Vallés.</p></div>
  <div><h3>Fuentes</h3><p class="muted">Datos de mercado, precios y normativa de fuentes públicas consultadas en octubre de 2026 (09_RESEARCH/Source Register.xlsx). Cifras del Financial Model 2027–2031. Detalle completo en el Executive Investment Memorandum y el Business Plan.</p></div>
  <div><h3>Aviso</h3><p class="muted">Documento confidencial para inversores y asesores. No es una oferta de valores ni asesoramiento jurídico, fiscal o financiero, ni material publicitario dirigido al consumidor (Ley 28/2005). No se ha contactado con ninguna entidad y no hay nada firmado.</p></div>
 </div>
</div>""", title="Notas")

    html = f"""<!doctype html><html lang="es"><head><meta charset="utf-8"><title>ARNALDO VALLÉS — Dossier para inversores</title>
<style>{fontfaces()}{CSS}</style></head><body>{''.join(P)}</body></html>"""
    return html, n


def main():
    html, n = build()
    tmp = tempfile.mkdtemp()
    hp = os.path.join(tmp, "dossier.html")
    open(hp, "w", encoding="utf-8").write(html)
    if "--html" in os.sys.argv:
        print(hp)
    subprocess.run([CHROME, "--headless", "--no-sandbox", "--disable-gpu", "--no-pdf-header-footer",
                    f"--print-to-pdf={OUT}", "file://" + hp], check=True, capture_output=True)
    print(f"  -> {os.path.relpath(OUT, ROOT)} ({n} páginas)")
    if PENDIENTES:
        print(f"  AVISO: {len(PENDIENTES)} datos pendientes (marcadores visibles en el PDF). Rellenar DATOS en build_dossier.py:")
        for p in PENDIENTES:
            print("   -", p)


if __name__ == "__main__":
    main()
