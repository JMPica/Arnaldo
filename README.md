# PROYECTO CIGARS CUBA 2027

Dossier d'inversió per a una marca pròpia de cigars (ARNALDO VALLÉS, nom i cognom del torcedor; abans ARNALDO i FOLIO) fabricada a Cuba i per a la importació premium a Espanya. Data de tall: 10/10/2026.

- **Comença per:** `PROYECTO_CIGARS_CUBA_2027/00_EXECUTIVE/Executive Investment Memorandum.pdf` i `Project Status & Next Actions.md`.
- **Decisió:** CONDITIONAL GO només per a la Fase 0 (verificació jurídica a Cuba) i la validació comercial; NO-GO a qualsevol compromís de capital fins a complir les condicions C1–C8.
- Els documents executius són en castellà; l'estat del projecte és en català.

## Regenerar

Els fitxers es generen a partir de `_build/` (Python + LibreOffice + pandoc + Chromium):

```bash
cd _build
bash make_xlsx.sh                       # XLSX amb fórmules, recalculats
python3 extract_metrics.py ../PROYECTO_CIGARS_CUBA_2027 metrics.json
python3 audit_model.py ../PROYECTO_CIGARS_CUBA_2027 metrics.json   # auditoria independent: VAN, TIR i repartiment unitari
# Identitat: ARNALDO VALLÉS, anella clàssica (brand_clasica.py; brief per a dissenyador a 01_BRAND). Les versions FOLIO v1/v2 (brand_assets.py, brand_v2.py) queden arxivades.
python3 render_docs.py                  # PDF, DOCX i MD a partir de docs/*.md
python3 build_dossier.py                # 01_BRAND/ARNALDO VALLÉS Brand Dossier.pdf (dossier de marca per a inversors)
```

Les xifres dels documents s'injecten des dels models (`metrics.json`), de manera que canviar un supòsit i regenerar manté la coherència.

Treball preparat amb fonts públiques; requereix revisió jurídica i fiscal professional abans de qualsevol decisió, signatura o comunicació externa.
