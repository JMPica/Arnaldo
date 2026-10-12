# -*- coding: utf-8 -*-
"""ARNALDO — Dossier de marca para inversores (PDF apaisado A4, HTML + Chromium).

Todas las cifras proceden de los documentos del proyecto (docs/40_brand_strategy.md, 41_product.md,
42_identity.md, 10_cuba_legal.md, 01_memo.md) y de metrics.json. Las imágenes son renders de exploración
de 01_BRAND/renders; las que aún no existen se omiten sin romper la maquetación.

Uso: python3 build_dossier.py  →  PROYECTO_CIGARS_CUBA_2027/01_BRAND/ARNALDO Brand Dossier.pdf
"""
import os, json, subprocess, tempfile
from PIL import Image

B = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(B, "..", "PROYECTO_CIGARS_CUBA_2027"))
REN = os.path.join(ROOT, "01_BRAND", "renders")
OUT = os.path.join(ROOT, "01_BRAND", "ARNALDO Brand Dossier.pdf")
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
    "arnaldo_apellidos": None,
    "arnaldo_categoria": None,          # categoría y años de oficio, solo si están acreditados
    "arnaldo_empresa": None,            # entidad o fábrica en la que trabaja
    "d12_opcion": None,                 # A: sin inversores hasta el Go · B: inversor para el tramo 1 · C: socio estratégico
    "d12_importe": None,                # importe aproximado a captar
    "d12_participacion": None,          # % de la sociedad a ceder, o «a negociar»
    "d12_instrumento": None,            # capital / préstamo participativo / a definir
    "d13_plan_b": None,                 # Sí: ARNALDO con origen R. Dominicana o Nicaragua como plan B · No: solo vía B3
}
PENDIENTES = []


def ph(key, label):
    """Valor de DATOS o marcador visible de dato pendiente."""
    v = DATOS.get(key)
    if v:
        return v
    PENDIENTES.append(label)
    return f'<span class="ph">[PENDIENTE · {label}]</span>'


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


I_N1 = img("arnaldo-a2-15-anilla-medallon-manos-ret.png") or img("arnaldo-a2-1-anilla-medallon-ret.png")
I_N3 = img("arnaldo-a2-3-edicion-negra-ret.png")
I_VISTA = img("arnaldo-a2-8-vista-casa-tabaco-ret.png") or img("arnaldo-a2-4-caja-vista-pano.png")
I_N2 = img("arnaldo-a2-6-anilla-n2-oro-ret.png")
I_EMBLEMA = img("arnaldo-a2-7-emblema-chavetas-ret.png")
I_GAMA = img("arnaldo-a2-9-tres-vitolas-ret.png")
I_MANOS = img("arnaldo-a2-10-manos-torcedor-ret.png")
I_HUMIDOR = img("arnaldo-a2-11-humidor-ret.png")
C_MEDALLON = (img_crop("arnaldo-a2-15-anilla-medallon-manos-ret.png", (380, 180, 1100, 720), "medallon")
              or img_crop("arnaldo-a2-1-anilla-medallon-ret.png", (430, 150, 1050, 700), "medallon"))
C_YAGUA = img_crop("arnaldo-a2-3-edicion-negra-ret.png", (380, 70, 1060, 250), "yagua")


# ---------------------------------------------------------------- tipografías
def fontfaces():
    css = ""
    fams = [("Cinzel", "cinzel-latin-{w}-normal.woff2", (400, 600, 700), ("normal",)),
            ("Cormorant Garamond", "cormorant-garamond-latin-{w}-{s}.woff2", (300, 400, 500, 600), ("normal", "italic")),
            ("Inter", "inter-latin-{w}-normal.woff2", (300, 400, 500, 600), ("normal",)),
            ("Pinyon Script", "pinyon-script-latin-{w}-normal.woff2", (400,), ("normal",))]
    for fam, pat, ws, sts in fams:
        for w in ws:
            for s in sts:
                p = os.path.join(B, "fonts", pat.format(w=w, s=s))
                if os.path.exists(p):
                    css += f"@font-face{{font-family:'{fam}';font-weight:{w};font-style:{s};src:url('file://{p}') format('woff2');}}\n"
    return css


CSS = """
:root{--lacre:#8E1B1B;--noir:#14100D;--oro:#C9A24A;--oro2:#E6CB86;--marfil:#F4EBD8;--tinta:#1E1915;--ceniza:#8A8073;--linea:#D8CCB4;--papel:#FBF7EF}
@page{size:297mm 210mm;margin:0}
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{font-family:Inter,sans-serif;font-size:10.4pt;line-height:1.5;color:var(--tinta);-webkit-print-color-adjust:exact;print-color-adjust:exact}
.page{width:297mm;height:210mm;position:relative;overflow:hidden;page-break-after:always;break-after:page;background:var(--papel)}
.page:last-child{page-break-after:auto;break-after:auto}
.dark{background:var(--noir);color:var(--marfil)}
.pad{position:absolute;inset:16mm 18mm 18mm 18mm}
.hdr{position:absolute;top:8mm;left:18mm;right:18mm;display:flex;justify-content:space-between;font-family:Cinzel;font-size:6.6pt;letter-spacing:.32em;color:var(--ceniza)}
.ftr{position:absolute;bottom:7mm;left:18mm;right:18mm;display:flex;justify-content:space-between;font-size:6.4pt;color:var(--ceniza);letter-spacing:.04em}
.dark .hdr,.dark .ftr{color:#9C907E}
.kick{font-family:Cinzel;font-size:7.4pt;letter-spacing:.34em;color:var(--lacre);text-transform:uppercase;margin:0 0 3mm}
.dark .kick{color:var(--oro)}
h1{font-family:'Cormorant Garamond',serif;font-weight:500;font-size:33pt;line-height:1.05;margin:0 0 6mm;color:var(--tinta)}
.dark h1{color:var(--marfil)}
h2{font-family:'Cormorant Garamond',serif;font-weight:600;font-size:15pt;margin:0 0 2mm;color:var(--tinta)}
.dark h2{color:var(--oro2)}
h3{font-family:Cinzel;font-weight:600;font-size:8pt;letter-spacing:.2em;text-transform:uppercase;margin:0 0 2mm;color:var(--lacre)}
.dark h3{color:var(--oro)}
p{margin:0 0 2.6mm}
.lead{font-family:'Cormorant Garamond',serif;font-size:16pt;line-height:1.35;color:#3A2E25}
.dark .lead{color:#E9DFCB}
.small{font-size:8pt;color:var(--ceniza);line-height:1.45}
.dark .small{color:#A99D8A}
.rule{height:1px;background:var(--oro);opacity:.7;margin:4mm 0}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:8mm}
.grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:7mm}
.grid4{display:grid;grid-template-columns:repeat(4,1fr);gap:6mm}
.card{border-top:1.2px solid var(--lacre);padding-top:3mm}
.dark .card{border-top-color:var(--oro)}
.stat{font-family:'Cormorant Garamond',serif;font-weight:500;font-size:40pt;line-height:1;color:var(--lacre);margin:0 0 2mm}
.dark .stat{color:var(--oro2)}
table{border-collapse:collapse;width:100%;font-size:8.9pt;line-height:1.4}
th{font-family:Inter;font-weight:600;font-size:7.2pt;letter-spacing:.12em;text-transform:uppercase;text-align:left;color:var(--lacre);border-bottom:1.2px solid var(--lacre);padding:1.6mm 2mm}
td{padding:2mm 2.2mm;border-bottom:1px solid var(--linea);vertical-align:top}
.dark th{color:var(--oro);border-bottom-color:var(--oro)}
.dark td{border-bottom-color:#3A3129}
tr.hl td{background:#F3E6CF}
.tag{display:inline-block;font-size:6.2pt;font-weight:600;letter-spacing:.06em;padding:.3mm 1.4mm;border-radius:1mm;vertical-align:1px}
.tag.v{background:#DDEBD9;color:#2D5A27}.tag.p{background:#F4E8C8;color:#7A5A12}.tag.h{background:#E7E1F1;color:#4B3B78}.tag.b{background:#F3D9D6;color:#8E1B1B}
.figure{position:absolute;background-size:cover;background-position:center;background-repeat:no-repeat}
.cap{font-size:7.6pt;color:#A99D8A;line-height:1.4;margin-top:2mm}
.wm{font-family:Cinzel;font-weight:600;letter-spacing:.28em;background:linear-gradient(180deg,#8A6620 0%,#E9CF7E 25%,#FFF2C2 45%,#D1AB52 62%,#8A6620 85%,#C8A04A 100%);-webkit-background-clip:text;background-clip:text;color:transparent}
.quote{font-family:'Cormorant Garamond',serif;font-style:italic;font-size:30pt;line-height:1.12;color:var(--oro2)}
ul.clean{list-style:none;padding:0;margin:0}
ul.clean li{padding:1.8mm 0 1.8mm 5.5mm;position:relative;border-bottom:1px solid var(--linea)}
.dark ul.clean li{border-bottom-color:#3A3129}
ul.clean li:before{content:"";position:absolute;left:0;top:3.9mm;width:2mm;height:2mm;background:var(--lacre);transform:rotate(45deg)}
.dark ul.clean li:before{background:var(--oro)}
.num{font-family:Cinzel;font-weight:700;color:var(--lacre)}
.dark .num{color:var(--oro)}
.swatch{height:30mm;border-radius:1mm;margin-bottom:2.5mm;border:1px solid rgba(0,0,0,.08)}
.chip{display:inline-block;font-family:Cinzel;font-size:7pt;letter-spacing:.2em;border:1px solid var(--oro);color:var(--oro);padding:1mm 3mm;margin:0 2mm 2mm 0}
.ph{display:inline-block;background:#FFF1B8;color:#7A4B00;border:1px dashed #C08A00;border-radius:1mm;padding:0 1.6mm;font-family:Inter;font-weight:600;font-size:.86em;letter-spacing:0}
.verdict{font-family:Cinzel;font-weight:700;letter-spacing:.14em;font-size:13pt;color:var(--lacre)}
"""


# ---------------------------------------------------------------- helpers
def T(tag):
    cls = {"VERIFICADO": "v", "PROBABLE": "p", "HIPÓTESIS": "h", "BLOQUEADO": "b"}[tag]
    return f'<span class="tag {cls}">{tag}</span>'


def page(body, n, dark=False, title="", left="18mm", right="18mm"):
    cls = "page dark" if dark else "page"
    hdr = f'<div class="hdr" style="left:{left};right:{right}"><span>ARNALDO · DOSSIER DE MARCA</span><span>{title}</span></div>' if n > 1 else ""
    legal = (f"Confidencial · Documento de trabajo para revisión profesional · Fecha de corte {FECHA}"
             if (left, right) == ("18mm", "18mm") else f"Confidencial · Fecha de corte {FECHA}")
    ftr = (f'<div class="ftr" style="left:{left};right:{right}"><span>{legal}</span>'
           f'<span>{n:02d}</span></div>') if n > 1 else ""
    return f'<section class="{cls}">{hdr}{body}{ftr}</section>'


def wordmark(h_mm, w_mm):
    """Wordmark provisional como SVG (texto Cinzel con degradado oro): se imprime sin artefactos."""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w_mm}mm" height="{h_mm}mm" viewBox="0 0 1000 160">'
            '<defs><linearGradient id="wmg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8A6620"/>'
            '<stop offset=".25" stop-color="#E9CF7E"/><stop offset=".45" stop-color="#FFF2C2"/><stop offset=".62" stop-color="#D1AB52"/>'
            '<stop offset=".85" stop-color="#8A6620"/><stop offset="1" stop-color="#C8A04A"/></linearGradient></defs>'
            '<text x="500" y="126" text-anchor="middle" font-family="Cinzel" font-weight="600" font-size="138" letter-spacing="30" '
            'fill="url(#wmg)">ARNALDO</text></svg>')


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


# ---------------------------------------------------------------- vitolas a escala 1:1 (SVG en mm)
def vitolas_svg():
    rows = [("Nº 1", "Robusto", 124, 124, "50", (50,), "lacre"), ("Nº 2", "Toro", 152, "150–156", "50–52", (50, 52), "oro"),
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
        fill = {"lacre": "#8E1B1B", "oro": "url(#g)", "negro": "#14100D"}[band]
        s.append(f'<rect x="{bx}" y="{y:.2f}" width="{bw}" height="{d:.2f}" fill="{fill}" stroke="url(#g)" stroke-width=".7"/>')
        s.append(f'<ellipse cx="{bx + bw / 2}" cy="{cy:.2f}" rx="3.6" ry="{r * .62:.2f}" fill="{"#8E1B1B" if band == "oro" else "#C9A24A"}"/>')
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

    def add(body, dark=False, title="", left="18mm", right="18mm"):
        nonlocal n
        n += 1
        P.append(page(body, n, dark, title, left, right))

    # 1 · Portada
    add(f"""
{fig(I_N1, "right:0;top:0;width:150mm;height:210mm;background-position:52% 50%")}
<div style="position:absolute;right:150mm;top:0;width:40mm;height:210mm;background:linear-gradient(90deg,rgba(20,16,13,0) 0%,rgba(20,16,13,0) 100%)"></div>
<div style="position:absolute;left:20mm;top:22mm;width:118mm">
 <div class="kick">Dossier de marca · Para inversores</div>
 <div style="margin:16mm 0 6mm -1mm">{wordmark(19, 118)}</div>
 <div style="height:1px;background:linear-gradient(90deg,#C9A24A,rgba(201,162,74,0));width:90mm;margin:0 0 6mm"></div>
 <div class="lead" style="font-size:18pt;font-style:italic;color:#E9DFCB">Cigarros hechos a mano<br>con el nombre de quien los tuerce</div>
 <p style="margin-top:10mm;font-family:Cinzel;font-size:7.4pt;letter-spacing:.3em;color:#C9A24A">PLIEGO DE AUTOR · EDICIONES NUMERADAS</p>
</div>
<div style="position:absolute;left:20mm;bottom:16mm;width:115mm" class="small">
 Versión 1.0 · Fecha de corte {FECHA} · Confidencial.<br>
 Documento de trabajo preparado con fuentes públicas. Las imágenes son conceptos generados con IA, no artes finales.
 No es material publicitario dirigido al consumidor. Requiere revisión jurídica y fiscal profesional antes de su difusión.
</div>""", dark=True)

    # 2 · La marca en una página
    add(f"""<div class="pad" style="top:18mm">
<div class="kick">Resumen</div><h1>La marca en una página</h1>
<div class="grid3" style="margin-top:6mm;row-gap:8mm">
 <div class="card"><h3>Nombre</h3><p><strong>ARNALDO</strong>, el nombre del torcedor cubano que participa en el proyecto. No hay que inventar ninguna historia: la persona existe.</p></div>
 <div class="card"><h3>Idea</h3><p>Que cada caja lleve la firma de quien la hizo. Producción en <strong>pliegos</strong> numerados, con un <strong>colofón</strong> en cada caja.</p></div>
 <div class="card"><h3>Posicionamiento</h3><p><strong>Contemporary Cuban Luxury</strong>, la alternativa mejor puntuada en la matriz ponderada (3,90 en una escala de 1 a 5), con la gramática visual clásica de la habilitación cubana, sin herencia inventada.</p></div>
 <div class="card"><h3>Producto</h3><p>Una vitola de lanzamiento, <strong>Nº 1 Robusto</strong>; después <strong>Nº 2 Toro</strong> y <strong>Nº 3 Churchill</strong> en edición limitada. PVP objetivo del escenario Base: <strong>24 €</strong> por unidad.</p></div>
 <div class="card"><h3>Canal</h3><p>Expendedurías especialistas en España (≈13.000 puntos autorizados) a través de un distribuidor habilitado. Sin venta online ni publicidad al consumidor.</p></div>
 <div class="card"><h3>Estado</h3><p><span class="verdict" style="font-size:9pt">CONDITIONAL GO</span> solo para la Fase 0 (≤ 15.000 €): verificación jurídica en Cuba, registro de marca y validación comercial. Nada de producción antes de cumplir C1–C8.</p></div>
</div>
<div class="rule" style="margin-top:9mm"></div>
<p class="small">Fuentes: Brand Strategy, Product Architecture, Brand Identity Guidelines y Executive Investment Memorandum de este dossier (fecha de corte {FECHA}).</p>
</div>""", title="RESUMEN")

    # 3 · La idea
    add(f"""
{fig(I_VISTA, "right:0;top:0;width:150mm;height:210mm;background-position:46% 50%")}
<div style="position:absolute;left:20mm;top:30mm;width:112mm">
 <div class="kick">La idea</div>
 <div class="quote" style="font-size:31pt">«Que cada caja lleve la firma de quien la hizo.»</div>
 <div style="height:1px;background:linear-gradient(90deg,#C9A24A,rgba(201,162,74,0));width:80mm;margin:9mm 0 7mm"></div>
 <p class="lead" style="font-size:14pt">Las grandes marcas del puro se construyeron con un nombre, un oficio y una habilitación de primer nivel. ARNALDO parte de un activo que no se puede copiar: <strong>un torcedor real</strong>.</p>
 <p class="small" style="font-size:8.6pt">Cada lote es un <em>pliego</em> numerado; cada caja lleva un colofón «nº X de N» que, cuando el contrato lo permita, rubricará Arnaldo. «Pliego de autor»: con un autor real, la expresión cobra todo su sentido.</p>
</div>
<div style="position:absolute;left:20mm;bottom:16mm;width:112mm" class="cap">Imagen: concepto de vista (interior de la tapa) generado con IA. No es un arte final.</div>""", dark=True, title="LA IDEA", left="20mm", right="160mm")

    # 4 · Arnaldo
    manos = fig(I_MANOS, "right:0;top:0;width:110mm;height:210mm")
    rgt = "128mm" if I_MANOS else "18mm"
    add(f"""{manos}<div class="pad" style="right:{rgt}">
<div class="kick">La pieza central</div><h1>Arnaldo, el torcedor</h1>
<p class="lead">Arnaldo es el torcedor cubano que participa en el proyecto y da nombre a la marca. Su firma manuscrita será el sello de ARNALDO y, si él lo autoriza, su retrato grabado presidirá la vista de la caja.</p>
<div class="{'grid2' if I_MANOS else 'grid3'}" style="margin-top:5mm;row-gap:5mm">
 <div><h3>Lo que aporta</h3><ul class="clean">
  <li>Autenticidad: una persona y un oficio reales.</li>
  <li>Criterio de construcción e interlocución con la fábrica.</li>
  <li>Su firma y, si quiere, su imagen, con derecho de veto.</li></ul></div>
 <div><h3>Lo que se formaliza antes</h3><ul class="clean">
  <li>Consentimiento escrito y autorización de su empleador.</li>
  <li>Licencia irrevocable y transferible de nombre, firma e imagen a favor de la SL.</li>
  <li>Participación de referencia: 10 % de la SL con <em>vesting</em> a 4 años {T("HIPÓTESIS")}.</li></ul></div>
 <div><h3>Lo que necesitamos de él</h3><ul class="clean">
  <li>15–20 firmas en papel liso, escaneadas a 600 ppp.</li>
  <li>Opcional: 3–5 fotografías de rostro y de manos en la mesa de torcer.</li>
  <li>Datos verificables para el colofón: nombre completo, categoría y años de oficio acreditados.</li></ul></div>
</div>
<p class="small" style="margin-top:5mm">Principio editorial: no se atribuye a Arnaldo ningún mérito, año de oficio, premio o declaración que no esté acreditado. Las figuras de torcedor que aparecen en los renders de este dossier son ilustrativas y no lo representan.</p>
</div>""", title="ARNALDO", right=rgt)

    # 5 · Mercado
    add(f"""<div class="pad">
<div class="kick">Mercado</div><h1>Un mercado de alto valor, que crece por precio</h1>
<div class="grid4" style="margin-top:7mm">
 <div class="card"><div class="stat">827<span style="font-size:15pt"> M USD</span></div><p>Facturación de Habanos S.A. en 2024 (+16 % según la compañía; +14,7 % según otras fuentes) {T("VERIFICADO")}</p></div>
 <div class="card"><div class="stat">54 %</div><p>Peso de Europa en las ventas de Habanos {T("VERIFICADO")}</p></div>
 <div class="card"><div class="stat">2.º</div><p>Puesto de España entre los mercados mundiales de Habanos en 2024, tras China {T("VERIFICADO")}</p></div>
 <div class="card"><div class="stat">≈13.000</div><p>Expendedurías, la red minorista autorizada en España (12.858 licencias en 2024) {T("PROBABLE")}</p></div>
</div>
<div class="grid2" style="margin-top:10mm">
 <div><h3>Lectura</h3><p>El crecimiento del segmento premium es sobre todo de <strong>precio</strong> (Cohiba duplicó precios en 2022). El consumidor está acostumbrado a pagar más por los formatos clásicos, pero compara con referencias consolidadas a precios conocidos.</p>
 <p>En 2026 la red de distribución de Habanos en Europa está afectada por sanciones, lo que genera riesgo de desabastecimiento puntual del puro cubano {T("VERIFICADO")}.</p></div>
 <div><h3>Lo que no sabemos (y cómo lo cerraremos)</h3><p>No existe un dato público fiable del valor del puro premium hecho a mano en España separado del resto de cigarros. La demanda accesible se estima de abajo arriba en <strong>1.600–6.000 unidades/año</strong> {T("HIPÓTESIS")} y se validará con 15 entrevistas a estanqueros especialistas.</p></div>
</div>
<p class="small" style="position:absolute;bottom:0">Fuentes: S20, S21, S24, S53, S16–S17, S26, S52 (09_RESEARCH/Source Register.xlsx, consulta {FECHA}). Criterios de las etiquetas: 09_RESEARCH/Evidence &amp; Assumptions Log.xlsx.</p>
</div>""", title="MERCADO")

    # 6 · Precio y competencia
    add(f"""<div class="pad">
<div class="kick">Precio y competencia</div><h1>Dónde se sitúa ARNALDO</h1>
<table style="margin-top:4mm">
<thead><tr><th style="width:15%">Banda de PVP</th><th style="width:47%">Ejemplos (precios oficiales España, 2026)</th><th>Comentario</th></tr></thead>
<tbody>
<tr><td>&lt; 12 €</td><td>Corrida Honduras Robusto 9,50 € · Padrón 2000 11,90 € · El Viejo Continente Estelí Robusto 11,80 €</td><td>No cubanos; entrada al premium</td></tr>
<tr><td>12–18 €</td><td>Davidoff Puro Dominicano Short Robusto 15,50 €</td><td>Marcas no cubanas de prestigio</td></tr>
<tr class="hl"><td>18–25 €</td><td>Partagás Serie D No. 4 ≈21,20 € · Montecristo No. 2 21,80 € · R&amp;J Churchills 24,80 € · <strong>ARNALDO Nº 1: 24 € (escenario Base)</strong></td><td>Núcleo de los Habanos clásicos</td></tr>
<tr><td>25–50 €</td><td>Padrón 1926 80th 42 €</td><td>Ultra-premium no cubano y gamas altas cubanas</td></tr>
<tr><td>&gt; 50 €</td><td>Cohiba Behike BHK 56: 262,50 €</td><td>Colección y lujo extremo</td></tr>
</tbody></table>
<div class="grid2" style="margin-top:7mm">
 <div class="card"><h3>El reto comercial central</h3><p>A 24 €, una marca nueva se sitúa por encima de Habanos clásicos de formato equivalente. Solo lo justifica una habilitación al nivel de las grandes marcas y una autenticidad verificable: por eso la marca es el activo que se trabaja primero.</p></div>
 <div class="card"><h3>Estructura competitiva</h3><p>Rivalidad alta, canal con poder alto (espacio de humidor limitado), proveedor con poder muy alto (sistema estatal cubano) y barreras de entrada muy altas: regulación, prohibición de publicidad, capital circulante y reputación.</p></div>
</div>
<p class="small" style="position:absolute;bottom:0">Fuentes: S19, S37, S38 {T("VERIFICADO")}/{T("PROBABLE")}. Precios de referencia a {FECHA}; pueden variar con cada publicación en el BOE.</p>
</div>""", title="PRECIO Y COMPETENCIA")


    # 6b · Economía de una unidad
    _r = lambda *ks: f"{sum(M[f'split_{k}_eur_raw'] for k in ks) / 24 * 100:.1f}".replace(".", ",") + " %"
    state_pct, canal_pct = _r("vat", "iee", "duty"), _r("rm", "dist")
    add(f"""<div class="pad">
<div class="kick">Economía de una unidad</div><h1>Dónde van los 24 € de un ARNALDO Nº 1</h1>
<div style="display:grid;grid-template-columns:186mm 1fr;gap:8mm;margin-top:2mm">
 <div>{unidad_svg()}</div>
 <div>
  <div class="card"><h3>Lo que queda a la marca</h3><div class="stat">{M['split_contrib_eur']}</div><p>por unidad antes de gastos fijos ({M['split_contrib']} del PVP), en el escenario Base (PVP 24 €, FOB 6 USD).</p></div>
  <div class="card" style="margin-top:5mm"><h3>Por qué es tan poco</h3><p>Con origen Cuba, el Estado (IVA, impuesto especial y arancel) se lleva el {state_pct} del PVP y el canal el {canal_pct}. Con el mismo FOB y origen República Dominicana, el arancel baja a 0 % y el coste se reduce ≈{M['ct_diff10k']} por cada 10.000 unidades {T("PROBABLE")}.</p></div>
 </div>
</div>
<table style="margin-top:4mm">
<thead><tr><th>PVP</th><th>Contribución por unidad (costes Base)</th><th>Punto muerto EBITDA</th><th>FOB máximo para un margen del 25 %</th></tr></thead>
<tbody>
<tr><td>20 €</td><td>{M['ue20_contrib']}</td><td>{M['ue20_be']}</td><td>{M['ue20_fobmax']}</td></tr>
<tr class="hl"><td>25 €</td><td>{M['ue25_contrib']}</td><td>{M['ue25_be']} u/año</td><td>{M['ue25_fobmax']}</td></tr>
<tr><td>30 €</td><td>{M['ue30_contrib']}</td><td>{M['ue30_be']} u/año</td><td>{M['ue30_fobmax']}</td></tr>
</tbody></table>
<p class="small" style="margin-top:2mm">Fuente: Financial Model 2027–2031.xlsx (hojas «Import &amp; Taxes» y «Unit Economics») y Customs and Tax Model.xlsx. Escenario Base, 2028. IVA 21 % e impuesto especial 15,8 % {T("VERIFICADO")}; arancel 26 % y margen del expendedor 9 % {T("PROBABLE")}, a confirmar en TARIC y BOE (Q10, Q11); FOB {T("BLOQUEADO")} hasta recibir una cotización formal.</p>
</div>""", title="ECONOMÍA UNITARIA")

    # 7 · Posicionamiento
    add(f"""<div class="pad">
<div class="kick">Posicionamiento</div><h1>Tres caminos evaluados, uno elegido</h1>
<table style="margin-top:4mm">
<thead><tr><th style="width:20%"></th><th>A · Luxury Heritage</th><th>B · Contemporary Cuban Luxury</th><th>C · Ultra-Limited Artisan</th></tr></thead>
<tbody>
<tr><td>Idea</td><td>Tradición, artesanía, códigos clásicos</td><td>Lujo contemporáneo e internacional</td><td>Pequeñas producciones numeradas</td></tr>
<tr><td>Riesgo de autenticidad</td><td>Alto: tentación de inventar herencia</td><td>Bajo</td><td>Bajo</td></tr>
<tr><td>Precio defendible</td><td>Medio</td><td>Medio-alto</td><td>Alto</td></tr>
<tr><td>Escalabilidad</td><td>Media</td><td>Alta</td><td>Baja</td></tr>
<tr class="hl"><td><strong>Puntuación ponderada</strong></td><td>2,45</td><td><strong>3,90</strong></td><td>3,35</td></tr>
</tbody></table>
<div class="grid3" style="margin-top:8mm">
 <div class="card"><h3>De B, la estrategia</h3><p>Lujo contemporáneo y escalable, con bajo riesgo de autenticidad: la opción ganadora de la matriz.</p></div>
 <div class="card"><h3>De C, la escasez</h3><p>Numeración por pliegos y una edición limitada, Nº 3, para el coleccionista.</p></div>
 <div class="card"><h3>De A, la gramática visual</h3><p>Oro, relieve, litografía y cartela clásica, que el consumidor asocia a calidad, pero sin herencia, fechas, familias ni medallas inventadas.</p></div>
</div>
<p class="small" style="position:absolute;bottom:0">Criterios y pesos: diferenciación 20 %, coherencia productiva 15 %, viabilidad reguladora 15 %, potencial con profesionales 15 %, potencial de precio 15 %, escalabilidad 10 %, coste de desarrollo 5 %, dependencia del fabricante 5 % (00_EXECUTIVE/Decision Matrix.xlsx, hoja «Posicionamiento»; escala de 1 a 5).</p>
</div>""", title="POSICIONAMIENTO")

    # 8 · Plataforma de marca
    add(f"""<div class="pad">
<div class="kick">Plataforma de marca</div><h1>Clásica, honesta, artesanal, precisa</h1>
<div class="grid2" style="margin-top:6mm;gap:12mm">
 <div>
  <div class="card" style="margin-bottom:6mm"><h3>Propósito</h3><p class="lead">Que cada caja lleve la firma de quien la hizo.</p></div>
  <div class="card" style="margin-bottom:6mm"><h3>Promesa al profesional</h3><p class="lead">Un torcedor real detrás de cada pliego: consistencia verificable, ficha técnica y trazabilidad.</p></div>
  <div class="card"><h3>Personalidad</h3><p><span class="chip" style="color:#8E1B1B;border-color:#8E1B1B">CLÁSICA</span><span class="chip" style="color:#8E1B1B;border-color:#8E1B1B">HONESTA</span><span class="chip" style="color:#8E1B1B;border-color:#8E1B1B">ARTESANAL</span><span class="chip" style="color:#8E1B1B;border-color:#8E1B1B">PRECISA</span></p></div>
 </div>
 <div><h3>Lo que ARNALDO no hace</h3><ul class="clean">
  <li>No atribuye a Arnaldo méritos, años, premios ni declaraciones que no estén acreditados.</li>
  <li>No sugiere vínculo con otras personas del sector.</li>
  <li>No imita anillas, sellos ni elementos de seguridad de Habanos ni de otras marcas.</li>
  <li>No usa «Habano», «Habana», «Cuba» ni «Vuelta Abajo» como elementos de marca.</li>
  <li>No usa escudos de Estado, banderas, medallas ni fechas de fundación.</li>
  <li>No hace publicidad al consumidor (Ley 28/2005).</li></ul></div>
</div></div>""", title="PLATAFORMA")

    # 9 · Nombre y arquitectura
    add(f"""<div class="pad">
<div class="kick">Nombre y arquitectura</div><h1>Una marca madre, tres vitolas, lotes con firma</h1>
<div class="grid2" style="gap:12mm;margin-top:4mm">
 <div>
  <table><thead><tr><th>Nivel</th><th>Elemento</th></tr></thead><tbody>
  <tr><td>Marca madre</td><td><strong>ARNALDO</strong>: wordmark + firma manuscrita de Arnaldo como sello</td></tr>
  <tr><td>Vitolas</td><td><strong>Nº 1</strong> Robusto (lanzamiento) · <strong>Nº 2</strong> Toro (extensión) · <strong>Nº 3</strong> Churchill (edición limitada)</td></tr>
  <tr><td>Lotes</td><td><strong>PLIEGO Nº 001</strong>, 002…</td></tr>
  <tr><td>Caja</td><td><strong>Colofón</strong> numerado «nº X de N», rubricado por Arnaldo cuando el contrato lo permita</td></tr>
  <tr><td>Ediciones especiales</td><td><strong>Pliego de autor</strong>, firmadas caja a caja, solo con C1–C8 cumplidas y consistencia demostrada</td></tr>
  </tbody></table>
  <p class="small" style="margin-top:4mm">Nombres de reserva: <strong>FOLIO</strong> y <strong>LUMBRE</strong>, si Arnaldo o su empleador no autorizan el nombre o si el informe de registrabilidad es desfavorable. 21 nombres evaluados.</p>
 </div>
 <div>
  <table><thead><tr><th>Criterio</th><th>Valoración del nombre ARNALDO</th></tr></thead><tbody>
  <tr><td>Autenticidad</td><td>Muy alta: persona real, oficio real</td></tr>
  <tr><td>Memorabilidad</td><td>Alta: tres sílabas, fácil en español, inglés, francés, italiano y alemán</td></tr>
  <tr><td>Adecuación premium</td><td>Alta: tradición de marcas con nombre propio</td></tr>
  <tr><td>Distintividad registral</td><td>Media: se refuerza con apellido y con la firma como marca figurativa</td></tr>
  <tr><td>Colisiones (búsqueda web)</td><td>Ninguna marca de puros «Arnaldo»; ARLONDO (tabaco) a analizar {T("PROBABLE")}</td></tr>
  </tbody></table>
 </div>
</div>
<div style="display:flex;align-items:stretch;gap:0;margin-top:9mm"><div style="flex:1;border:1px solid #C9A24A;padding:3.5mm 3mm;text-align:center;background:#14100D"><div style="font-family:Cinzel;font-weight:700;font-size:11pt;letter-spacing:.12em;color:#E6CB86">ARNALDO</div><div class="small" style="margin-top:1mm;color:#A99D8A">Marca madre</div></div><div style="width:7mm;display:flex;align-items:center;justify-content:center;color:#C9A24A;font-size:13pt">→</div><div style="flex:1;border:1px solid #C9A24A;padding:3.5mm 3mm;text-align:center;background:#FBF7EF"><div style="font-family:Cinzel;font-weight:700;font-size:10pt;letter-spacing:.12em;color:#8E1B1B">Nº 1 · Nº 2 · Nº 3</div><div class="small" style="margin-top:1mm;color:#8A8073">Vitolas</div></div><div style="width:7mm;display:flex;align-items:center;justify-content:center;color:#C9A24A;font-size:13pt">→</div><div style="flex:1;border:1px solid #C9A24A;padding:3.5mm 3mm;text-align:center;background:#FBF7EF"><div style="font-family:Cinzel;font-weight:700;font-size:10pt;letter-spacing:.12em;color:#8E1B1B">PLIEGO Nº 001</div><div class="small" style="margin-top:1mm;color:#8A8073">Lote numerado</div></div><div style="width:7mm;display:flex;align-items:center;justify-content:center;color:#C9A24A;font-size:13pt">→</div><div style="flex:1;border:1px solid #C9A24A;padding:3.5mm 3mm;text-align:center;background:#FBF7EF"><div style="font-family:Cinzel;font-weight:700;font-size:10pt;letter-spacing:.12em;color:#8E1B1B">nº X de N</div><div class="small" style="margin-top:1mm;color:#8A8073">Colofón de cada caja</div></div><div style="width:7mm;display:flex;align-items:center;justify-content:center;color:#C9A24A;font-size:13pt">→</div><div style="flex:1;border:1px solid #C9A24A;padding:3.5mm 3mm;text-align:center;background:#8E1B1B"><div style="font-family:Cinzel;font-weight:700;font-size:10pt;letter-spacing:.12em;color:#F4EBD8">PLIEGO DE AUTOR</div><div class="small" style="margin-top:1mm;color:#E9DFCB">Edición firmada</div></div></div>
</div>""", title="NOMBRE")

    # 10 · Dirección creativa
    add(f"""<div class="pad">
<div class="kick">Dirección creativa · Ruta A v2</div><h1>El nivel de las grandes marcas, sin copiar a ninguna</h1>
<p style="max-width:230mm">Tres referencias de Habanos marcan el listón de calidad. De cada una se traduce un <strong>código</strong> a un elemento propio de ARNALDO, y se excluye expresamente todo lo que constituye su marca o su aspecto comercial protegido.</p>
<table style="margin-top:3mm">
<thead><tr><th style="width:15%">Referencia</th><th style="width:25%">Código que inspira</th><th style="width:33%">Traducción original ARNALDO</th><th>Prohibido copiar</th></tr></thead>
<tbody>
<tr><td><strong>Hoyo de Monterrey</strong></td><td>Medallón oval victoriano con viñeta grabada; filigrana de oro; rojo, oro y crema</td><td>Medallón oval con una viñeta grabada de <strong>las manos de Arnaldo en la mesa de torcer</strong> (o una casa de tabaco) y filigrana de oro</td><td>El jardín y la fuente, «José Gener», la composición de su anilla y su vista</td></tr>
<tr><td><strong>Montecristo</strong></td><td>Emblema heráldico fuerte y simple; paleta reducida; lectura a distancia</td><td>Emblema de <strong>la chaveta</strong> (la cuchilla de media luna del torcedor) bajo una hoja de tabaco, en un sello propio; sin hojas cruzadas, para evitar cualquier parecido con una hoz</td><td>El triángulo, las espadas, la flor de lis y su combinación de colores</td></tr>
<tr><td><strong>Cohiba</strong></td><td>Patrón geométrico potente; minimalismo; versión negra de lujo (Behike)</td><td>Banda con un <strong>patrón inspirado en la yagua</strong> (la vaina de la palma real que envuelve los tercios de tabaco), en oro y negro, para la edición limitada</td><td>El damero blanco y negro, la cabeza taína y el amarillo Cohiba</td></tr>
</tbody></table>
<div class="grid3" style="margin-top:5mm;gap:6mm">
 <div><div style="height:30mm;background:url('{C_MEDALLON}') center/cover;border-radius:1mm"></div><p class="small" style="margin-top:1.5mm">Medallón con las manos del torcedor · Nº 1</p></div>
 <div>{('<div style="height:30mm;background:url(' + chr(39) + I_EMBLEMA + chr(39) + ') center/cover;border-radius:1mm"></div>') if I_EMBLEMA else '<div style="height:30mm;border:1px dashed #C9A24A;border-radius:1mm;display:flex;align-items:center;justify-content:center;font-family:Cinzel;font-size:7.5pt;letter-spacing:.2em;color:#8A8073;text-align:center;padding:0 6mm">EMBLEMA DE CHAVETAS<br>EN DESARROLLO</div>'}<p class="small" style="margin-top:1.5mm">Hoja de tabaco sobre la chaveta · emblema</p></div>
 <div><div style="height:30mm;background:url('{C_YAGUA}') center/cover;border-radius:1mm"></div><p class="small" style="margin-top:1.5mm">Patrón de yagua en oro sobre laca negra · Nº 3</p></div>
</div>
<p class="small" style="margin-top:3mm">Comunes a todas: ni «Habana», ni «Cuba», ni «Habano»; sin escudos de Estado, medallas ni fechas. La firma real de Arnaldo irá dentro de la cartela. Las marcas citadas pertenecen a sus titulares y se mencionan solo como referencia de nivel.</p>
</div>""", title="DIRECCIÓN CREATIVA")

    # 11 · Anilla Nº 1
    add(f"""
{fig(I_N1, "left:0;top:0;width:178mm;height:210mm;background-position:50% 50%")}
<div style="position:absolute;left:192mm;right:16mm;top:24mm">
 <div class="kick">Habilitación · Nº 1 Robusto</div><h1 style="font-size:26pt">La anilla del medallón</h1>
 <ul class="clean" style="margin-top:3mm">
  <li>Campo lacre con filetes de oro estampado y guilloché.</li>
  <li>Medallón oval troquelado con filigrana victoriana.</li>
  <li>Viñeta grabada: las manos del torcedor en la mesa de torcer.</li>
  <li>Cinta esmaltada con <strong>ARNALDO</strong> en capitales grabadas.</li></ul>
 <p class="small" style="margin-top:5mm">En el arte final, la viñeta reproducirá las manos de Arnaldo y la cartela incorporará su firma real. Producción prevista: offset o tipografía + foil + relieve seco + troquel, a cepo real (≈90 × 17–20 mm).</p>
 <p class="cap">Render conceptual generado con IA (Qwen-Image). Las manos son ilustrativas, no las de Arnaldo.</p>
</div>""", dark=True, title="ANILLA Nº 1", left="192mm")

    # 12 · Nº 2 (si existe el render) y Nº 3
    if I_N2:
        add(f"""
{fig(I_N2, "left:0;top:0;width:178mm;height:210mm")}
<div style="position:absolute;left:192mm;right:16mm;top:24mm">
 <div class="kick">Habilitación · Nº 2 Toro</div><h1 style="font-size:26pt">La anilla de oro</h1>
 <ul class="clean" style="margin-top:3mm">
  <li>Campo de oro con guilloché y bordes perlados.</li>
  <li>Sello central lacre con una hoja de tabaco grabada en oro.</li>
  <li><strong>ARNALDO</strong> en lacre y «Nº 2» en oro.</li>
  <li>Junto al puro, la chaveta: la cuchilla de media luna del torcedor.</li></ul>
 <p class="cap" style="margin-top:6mm">Render conceptual generado con IA (Qwen-Image).</p>
</div>""", dark=True, title="ANILLA Nº 2", left="192mm")

    add(f"""
{fig(I_N3, "left:0;top:0;width:178mm;height:210mm;background-position:50% 50%")}
<div style="position:absolute;left:192mm;right:16mm;top:24mm">
 <div class="kick">Habilitación · Nº 3 Churchill</div><h1 style="font-size:26pt">La edición negra</h1>
 <ul class="clean" style="margin-top:3mm">
  <li>Laca negra brillante, lisa.</li>
  <li>Bordes de oro con un patrón de hoja de palma inspirado en la yagua.</li>
  <li>Cartela central de oro con <strong>ARNALDO</strong> y «Nº 3».</li>
  <li>Reservada a la edición limitada (prevista para 2030).</li></ul>
 <p class="small" style="margin-top:5mm">La yagua —la vaina de la palma real con que se envuelven los tercios de tabaco— es un material propio del oficio; aquí inspira un patrón exclusivo de ARNALDO.</p>
 <p class="cap">Render conceptual generado con IA (Qwen-Image). Retocado para sustituir un patrón de damero por laca lisa y eliminar un guion sobrante.</p>
</div>""", dark=True, title="ANILLA Nº 3", left="192mm")

    # 13 · Vista
    add(f"""
{fig(I_VISTA, "left:0;top:0;width:297mm;height:162mm;background-position:50% 45%")}
<div style="position:absolute;left:18mm;right:18mm;top:168mm" class="grid2">
 <div><div class="kick">Habilitación · Vista</div><h2 style="font-size:17pt;margin:0">El interior de la tapa: «Pliego de autor»</h2></div>
 <div><p class="small" style="margin:0">Litografía a varias tintas (≈200 × 120 mm) con medallón grabado, filigrana de oro y rosetas en las esquinas. En el arte final, retrato grabado de Arnaldo si lo autoriza. Render conceptual generado con IA (Qwen-Image), recortado para excluir las anillas pequeñas.</p></div>
</div>""", dark=True, title="VISTA")

    # 14 · La gama
    gama_img = fig(I_GAMA, "right:18mm;top:28mm;width:98mm;height:56mm;border-radius:1mm")
    add(f"""<div class="pad">
<div class="kick">La gama</div><h1>Una vitola para empezar; dos para crecer</h1>
{gama_img}
<div style="margin-top:4mm">{vitolas_svg()}</div>
<table style="margin-top:2mm">
<thead><tr><th>Nombre</th><th>Vitola</th><th>Calendario</th><th>Complejidad de fabricación</th></tr></thead>
<tbody>
<tr><td><strong>Nº 1</strong></td><td>Robusto</td><td>Lanzamiento 2028, solo si se cumplen C1–C8</td><td>Media: formato versátil, consumo de capa moderado, tiro estable</td></tr>
<tr><td><strong>Nº 2</strong></td><td>Toro</td><td>Extensión 2029</td><td>Media-alta: los cepos grandes tienden a irregularidades de tiro y combustión</td></tr>
<tr><td><strong>Nº 3</strong></td><td>Churchill (Julieta No. 2)</td><td>Edición limitada 2030</td><td>Alta: capa larga sin defectos y torcedores de máxima categoría</td></tr>
</tbody></table>
<p class="small" style="margin-top:3mm">Dibujo a escala 1:1 si se imprime en A4 al 100 %. Medidas orientativas habituales del sector {T("PROBABLE")}; la vitola de galera exacta la fija la fábrica. Por qué Nº 1 primero: es el formato con más rotación en expendedurías especialistas y el más comparable con referencias de precio conocidas.</p>
</div>""", title="GAMA")

    # 15 · Sistema visual
    sw = [("#8E1B1B", "Lacre", "Campo de la anilla Nº 1, sellos"), ("#14100D", "Negro laca", "Edición Nº 3, fondos"),
          ("#C9A24A", "Oro viejo", "Foil, filetes, guilloché"), ("#F4EBD8", "Marfil", "Papel de la vista, cintas")]
    sws = "".join(f'<div><div class="swatch" style="background:{c}"></div><h3 style="color:#1E1915">{nme}</h3><p class="small" style="margin:0">{c} · {use}</p></div>' for c, nme, use in sw)
    emb = (f'<div style="position:absolute;right:18mm;bottom:20mm;width:62mm;height:62mm;background:url(\'{I_EMBLEMA}\') center/cover;border-radius:50%"></div>'
           if I_EMBLEMA else "")
    add(f"""<div class="pad">
<div class="kick">Sistema visual</div><h1>Paleta y tipografía</h1>
<div class="grid4" style="margin-top:5mm">{sws}</div>
<div class="grid2" style="margin-top:9mm;gap:12mm;{'margin-right:70mm' if I_EMBLEMA else ''}">
 <div><h3>Wordmark provisional</h3>
  <div style="background:#14100D;padding:6mm 6mm;text-align:center">{wordmark(13, 82)}</div>
  <p class="small" style="margin-top:2mm">Uso interno. El definitivo lo dibujará a medida un diseñador especializado e incorporará la firma real de Arnaldo.</p></div>
 <div><h3>Tipografías de trabajo</h3>
  <p style="font-family:Cinzel;font-size:13pt;letter-spacing:.12em;margin:0">CINZEL · TITULARES</p>
  <p style="font-family:'Cormorant Garamond';font-size:15pt;margin:0">Cormorant Garamond · <em>texto editorial</em></p>
  <p style="font-family:Inter;font-size:10pt;margin:0 0 2mm">Inter · datos y tablas</p>
  <p class="small">Licencia SIL OFL 1.1, verificada. Los Pantone y acabados definitivos los fijará el diseñador con pruebas de imprenta.</p></div>
</div>{emb}</div>""", title="SISTEMA VISUAL")

    # 16 · Autenticidad verificable
    add(f"""<div class="pad">
<div class="kick">Producto y calidad</div><h1>Autenticidad que se puede comprobar</h1>
<div style="display:grid;grid-template-columns:1fr 1fr 1fr 64mm;gap:6mm;margin-top:2mm">
 <div class="card"><h3>Pliego</h3><p>Cada lote registra número, vitola, fecha de torcido, unidades torcidas, rechazadas y expedidas, rango de cajas, tratamiento antiplagas, puntuación de cata, factura y DUA.</p></div>
 <div class="card"><h3>Colofón</h3><p>Cada caja reproduce pliego, fecha y número de caja sobre el total. Es la prueba física de la promesa de la marca.</p></div>
 <div class="card"><h3>Ficha técnica</h3><p>Liga, fermentación, bonchado e ingredientes documentados por la fábrica, sin inventar contenidos: nada de fincas ni añadas que no consten.</p></div>
 <div><div style="background:#F4EBD8;border:1px solid #C9A24A;outline:1px solid #C9A24A;outline-offset:-2.2mm;padding:5mm 4mm;text-align:center;box-shadow:0 1mm 3mm rgba(0,0,0,.12)">
  <div style="font-family:Cinzel;font-weight:600;font-size:10pt;letter-spacing:.3em;color:#14100D">ARNALDO</div>
  <div style="font-family:Cinzel;font-size:6pt;letter-spacing:.25em;color:#8E1B1B;margin:1.5mm 0 2.5mm">PLIEGO Nº 001</div>
  <div style="font-family:'Cormorant Garamond';font-size:9.5pt;line-height:1.3;color:#3A2E25">Nº 1 · Robusto<br>Caja <strong>0001</strong> de 0500</div>
  <div style="font-family:'Cormorant Garamond';font-style:italic;font-size:8.5pt;color:#3A2E25;margin-top:2mm">Torcido a mano por</div>
  <div style="border:1px dashed #C9A24A;margin:1.5mm 4mm 0;padding:1.5mm;font-size:6pt;color:#8A8073">firma de Arnaldo</div>
 </div><p class="small" style="margin-top:1.5mm">Maqueta tipográfica del colofón; numeración de ejemplo.</p></div>
</div>
<table style="margin-top:5mm">
<thead><tr><th style="width:18%">Atributo</th><th style="width:32%">Método</th><th>Criterio (a cerrar con la fábrica)</th></tr></thead>
<tbody>
<tr><td>Longitud y cepo</td><td>Calibre y regla</td><td>±2 mm / ±1 cepo {T("HIPÓTESIS")}</td></tr>
<tr><td>Tiro</td><td>Medidor de resistencia al tiro</td><td>Rango de ficha; 0 tiros bloqueados</td></tr>
<tr><td>Consistencia</td><td>Catas ciegas de 3 catadores, 5 unidades por pliego</td><td>Desviación entre unidades por debajo del umbral acordado</td></tr>
<tr><td>Conservación</td><td>Higrómetro y pesada</td><td>16–18 °C y 65–70 % HR {T("PROBABLE")}</td></tr>
<tr><td>Muestreo</td><td>ISO 2859-1, nivel II</td><td>AQL 1,0 (defectos mayores) y 2,5 (menores); 0 defectos críticos; propuesta: reposición a cargo del fabricante por encima del 3 % de rechazo</td></tr>
</tbody></table>
<p class="small" style="margin-top:3mm">El torcedor aporta construcción y consistencia física; la liga, la escogida de capas, el control de calidad y el almacén de hoja requieren una fábrica autorizada.</p>
</div>""", title="CALIDAD")

    # 17 · Canal y regulación
    hum = fig(I_HUMIDOR, "right:0;top:0;width:100mm;height:210mm")
    add(f"""{hum}<div class="pad" style="{'right:118mm' if I_HUMIDOR else ''}">
<div class="kick">Canal y marco regulatorio</div><h1>Una marca que se construye en el humidor</h1>
<div class="{'grid2' if not I_HUMIDOR else ''}" style="margin-top:4mm;gap:10mm">
 <div><h3>Lo que fija la ley</h3><ul class="clean">
  <li>Venta solo en expendedurías (≈13.000), abastecidas por un distribuidor mayorista habilitado {T("VERIFICADO")}.</li>
  <li>Prohibidas la venta online al consumidor y la venta a distancia transfronteriza.</li>
  <li>Prohibida la publicidad al consumidor (Ley 28/2005): solo comunicación profesional.</li>
  <li>Habilitación CMT, EU-CEG, marcas fiscales y trazabilidad, PVP publicado en el BOE.</li>
  <li>Zona de advertencia sanitaria en el envase conforme al RD 579/2017.</li></ul></div>
 <div style="{'margin-top:6mm' if I_HUMIDOR else ''}"><h3>Lo que implica para la marca</h3>
  <p>El escaparate es el humidor de la expendeduría especialista y el prescriptor es el estanquero. La marca debe ganar en la comparación directa, caja junto a caja, y apoyarse en hechos verificables: pliego, colofón y ficha técnica.</p>
  <p>Objetivo de validación: al menos <strong>10 expendedurías especialistas</strong> interesadas por escrito (condición C6).</p></div>
</div></div>""", title="CANAL")

    # 18 · Protección de la marca
    add(f"""<div class="pad">
<div class="kick">Protección del activo</div><h1>La marca será de la sociedad española</h1>
<div class="grid3" style="margin-top:4mm">
 <div class="card"><h3>Unión Europea</h3><p>Solicitud de ARNALDO como marca de la UE en clase 34 a nombre de la SL, con independencia de Cuba. Tasa base: 850 € por una clase {T("PROBABLE")}. Se presentará antes de compartir nombre y diseños con la contraparte cubana.</p></div>
 <div class="card"><h3>Firma</h3><p>La firma de Arnaldo se registra también como marca figurativa, junto con ARNALDO + apellido, con su consentimiento expreso.</p></div>
 <div class="card"><h3>Cuba</h3><p>Registro en la OCPI a través de agente oficial. Condición no negociable C2: titularidad del 100 % de la marca, nunca a nombre de una entidad cubana.</p></div>
</div>
<table style="margin-top:7mm">
<thead><tr><th style="width:30%">Riesgo de marca</th><th>Mitigación</th></tr></thead>
<tbody>
<tr><td>Titularidad exigida por la contraparte (precedentes: Davidoff, Vegas Robaina)</td><td>Registro previo en la UE a nombre de la SL; C2 como condición de entrada</td></tr>
<tr><td>Persona clave</td><td>Licencia irrevocable y transferible; cláusulas de salida y de fallecimiento; nombres de reserva FOLIO y LUMBRE</td></tr>
<tr><td>Registrabilidad no confirmada</td><td>Informe de agente en EUIPO, OEPM y OCPI (≈900 €) antes de producir; análisis de ARLONDO</td></tr>
<tr><td>Asociación con Arnaldo Vichot (maestro ligador de Partagás, fallecido en 2026)</td><td>No sugerir vínculo; apellido y firma propios</td></tr>
<tr><td>Parecido con Habanos u otras marcas</td><td>Lista de elementos prohibidos en el brief; revisión jurídica de las artes finales</td></tr>
</tbody></table>
<p class="small" style="margin-top:3mm">La búsqueda preliminar se hizo en fuentes web; no se consultaron EUIPO, OEPM ni OCPI directamente. Fuentes: S10, S13, S42, S49–S51, N05.</p>
</div>""", title="PROTECCIÓN")

    # 19 · Hoja de ruta e inversión en marca
    add(f"""<div class="pad">
<div class="kick">Hoja de ruta de la marca</div><h1>De concepto a arte final en ocho semanas</h1>
<table style="margin-top:4mm">
<thead><tr><th style="width:16%">Semanas</th><th style="width:44%">Hito</th><th style="width:20%">Coste estimado</th><th>Estado</th></tr></thead>
<tbody>
<tr><td>1–3</td><td>Consentimiento de Arnaldo y autorización de su empleador; 15–20 firmas escaneadas; retrato opcional</td><td>0 €</td><td>Pendiente</td></tr>
<tr><td>2–4</td><td>Tres presupuestos de estudios de packaging premium con el brief de 01_BRAND</td><td>0 €</td><td>Pendiente</td></tr>
<tr><td>3–6</td><td>Informe de registrabilidad de ARNALDO (reservas FOLIO y LUMBRE)</td><td>≈900 €</td><td>Pendiente</td></tr>
<tr><td>2–4 del encargo</td><td>Tres rutas creativas sobre la Ruta A v2</td><td rowspan="3">4.000–15.000 € {T("HIPÓTESIS")}</td><td rowspan="3">Por encargar</td></tr>
<tr><td>5–6 del encargo</td><td>Desarrollo de la ruta elegida: anillas Nº 1–3, vista, colofón</td></tr>
<tr><td>7–8 del encargo</td><td>Artes finales, separaciones de tinta y foil, pruebas de imprenta</td></tr>
<tr><td>Tras el informe</td><td>Solicitud de marca de la UE (clase 34) a nombre de la SL</td><td>≈1.100 € (tasa base de 850 € {T("PROBABLE")} + agente)</td><td>Pendiente</td></tr>
</tbody></table>
<div class="grid2" style="margin-top:7mm">
 <div class="card"><h3>Ya disponible</h3><p>Estrategia, naming, arquitectura de producto, brief creativo, ficha técnica editable y renders de exploración de la Ruta A v2 (este dossier).</p></div>
 <div class="card"><h3>Dentro del techo de la Fase 0</h3><p>El informe de marcas y la solicitud en la EUIPO están presupuestados dentro del techo de la Fase 0 (≤ 15.000 €). El diseño profesional se encarga cuando la Fase 0 confirme la vía legal.</p></div>
</div>
</div>""", title="HOJA DE RUTA")


    # 19b · Escenarios
    add(f"""<div class="pad">
<div class="kick">Escenarios</div><h1>Qué tiene que ser verdad</h1>
<table style="margin-top:2mm">
<thead><tr><th style="width:28%"></th><th>Conservador</th><th>Base</th><th>Optimista</th><th>Estrés</th></tr></thead>
<tbody>
<tr><td>PVP / FOB</td><td>20 € / 7,0 USD</td><td>24 € / 6,0 USD</td><td>28 € / 5,0 USD</td><td>24 € / 7,5 USD</td></tr>
<tr><td>Unidades en 2031</td><td>{M['cons_units_2031']}</td><td>{M['base_units_2031']}</td><td>{M['opt_units_2031']}</td><td>{M['stress_units_2031']}</td></tr>
<tr><td>Puntos de venta activos necesarios en 2031</td><td>{M['cons_pos_2031']}</td><td>{M['base_pos_2031']}</td><td>{M['opt_pos_2031']}</td><td>—</td></tr>
<tr><td>EBITDA 2031</td><td>{M['cons_ebitda_2031']}</td><td>{M['base_ebitda_2031']}</td><td>{M['opt_ebitda_2031']}</td><td>{M['stress_ebitda_2031']}</td></tr>
<tr><td>Necesidad máxima de financiación</td><td>{M['cons_need']}</td><td>{M['base_need']}</td><td>{M['opt_need']}</td><td>{M['stress_need']}</td></tr>
<tr class="hl"><td><strong>VAN al 18 %</strong></td><td>{M['cons_npv']}</td><td>{M['base_npv']}</td><td><strong>{M['opt_npv']}</strong></td><td>{M['stress_npv']}</td></tr>
</tbody></table>
<div class="grid3" style="margin-top:6mm">
 <div class="card"><h3>Precio y coste</h3><p>FOB ≤ ≈5 USD por unidad y un PVP ≥ 25 € aceptado por escrito por las expendedurías especialistas.</p></div>
 <div class="card"><h3>Demanda</h3><p>El Optimista necesita {M['opt_pos_2031']} puntos de venta activos: el doble de la demanda accesible estimada (1.600–6.000 u/año, 40–150 puntos) {T("HIPÓTESIS")}.</p></div>
 <div class="card"><h3>Equipo</h3><p>El modelo no retribuye al promotor: cada 10.000 €/año de remuneración añade ≈{M['base_be_per10k']} al punto muerto Base.</p></div>
</div>
<p class="small" style="margin-top:4mm">Sin probabilidades asignadas. Solo el escenario Optimista tiene VAN positivo (TIR {M['opt_irr']}, con valor terminal de 5× EBITDA 2031), y su flujo de caja acumulado sigue siendo negativo en 2031. Fuente: Financial Model 2027–2031.xlsx, hoja «Scenarios»; detalle en Scenario Analysis.pdf.</p>
</div>""", title="ESCENARIOS")

    # 19c · Fase 0
    add(f"""<div class="pad">
<div class="kick">Lo que compra el primer euro</div><h1>Una opción barata antes de una apuesta cara</h1>
<div class="grid3" style="margin-top:3mm">
 <div class="card"><div class="stat">{M['plan_cost_30']}</div><h3>30 días</h3><p>Abogados en Cuba y España, identidad de la fábrica, consultas a CMT, TARIC, BOE y banco, encargo del informe de marcas.</p></div>
 <div class="card"><div class="stat">{M['plan_cost_90']}</div><h3>90 días · comité Go/No-Go</h3><p>Capacidad legal de exportación, due diligence de la fábrica, dictamen de marca y de sanciones, solicitud EUIPO, 15 entrevistas a estanqueros.</p></div>
 <div class="card"><div class="stat">{M['plan_cost_180']}</div><h3>180 días · solo con Go</h3><p>SL, diseño profesional, prototipos y catas, term sheet, habilitaciones, EU-CEG, cartas de interés y distribuidor.</p></div>
</div>
<div class="grid2" style="margin-top:7mm;gap:10mm">
 <div><h3>Regla de capital</h3><ul class="clean">
  <li>Fase 0: ≤ 15.000 €, con capital propio del promotor.</li>
  <li>Pedido piloto (1.000–3.000 u): solo con C1–C8 cumplidas; un pedido de 3.000 u necesita {M['wc_peak']} de caja.</li>
  <li>Proyecto completo: {M['opt_need']}–{M['cons_need']} según escenario.</li></ul></div>
 <div><h3>Si la vía cubana no se abre</h3><ul class="clean">
  <li>Importación de marcas premium no cubanas (vía B3): contribución {M['b3_contrib']}/u a PVP 15 €, punto muerto ≈{M['b3_be']} u/año, 40–60 k€ de capital {T("HIPÓTESIS")}.</li>
  <li>ARNALDO con origen alternativo (República Dominicana o Nicaragua): {ph('d13_plan_b', 'decisión D13: ¿plan B de origen?')}</li></ul></div>
</div>
<p class="small" style="margin-top:4mm">Fuente: 07_OPERATIONS/180-Day Execution Plan.xlsx (costes acumulados {T("HIPÓTESIS")}), Business Case y Premium Import Business Case.</p>
</div>""", title="FASE 0")


    # 19d · Propuesta por tramos
    add(f"""<div class="pad">
<div class="kick">Propuesta de inversión · recomendación pendiente de decisión (D12)</div><h1>Capital por tramos, liberado por hechos</h1>
<table style="margin-top:2mm">
<thead><tr><th style="width:16%">Tramo</th><th style="width:16%">Importe</th><th style="width:22%">Quién aporta</th><th style="width:26%">Qué compra</th><th>Se libera solo si…</th></tr></thead>
<tbody>
<tr class="hl"><td><strong>0 · Fase 0</strong></td><td>≤ 15.000 € ({M['plan_cost_90']} previstos a 90 días)</td><td>Promotor, con capital propio</td><td>Vía legal, titularidad de la marca, sanciones, registrabilidad, 15 entrevistas</td><td>Aprobación del promotor (D01)</td></tr>
<tr><td><strong>1 · Piloto</strong></td><td>Necesidad de caja de un pedido de 3.000 u: {M['wc_peak']}, más gastos fijos</td><td>Promotor e inversor(es)</td><td>SL, diseño profesional, habilitaciones, EU-CEG, pedido piloto</td><td>C1–C8 cumplidas y documentadas</td></tr>
<tr><td><strong>2 · Escalado</strong></td><td>Hasta la necesidad máxima: {M['opt_need']}–{M['cons_need']}</td><td>Inversor(es) o financiación</td><td>Segundo pedido, extensión Nº 2 y red de puntos de venta</td><td>KPIs del Business Plan durante 12 meses: contribución ≥ 4 €/u, ≥ 4 cajas por punto y año, rechazo ≤ 3 %, ≥ 40 puntos activos</td></tr>
</tbody></table>
<div class="grid3" style="margin-top:7mm">
 <div class="card"><h3>Qué no se pide</h3><p>Ningún capital externo antes del Go de la Fase 0. Ningún anticipo a fábrica sin las ocho condiciones.</p></div>
 <div class="card"><h3>Instrumentos posibles</h3><p>Capital en la SL española o préstamo participativo (p. ej. ENISA) con el plan validado {T("HIPÓTESIS")}. La valoración se negocia después de la Fase 0, con hechos.</p></div>
 <div class="card"><h3>Protección del inversor</h3><p>Marca a nombre de la SL, licencia irrevocable de nombre y firma, liberación por hitos y opción de redirigir el capital a la vía B3 si Cuba no se abre.</p></div>
</div>
<table style="margin-top:6mm"><thead><tr><th colspan="4">Decisión del promotor (D12)</th></tr></thead><tbody>
<tr><td style="width:22%">Opción</td><td>{ph('d12_opcion', 'A sin inversores hasta el Go · B tramo 1 · C socio estratégico')}</td><td style="width:18%">Importe a captar</td><td>{ph('d12_importe', 'importe aproximado')}</td></tr>
<tr><td>Participación a ceder</td><td>{ph('d12_participacion', '% o «a negociar»')}</td><td>Instrumento</td><td>{ph('d12_instrumento', 'capital / préstamo participativo')}</td></tr>
</tbody></table>
<p class="small" style="margin-top:3mm">Importes de los modelos del dossier. La valoración se negocia después de la Fase 0.</p>
</div>""", title="PROPUESTA")

    # 19e · Equipo
    add(f"""<div class="pad">
<div class="kick">Equipo y gobierno</div><h1>Quién lo hace</h1>
<div class="grid2" style="gap:10mm;margin-top:2mm">
 <div>
  <div class="card" style="margin-bottom:5mm"><h3>Promotor · {ph('promotor_nombre', 'nombre y apellidos')}</h3>
   <p style="margin-bottom:1.5mm">Dirección y desarrollo comercial; titular de la SL española.</p>
   <p style="margin-bottom:1.5mm"><strong>Experiencia:</strong> {ph('promotor_experiencia', 'sector, cargos y años')}</p>
   <p style="margin-bottom:1.5mm"><strong>Dedicación:</strong> {ph('promotor_dedicacion', 'completa o parcial')} · <strong>Aportación:</strong> {ph('promotor_capital', 'capital propio')}</p>
   <p style="margin:0"><strong>Relación con Arnaldo:</strong> {ph('promotor_vinculo', 'desde cuándo y cómo')}</p></div>
  <div class="card"><h3>Arnaldo {ph('arnaldo_apellidos', 'apellidos')}, torcedor</h3>
   <p style="margin-bottom:1.5mm">Nombre, firma y criterio de construcción, a través de la entidad autorizada y con permiso de su empleador.</p>
   <p style="margin-bottom:1.5mm"><strong>Categoría y oficio (acreditados):</strong> {ph('arnaldo_categoria', 'solo con documento')}</p>
   <p style="margin:0"><strong>Entidad en la que trabaja:</strong> {ph('arnaldo_empresa', 'razón social')}</p></div>
 </div>
 <div><h3>Asesores externos (por contratar en la Fase 0)</h3>
  <table><tbody>
  <tr><td>Abogado cubano habilitado</td><td>Vía legal, due diligence de la fábrica, contratos</td></tr>
  <tr><td>Abogado español de comercio exterior</td><td>Contratos, sanciones UE/EE. UU.</td></tr>
  <tr><td>Asesor fiscal España–Andorra</td><td>Residencia, estructura, retribución</td></tr>
  <tr><td>Agente de marcas</td><td>Registrabilidad y registro en la UE y en Cuba</td></tr>
  <tr><td>Asesor regulatorio</td><td>CMT, EU-CEG, trazabilidad, PVP en el BOE</td></tr>
  <tr><td>Operador logístico habilitado</td><td>Depósito fiscal y distribución</td></tr>
  <tr><td>Estudio de packaging premium</td><td>Identidad definitiva (tras el Go)</td></tr>
  </tbody></table></div>
</div>
<p class="small" style="margin-top:5mm">Gobierno: comité Go/No-Go con acta en la semana 11; ninguna comunicación externa ni pago sin aprobación del promotor; screening de sanciones de cada contraparte (SOP-01).</p>
</div>""", title="EQUIPO")

    # 20 · Estado y condiciones
    add(f"""<div class="pad">
<div class="kick">Estado del proyecto</div><h1>Una marca preparada, una inversión condicionada</h1>
<p><span class="verdict">CONDITIONAL GO</span> — solo Fase 0 y validación (≤ 15.000 €). <strong>NO-GO</strong> a cualquier anticipo, producción o stock hasta cumplir las ocho condiciones verificables.</p>
<table style="margin-top:3mm">
<thead><tr><th style="width:6%"></th><th style="width:52%">Condición</th><th>Evidencia</th></tr></thead>
<tbody>
<tr><td class="num">C1</td><td>Autorización documentada de fabricación y exportación para una marca de titularidad extranjera</td><td>Licencia o carta oficial</td></tr>
<tr><td class="num">C2</td><td>Titularidad del 100 % de la marca aceptada (UE y Cuba)</td><td>Term sheet + OCPI</td></tr>
<tr><td class="num">C3</td><td>FOB firme compatible con ≤ 5 USD a PVP 24 € (o un PVP mayor validado)</td><td>Oferta firmada</td></tr>
<tr><td class="num">C4</td><td>Canal de pago validado y dictamen de sanciones UE/EE. UU. sobre la contraparte</td><td>Banco + dictamen de abogado</td></tr>
<tr><td class="num">C5</td><td>Distribuidor habilitado dispuesto</td><td>Carta de intención</td></tr>
<tr><td class="num">C6</td><td>≥ 10 expendedurías especialistas interesadas</td><td>Cartas</td></tr>
<tr><td class="num">C7</td><td>Informe de registrabilidad favorable</td><td>Agente de marcas</td></tr>
<tr><td class="num">C8</td><td>Capital ≥ necesidad del escenario Conservador + 25 % (o socio o financiación comprometidos)</td><td>Modelo + compromiso</td></tr>
</tbody></table>
<p class="small" style="margin-top:3mm">Hoy no consta una vía pública y verificada para que una sociedad extranjera fabrique en Cuba una marca propia {T("BLOQUEADO")}: es la cuestión que resuelve la Fase 0. Necesidad máxima de financiación del proyecto completo: de {M['opt_need']} (Optimista) a {M['cons_need']} (Conservador). Cifras, escenarios y riesgos completos: Executive Investment Memorandum y Business Case.</p>
</div>""", title="ESTADO")

    # 21 · Notas
    add(f"""<div class="pad">
<div class="kick">Notas</div><h1>Sobre este documento</h1>
<div class="grid2" style="gap:12mm;margin-top:4mm">
 <div><h3>Imágenes</h3>
  <p>Todas las imágenes de producto son <strong>renders conceptuales</strong> generados con IA (Qwen-Image, vía Hugging Face) en octubre de 2026 para orientar al diseñador y a los inversores. No son artes finales ni fotografías de producto existente.</p>
  <p>Cada render se ha revisado letra por letra. Los que tenían errores de texto se han retocado (lo indica su pie de imagen) o se han descartado. Los retoques están documentados y son reproducibles: <code>01_BRAND/renders/README.md</code> y <code>_build/renders</code>.</p>
  <p>La firma, la viñeta y el retrato definitivos serán los de Arnaldo, con su consentimiento.</p></div>
 <div><h3>Fuentes y límites</h3>
  <p>Datos de mercado, precios y normativa procedentes de fuentes públicas consultadas el {FECHA} (09_RESEARCH/Source Register.xlsx). Etiquetas: {T("VERIFICADO")} {T("PROBABLE")} {T("HIPÓTESIS")} {T("BLOQUEADO")}.</p>
  <p>La disponibilidad registral de ARNALDO no está confirmada en registros oficiales. No se ha contactado con ninguna entidad y no hay nada firmado.</p>
  <h3 style="margin-top:5mm">Aviso</h3>
  <p class="small">Documento confidencial de trabajo, dirigido a inversores y asesores profesionales. No constituye una oferta de valores ni asesoramiento jurídico, fiscal o financiero, y no es material publicitario dirigido al consumidor (Ley 28/2005). Requiere revisión profesional antes de cualquier decisión, firma o comunicación externa.</p></div>
</div></div>""", title="NOTAS")

    html = f"""<!doctype html><html lang="es"><head><meta charset="utf-8"><title>ARNALDO — Dossier de marca</title>
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
