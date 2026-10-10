# -*- coding: utf-8 -*-
"""Renderiza docs/*.md (con front matter YAML) a PDF (HTML + Chromium) y/o DOCX (pandoc).
Sustituye {{clave}} por cifras de metrics.json para mantener coherencia con los modelos."""
import os, re, sys, json, subprocess, tempfile, base64, glob
import yaml
from docx import Document
from docx.shared import Pt, RGBColor

B = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(B, "..", "PROYECTO_CIGARS_CUBA_2027"))
CHROME = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"
M = json.load(open(os.path.join(B, "metrics.json")))
ASSETS = os.path.join(ROOT, "01_BRAND", "assets")


def fontface():
    css = ""
    for fam, pat in [("Cormorant Garamond", "cormorant-garamond-latin-{w}-{s}.woff2"), ("Inter", "inter-latin-{w}-{s}.woff2")]:
        for w in (300, 400, 500, 600):
            for st in ("normal", "italic"):
                p = os.path.join(B, "fonts", pat.format(w=w, s=st))
                if os.path.exists(p):
                    css += f"@font-face{{font-family:'{fam}';font-weight:{w};font-style:{st};src:url('file://{p}') format('woff2');}}\n"
    return css


CSS = fontface() + open(os.path.join(B, "doc.css")).read()


def subst(text):
    def rep(m):
        k = m.group(1)
        if k not in M:
            raise KeyError("metric missing: " + k)
        return str(M[k])
    text = text.replace("{ASSETS}", ASSETS)
    return re.sub(r"\{\{([a-z0-9_]+)\}\}", rep, text)


TAGS = {"VERIFICADO": "v", "PROBABLE": "p", "HIPÓTESIS": "h", "BLOQUEADO": "b", "VERIFICAT": "v", "HIPÒTESI": "h", "BLOQUEJAT": "b"}


def badges(html):
    for t, c in TAGS.items():
        html = re.sub(r"\[" + t + r"([^\]]*)\]", lambda m: f'<span class="tag {c}">{t}</span>' + (f'<span class="tagx">{m.group(1)}</span>' if m.group(1) else ""), html)
    return html


def ref_docx():
    p = os.path.join(B, "reference.docx")
    if os.path.exists(p):
        return p
    subprocess.run(["pandoc", "--print-default-data-file", "reference.docx"], check=True, stdout=open(p, "wb"))
    d = Document(p)
    st = d.styles
    st["Normal"].font.name = "Calibri"
    st["Normal"].font.size = Pt(10.5)
    for name, size in [("Title", 24), ("Heading 1", 16), ("Heading 2", 13), ("Heading 3", 11.5)]:
        try:
            s = st[name]
            s.font.name = "Georgia"
            s.font.size = Pt(size)
            s.font.color.rgb = RGBColor(0x5A, 0x3E, 0x2B)
            s.font.bold = name != "Title"
        except KeyError:
            pass
    for name in ("Subtitle",):
        try:
            st[name].font.color.rgb = RGBColor(0x8C, 0x87, 0x7E)
        except KeyError:
            pass
    d.save(p)
    return p


def render(md_path):
    raw = open(md_path, encoding="utf-8").read()
    _, fm, body = raw.split("---", 2)
    meta = yaml.safe_load(fm)
    body = subst(body)
    outs = meta["out"]
    tmp = tempfile.mkdtemp()
    src = os.path.join(tmp, "doc.md")
    open(src, "w", encoding="utf-8").write(body)
    for o in outs:
        dest = os.path.join(ROOT, o)
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        if o.endswith(".docx"):
            mdx = os.path.join(tmp, "docx.md")
            hdr = f"---\ntitle: \"{meta['title']}\"\nsubtitle: \"{meta.get('subtitle','')}\"\ndate: \"{meta.get('date','10/10/2026')}\"\n---\n\n"
            hdr += f"*{meta.get('disclaimer','Borrador de trabajo. Requiere revisión profesional antes de su uso o firma.')}*\n\n"
            open(mdx, "w", encoding="utf-8").write(hdr + body)
            subprocess.run(["pandoc", mdx, "-f", "markdown+pipe_tables+grid_tables", "-o", dest, "--reference-doc", ref_docx(), "--toc" if meta.get("toc") else "--standalone"], check=True)
        elif o.endswith(".pdf"):
            html_body = subprocess.run(["pandoc", src, "-f", "markdown+pipe_tables+grid_tables+raw_html", "-t", "html5"] + (["--toc", "-s", "--template", os.path.join(B, "toc_only.html")] if meta.get("toc") else []),
                                       check=True, capture_output=True, text=True).stdout
            html_body = badges(html_body)
            mono = open(os.path.join(ASSETS, "folio-monogram-ink.svg")).read() if meta.get("brand_mark", True) else ""
            cover = f"""<section class="cover"><div class="cover-top"><div class="mono">{mono}</div>
<div class="kicker">{meta.get('kicker','PROYECTO CIGARS CUBA 2027')}</div></div>
<h1 class="ctitle">{meta['title']}</h1><p class="csub">{meta.get('subtitle','')}</p>
<div class="cmeta"><div><span>Fecha de corte</span>{meta.get('date','10/10/2026')}</div><div><span>Versión</span>{meta.get('version','1.0 — borrador para revisión')}</div>
<div><span>Destinatarios</span>{meta.get('audience','Promotor, asesores, entidades financieras')}</div><div><span>Carpeta</span>{os.path.dirname(o)}</div></div>
<p class="disc">{meta.get('disclaimer','Documento de trabajo preparado con fuentes públicas consultadas el 10/10/2026. No constituye asesoramiento jurídico ni fiscal: requiere revisión profesional antes de cualquier decisión, firma o comunicación externa.')}</p></section>"""
            html = f"""<!doctype html><html lang="es"><head><meta charset="utf-8"><title>{meta['title']}</title><style>{CSS}</style></head>
<body><div class="runhead">{meta.get('short', meta['title'])}</div>{cover}<main>{html_body}</main></body></html>"""
            hp = os.path.join(tmp, "doc.html")
            open(hp, "w", encoding="utf-8").write(html)
            subprocess.run([CHROME, "--headless", "--no-sandbox", "--disable-gpu", "--no-pdf-header-footer", f"--print-to-pdf={dest}", "file://" + hp],
                           check=True, capture_output=True)
        elif o.endswith(".md"):
            open(dest, "w", encoding="utf-8").write(body.lstrip())
        print("  ->", o)


if __name__ == "__main__":
    files = sys.argv[1:] or sorted(glob.glob(os.path.join(B, "docs", "*.md")))
    for f in files:
        print(os.path.basename(f))
        render(f)
