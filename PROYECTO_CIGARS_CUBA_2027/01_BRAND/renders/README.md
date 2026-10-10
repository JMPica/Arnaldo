# Renders de exploración ARNALDO

Generats amb Runway el 10/10/2026 (pla gratuït del compte; queden 3 crèdits). Són conceptes per al dissenyador, no arts finals.

| Fitxer | Ruta | Model | Notes |
|---|---|---|---|
| arnaldo-render-anilla-clasica.png | A · Habilitació clàssica | Nano Banana Pro | La signatura sota el nom és inventada per la IA: cal substituir-la per la real |
| arnaldo-render-caja-abierta-vista.jpg | A · Caixa i vista | Nano Banana 2 Lite | Errors de text a les anelles petites |
| arnaldo-render-anilla-firma-a.jpg / -b.jpg | B · Signatura | Nano Banana 2 Lite | Depèn de la signatura real |

## Ruta A v2 · «Grans Habanos» (Hugging Face · Qwen-Image)

Generats el 10/10/2026 amb l'Space `mcp-tools/Qwen-Image` (16 passos, guidance 4, quota gratuïta ZeroGPU). Prompts A2-1 a A2-5 del Prompt Pack, amb el *negative prompt* canviat perquè no esborri el text ARNALDO.

| Fitxer | Prompt | Estat | Notes |
|---|---|---|---|
| arnaldo-a2-1-anilla-medallon.png | A2-1 | Original | El nom surt «ARNA·L·DO», amb punts de més |
| **arnaldo-a2-1-anilla-medallon-ret.png** | A2-1 | ✅ Al dossier | Punts eliminats i lletres reespaiades (`_build/renders/fix_a21_ribbon.py`). La vinyeta mostra un torcedor genèric, no Arnaldo |
| arnaldo-a2-2-emblema-chavetas.png | A2-2 | ❌ Descartat | Text inventat, «-R-N-A-L-D-», ganivets de cuina |
| arnaldo-a2-2-emblema-chavetas-v2.png | A2-2 (prompt ajustat) | ❌ Descartat | Text inventat («CHAI… EITS») i concepte confús (puro + mànec); el retoc no queda net. Es regenera (A2-7) |
| arnaldo-a2-3-edicion-negra.png | A2-3 | Original | Quadriculat (codi Cohiba prohibit) i guionet de més a «Nº- 3» |
| **arnaldo-a2-3-edicion-negra-ret.png** | A2-3 | ✅ Al dossier | Quadriculat substituït per laca llisa i guionet eliminat (`_build/renders/fix_a23_lacquer.py`) |
| arnaldo-a2-4-caja-vista.png | A2-4 | Original | Tapa correcta; les anelles petites tenen un monograma inventat i lletres tallades |
| **arnaldo-a2-4-caja-vista-pano.png** | A2-4 | ✅ Al dossier | Retall panoràmic sense les anelles (`_build/renders/crop_a24_pano.py`). El graner té aspecte nord-americà: es regenera amb casa de tabac de sostre de palma (A2-8) |
| arnaldo-a2-5-tres-vitolas.png | A2-5 | ❌ Descartat | «ORNADO», «Nº3 … 2», chavetes com ossos. Es regenera sense text (A2-9) |

Retoc i revisió: cada imatge s'ha revisat lletra per lletra; al dossier només hi van les marcades ✅.

**Cua pendent** (`_build/renders/queue_2026-10-11.json`, quota ZeroGPU esgotada el 10/10): A2-6 anella Nº 2 d'or, A2-7 emblema de chavetes, A2-8 vista amb casa de tabac, A2-9 tres vitoles sense text, A2-10 mans del torcedor, A2-11 humidor. Generar amb `python3 -I _build/renders/gen_qwen.py _build/renders/queue_2026-10-11.json PROYECTO_CIGARS_CUBA_2027/01_BRAND/renders`. El dossier les incorpora automàticament quan hi ha la versió `-ret.png` revisada.

Dossier per a inversors: `../ARNALDO Brand Dossier.pdf` (`_build/build_dossier.py`).

Prompts: `../Higgsfield Prompt Pack.md` (vàlids també per a Runway, ChatGPT, Gemini o Ideogram).
