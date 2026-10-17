# Renders de exploración ARNALDO VALLÉS

*Rebranding 17/10/2026: la marca passa d'ARNALDO a ARNALDO VALLÉS. Les files antigues descriuen el text que tenia cada render en el seu moment.*

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


## Disseny de la casa · l'anella clàssica (13/10/2026)

El promotor tria l'anella clàssica com a disseny de la casa i demana mantenir-la. La Ruta A v4 (anella marfil amb monograma «A», `../assets/_v4_descartada/`) queda descartada.

| Fitxer | Origen | Estat | Notes |
|---|---|---|---|
| **arnaldo-av-1-anilla-nombre-completo-ret.png** (= av-1-s2) | Qwen-Image (17/10) | ✅ Al dossier (portada) | Anella amb el nom complet generat de bon principi: «ARNALDO VALLÉS» correcte. La signatura deia «Arnado Vallés»: esborrada i reescrita «Arnaldo Vallés» (`_build/renders/fix_av_firma.py`). La resta de variants (av-1-s1/s3/s4, av-2) tenen el mateix error o pitjor composició |
| **arnaldo-anilla-casa-referencia.png** | Foto del promotor (16/10) retocada (17/10) | Fora del dossier (17/10) | Referència de disseny. Rebranding: «ARNALDO» i «Arnaldo» esborrats de la laca i substituïts per «ARNALDO VALLÉS» i la signatura «Arnaldo Vallés» amb la mateixa inclinació i llum (`_build/renders/fix_referencia_nombre.py`) |
| arnaldo-anilla-casa-referencia-original.png | Foto aportada pel promotor (16/10) | Original | Text «ARNALDO» / «Arnaldo», correcte, anterior al rebranding |
| arnaldo-render-anilla-clasica.png | Runway · Nano Banana Pro (10/10) | Original | Disseny triat. La signatura diu «Arnald Jonato» (inventada per la IA) |
| arnaldo-render-anilla-clasica-ret.png | Retoc | Substituït per la foto de referència (16/10) | Signatura inventada esborrada sobre la laca i substituïda per «Arnaldo» en cal·ligrafia provisional d'aspecte manuscrit, Herr Von Muellerhoff (`_build/renders/fix_clasica_firma.py`); la resta, intacta |
| ../assets/clasica/arnaldo-anilla-n1/-n2/-n3-negra | Vectorial | ✅ Al dossier | L'anella redibuixada: banda lacre (Nº 1), marfil (Nº 2) i negra (Nº 3) |
| ../assets/clasica/arnaldo-anilla-especificacion, -pliego, -logotipo-oro/-lacre, -medallon, -vista, -marca-fuego | Vectorial | ✅ Al dossier | Full d'especificació a escala real (72 × 16 mm, oval 23 × 20 mm), segona anella, logotip (nom + signatura), oval, vista i marca a foc (`_build/brand_clasica.py`) |

Les imatges de la v3 (A3-1, A3-4-ret, A3-5-ret) i de la v2 ja no surten al dossier; es conserven com a exploració.

### Fotos sense text i maquetes (14/10/2026)

Generades amb Qwen-Image (`_build/renders/queue_2026-10-14-v4.json`; el prefix «v4» del nom és només el de la cua) i compostes amb l'art de la casa (`_build/renders/compose_fotos.py`): l'anella s'enrotlla sobre el cilindre amb la llum de la foto, i la marca i la vista es projecten en perspectiva.

| Fitxer | Base | Estat | Notes |
|---|---|---|---|
| **arnaldo-puro-anilla.png** | v4-p1 (robust dret, anella llisa) | ✅ Al dossier (La idea) | Anella Nº 1 + «Pliego de autor» enrotllades al puro |
| **arnaldo-tres-vitolas.png** | v4-p2 (tres vitoles) | ✅ Al dossier (gamma) | Nº 1 lacre, Nº 2 marfil, Nº 3 negra; retallat per sota per treure els peus (la IA hi havia dibuixat cendra) |
| **arnaldo-caja-marca-fuego.png** | v4-p3 (caixa clavada de cedre) | ✅ Al dossier (caixa) | Substitueix la caixeta amb tancador: ARNALDO i la signatura gravats a foc a la tapa |
| **arnaldo-caja-abierta.png** | v4-p4 (caixa oberta, tapa en blanc) | ✅ Al dossier (vista) | Vista vectorial en perspectiva; enquadrat a la tapa perquè les anelles llises de la safata no surtin |
| arnaldo-v4-p5-vineta-grabada.png | v4-p5 | Reserva | Gravat de vega sense text, correcte; no s'usa perquè la vista porta l'oval de la casa |

Revisió: cap de les fotos base té text; tot el text de les maquetes és vectorial.

Dossier per a inversors: `../ARNALDO VALLÉS Brand Dossier.pdf` (`_build/build_dossier.py`).

Prompts: `../Higgsfield Prompt Pack.md` (vàlids també per a Runway, ChatGPT, Gemini o Ideogram).
