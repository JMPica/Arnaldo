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
| arnaldo-a2-1-anilla-medallon.png | A2-1 | ✅ Bo | El nom surt «ARNA·L·DO» amb punts de més; la vinyeta mostra el torcedor sencer (cara inclosa), no només les mans |
| arnaldo-a2-2-emblema-chavetas.png | A2-2 | ❌ Descartar | Text inventat a dalt, «-R-N-A-L-D-» a baix, ganivets de cuina en lloc de chavetes |
| arnaldo-a2-2-emblema-chavetas-v2.png | A2-2 (prompt ajustat) | ⚠️ Parcial | ARNALDO net i la mitja lluna de la chaveta ben resolta, però hi ha text inventat («CHAI… EITS») sobre una peça en forma de puro |
| arnaldo-a2-3-edicion-negra.png | A2-3 | ⚠️ Revisar | Molt bona execució, però hi apareix un quadriculat (codi Cohiba prohibit): cal treure'l |
| arnaldo-a2-4-caja-vista.png | A2-4 | ✅ El millor | «ARNALDO» i «Pliego de autor» correctes; les anelles petites dels puros són il·legibles |
| arnaldo-a2-5-tres-vitolas.png | A2-5 | ❌ Descartar | «ORNADO», la tercera anella posa «Nº3 … 2», les chavetes semblen ossos |

Pendent: refer A2-3 i A2-5 amb prompt ajustat quan es renovi la quota (24 h) o amb Hugging Face PRO.

Prompts: `../Higgsfield Prompt Pack.md` (vàlids també per a Runway, ChatGPT, Gemini o Ideogram).
