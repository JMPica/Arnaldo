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
| arnaldo-a2-1-anilla-medallon-ret.png | A2-1 | Substituït per A2-15 | Punts eliminats i lletres reespaiades (`_build/renders/fix_a21_ribbon.py`). La vinyeta mostra un torcedor genèric, no Arnaldo |
| arnaldo-a2-2-emblema-chavetas.png | A2-2 | ❌ Descartat | Text inventat, «-R-N-A-L-D-», ganivets de cuina |
| arnaldo-a2-2-emblema-chavetas-v2.png | A2-2 (prompt ajustat) | ❌ Descartat | Text inventat («CHAI… EITS») i concepte confús (puro + mànec); el retoc no queda net. Es regenera (A2-7) |
| arnaldo-a2-3-edicion-negra.png | A2-3 | Original | Quadriculat (codi Cohiba prohibit) i guionet de més a «Nº- 3» |
| arnaldo-a2-3-edicion-negra-ret.png | A2-3 | Exploració (fora del dossier) | Quadriculat substituït per laca llisa i guionet eliminat (`_build/renders/fix_a23_lacquer.py`) |
| arnaldo-a2-4-caja-vista.png | A2-4 | Original | Tapa correcta; les anelles petites tenen un monograma inventat i lletres tallades |
| arnaldo-a2-4-caja-vista-pano.png | A2-4 | Exploració (fora del dossier) | Retall panoràmic sense les anelles (`_build/renders/crop_a24_pano.py`). El graner té aspecte nord-americà: es regenera amb casa de tabac de sostre de palma (A2-8) |
| arnaldo-a2-5-tres-vitolas.png | A2-5 | ❌ Descartat | «ORNADO», «Nº3 … 2», chavetes com ossos. Es regenera sense text (A2-9) |

| arnaldo-a2-12-anilla-medallon-manos.png | A2-12 (11/10) | ⚠️ No millora | Text correcte, però el model torna a dibuixar el torcedor sencer amb cara; es manté A2-1-ret |
| arnaldo-a2-6-anilla-n2-oro.png | A2-6 (11/10) | ⚠️ No s'usa | Text correcte («ARNALDO», «Nº2»), però les chavetes creuades semblen falçs: associació política inacceptable en una marca d'origen cubà. Es regenera amb chaveta tipus *ulu* (A2-14) |
| arnaldo-a2-7-emblema-chavetas.png | A2-7 (11/10) | ⚠️ No s'usa | Text perfecte; mateix problema de falçs creuades. Es regenera (A2-13) |
| arnaldo-a2-8-vista-casa-tabaco.png | A2-8 (11/10) | Original | Vista correcta amb casa de tabac de sostre de palma; anelles petites amb text deformat («RDNALLO») |
| arnaldo-a2-8-vista-casa-tabaco-ret.png | A2-8 | Exploració (fora del dossier) | Retall per sobre de les anelles; substitueix la vista anterior (graner d'aspecte nord-americà) |
| arnaldo-a2-9-tres-vitolas.png | A2-9 (11/10) | ❌ Descartat | Text inventat («Danills»); la tercera vitola sembla un tub |
| arnaldo-a2-10-manos-torcedor.png | A2-10 (11/10) | ❌ Descartat | Ganivet impossible; anelles de colors que recorden marques de Habanos |
| arnaldo-a2-11-humidor.png | A2-11 (11/10) | ❌ Descartat | Etiquetes amb pseudotext i anelles que recorden Habanos |

| arnaldo-a2-15-anilla-medallon-manos-ret.png (= -s1) | A2-15 (12/10) | Exploració (fora del dossier) (Nº 1) | Només mans, sense cara; «ARNALDO» net. Substitueix A2-1-ret. La variant -s2 mostra el tors (no s'usa) |
| arnaldo-a2-6-anilla-n2-oro-ret.png (= A2-14-s1) | A2-14 (12/10) | Exploració (fora del dossier) (Nº 2) | Segell lacre amb una fulla de tabac; «ARNALDO» i «Nº 2» correctes; chaveta real al costat del puro. La variant -s2 té un objecte ambigu al segell |
| arnaldo-a2-7-emblema-chavetas-ret.png (= A2-13-s2) | A2-13 (12/10) | Exploració (fora del dossier) (emblema) | Fulla de tabac sobre una chaveta de mitja lluna, sense fulles creuades. La variant -s1 barreja un puro i un ganivet (no s'usa) |

| arnaldo-a3-1-anilla-casa-ret.png | A3-1 (13/10) | Substituït per la v4 | Anella de la casa: lacre, or, perlat i cartel·la amb «ARNALDO» correcte. Substitueix el medalló com a imatge principal |
| arnaldo-a3-2-anilla-firma.png | A3-2 (13/10) | ❌ Descartat | La signatura diu «Arnuldo». Es repeteix (A3-2b) |
| arnaldo-a3-3-doble-anilla.png | A3-3 (13/10) | ❌ Descartat | «PLIEGO DE AUTOR» correcte, però un «1» i una titlla inventats travessen «ARNALDO»; el retoc no queda net. Es repeteix (A3-3b) |
| arnaldo-a3-4-caja-fuego-ret.png | A3-4 (13/10) | Substituït per la v4 (la foto és la base de la maqueta v4) | El render escrivia «ARNADO»: marca a foc regravada amb Cinzel en el pla de la tapa i veta real de la fusta (`_build/renders/fix_a34_branding.py`) |
| arnaldo-a3-5-caja-abierta-casa-ret.png | A3-5 (13/10) | Substituït per la vista vectorial v4 | Vista clàssica a una tinta amb paper de vores; retall per sobre de les anelles petites (`_build/renders/crop_a35_vista.py`) |

Retoc i revisió: cada imatge s'ha revisat lletra per lletra; al dossier només hi van les marcades ✅.


## Ruta A v4 · «Montecristo × Hoyo de Monterrey» (13/10/2026)

Els renders de la v3 no arriben al nivell buscat i el promotor demana centrar-se en Montecristo i Hoyo de Monterrey. Canvi de mètode: **l'art amb text és vectorial** (`_build/brand_v4.py` → `../assets/v4/`, text convertit a traçats, sense errors possibles) i **la IA només genera fotografies sense text**, sobre les quals es compon l'art.

| Fitxer | Origen | Estat | Notes |
|---|---|---|---|
| **arnaldo-v4-caja-marca-fuego.png** | A3-4 + marca a foc v4 | ✅ Al dossier (caixa) | Marca generada esborrada amb veta real; emblema i ARNALDO vectorials gravats amb homografia al pla de la tapa (`_build/renders/mock_v4_caja.py`) |
| ../assets/v4/arnaldo-v4-anilla-n1/-n2/-n3-negra | Vectorial | ✅ Al dossier | Anelles Nº 1 (marfil i lacre), Nº 2 (marfil i negre), Nº 3 (negra i lacre) |
| ../assets/v4/arnaldo-v4-anilla-pliego, -emblema, -vista, -marca-fuego | Vectorial | ✅ Al dossier | Segona anella, monograma, vista i marca a foc |

Les imatges de la v3 (A3-1, A3-4-ret, A3-5-ret) i de la v2 ja no surten al dossier; es conserven com a exploració.

**Cua** (`_build/renders/queue_2026-10-14-v4.json`, programada el 14/10 a les 15:45 UTC): fotos sense text (puro dret amb anella llisa, tres vitoles, caixa clavada, caixa oberta amb la tapa interior en blanc, vinyeta gravada) per compondre-hi l'art vectorial.

Dossier per a inversors: `../ARNALDO Brand Dossier.pdf` (`_build/build_dossier.py`).

Prompts: `../Higgsfield Prompt Pack.md` (vàlids també per a Runway, ChatGPT, Gemini o Ideogram).
