# ARNALDO — Paquet de prompts per a Higgsfield

*Preparat el 10/10/2026. Pendent d'executar: el compte de Higgsfield té 0 crèdits (pla gratuït).*

## Pressupost estimat

| Bloc | Model | Imatges | Cost unitari (preflight) | Total |
|---|---|---|---|---|
| A. Renders fotorealistes (8 conceptes × 2 variants) | `gpt_image_2_5` | 16 | 0,25 crèdits | 4 crèdits |
| B. Exploració de logotip / segell vectorial | `recraft_v4_1` (model_type `vector`) | 6 | 1,25 crèdits | 7,5 crèdits |
| **Total** | | **22** | | **≈ 11,5 crèdits** |

Regles comunes:
- Ni «Habana», ni «Cuba», ni «Habano», ni logotips o segells de Habanos.
- Cap escut, medalla ni data.
- Es tracta de material intern de disseny, no de publicitat al consumidor.

## A. Renders fotorealistes (`gpt_image_2_5`, 4:3)

1. **Anella clàssica sobre robust.** Macro product photograph of a single premium hand-rolled robusto cigar lying on dark walnut, with an ornate cigar band: deep oxblood red field, embossed antique-gold borders with fine guilloché engraving, a central die-cut cartouche in black lacquer reading "ARNALDO" in elegant engraved serif capitals, a small handwritten-style signature beneath in gold foil. Raking warm light, shallow depth of field, ultra-detailed paper and foil texture. No other text or logos.
2. **Anella minimalista de signatura.** Studio macro of a Colorado-maduro robusto with an ivory cotton-paper band, the only graphic element a fluid handwritten signature "Arnaldo" hot-stamped in deep red foil with blind embossing, thin gold pinstripes at the edges. Soft north light, neutral linen background, editorial luxury aesthetic.
3. **Caixa oberta amb vista.** Overhead photograph of an open Spanish-cedar cigar box with ten robustos aligned, each with a red-and-gold band; inside the lid a lithographed label in oxblood, cream and gold with an engraved portrait-style vignette of a craftsman's hands rolling a cigar, the word "ARNALDO" in classic engraved capitals and "Pliego de autor" in copperplate script. Gold-and-red edge trim paper. Warm tungsten light.
4. **Caixa tancada (coberta).** Three-quarter product photograph of a closed cedar cigar box with brass hinge, a black lacquered top label framed in gold foil reading "ARNALDO" and "Nº 1", a red paper seal across the front reading "PLIEGO Nº 001". A plain white rectangular area on the lid left blank for a mandatory health warning. Dark studio background.
5. **Mans del torcedor (gravat).** Fine banknote-style intaglio engraving illustration of a cigar roller's hands at a wooden rolling table with a chaveta blade and tobacco leaves, cross-hatched lines, single colour deep red ink on cream paper, suitable for a cigar box inner lid. No faces, no text.
6. **Tres vitoles.** Studio photograph of three premium cigars standing upright in a row (robusto, toro, churchill), each wearing a matching ornate band in black, oxblood and ivory variants with the word "ARNALDO", on a black velvet surface, dramatic rim light.
7. **Colofó signat.** Close-up of a small cream cotton card inside a cigar box, letterpress-printed in classic typography: "PLIEGO Nº 001 — Caja 0001 / 0500 — Torcido a mano por" followed by a real ink signature "Arnaldo", gold foil border. Shallow depth of field, warm light.
8. **Humidor d'estanc.** A premium tobacconist's walk-in humidor shelf with several open cigar boxes, one of them the ARNALDO box with its red-and-gold lithographed lid, natural cedar shelving, soft ambient light, realistic retail scene. Other boxes unbranded and generic.

## B. Logotip i segell (`recraft_v4_1`, `model_type: vector`, 1:1, colors `#8E1B1B`, `#14100D`, `#C9A24A`, `#F4EBD8`)

1. Wordmark "ARNALDO" in custom high-contrast engraved serif capitals, generous letterspacing, classic cigar-band lettering, flat vector.
2. Circular seal: the initial "A" in a refined copperplate script inside a double gold ring with fine guilloché pattern, flat vector.
3. Cigar band cartouche shape: ornate die-cut cartouche frame with symmetrical scrollwork, empty centre, gold on oxblood, flat vector.
4. Monogram "A" formed by a tobacco leaf and a cigar roller's chaveta blade, minimal luxury emblem, flat vector.
5. Laurel-free emblem: oval medallion with crossed tobacco leaves and a small eight-pointed star, engraved line style, flat vector.
6. Signature-style logo placeholder: elegant flowing handwritten "Arnaldo" with an underline flourish, flat vector. *(Només orientatiu: el definitiu ha de ser la signatura real d'Arnaldo.)*

---

# RUTA A v2 — «Grans Habanos» (Hoyo de Monterrey · Montecristo · Cohiba)

*Afegit el 10/10/2026. Per enganxar a ChatGPT (imatges), Gemini, Ideogram, Higgsfield o Runway.*

## Què agafem de cada referència i què NO (marques i aparença comercial protegides)

| Referència | Codi que inspira | Traducció original ARNALDO | Prohibit copiar |
|---|---|---|---|
| **Hoyo de Monterrey** | Medalló oval victorià amb vinyeta gravada, filigrana d'or, vermell/or/crema | Medalló oval amb una vinyeta gravada de **les mans d'Arnaldo a la mesa de torcer** (o una casa de tabac), filigrana d'or | El jardí/font, «José Gener», la composició de la seva anella i la seva vista |
| **Montecristo** | Emblema heràldic fort i simple, paleta molt reduïda, lectura a distància | Emblema de **la chaveta** (el ganivet de mitja lluna del torcedor) sota una fulla de tabac, dins d'un cercle propi. *Actualitzat el 12/10/2026: sense fulles creuades, perquè als renders semblaven falçs.* | El triangle, les espases, la flor de lis, la combinació marró/blanc/vermell en el seu ordre |
| **Cohiba** | Patró geomètric potent al cos de l'anella, minimalisme, versió negra de luxe (Behike) | Banda de **trenat de yagua** (teixit de fulla de palma dels tercios) en or i negre; versió negra per a l'edició limitada | El quadriculat blanc i negre, el cap taíno, el groc Cohiba |

Comuns a totes:
- Ni «Habana», ni «Cuba», ni «Habano».
- Cap escut d'Estat, medalla ni data.
- La signatura real d'Arnaldo dins la cartel·la quan la tinguem.

## Prompts

**A2-1 · Anella principal (lacre i or, medalló)**
Macro product photograph of a premium robusto cigar on dark walnut wearing an ornate classic cigar band in the grand Cuban tradition: deep oxblood-red field, wide antique-gold foil borders with fine engraved guilloché and beaded edges, a tall die-cut oval medallion in the centre framed by Victorian gold filigree scrollwork; inside the medallion a tiny engraved vignette of a cigar roller's hands at a wooden rolling table; across the medallion a white enamel ribbon with the name "ARNALDO" in bold engraved red serif capitals. Embossed relief, raking warm light, ultra-detailed paper and foil texture. No other text, no flags, no coats of arms, no medals.

**A2-2 · Emblema de chavetes**
Flat engraved emblem for a luxury cigar brand: two crossed cigar-roller's chaveta blades (curved crescent knives with wooden handles) over a single tobacco leaf, inside a round seal with a double gold rule and fine guilloché, the word "ARNALDO" in classic engraved serif capitals around the top of the seal. Antique gold and oxblood red on cream paper, intaglio line style. No swords, no fleur-de-lis, no triangle, no other text.

**A2-3 · Edició negra (llegat de luxe)**
Studio product photograph of a premium churchill cigar with a black cigar band: glossy black lacquer field with a repeating woven palm-leaf pattern in fine gold lines along the top and bottom borders, a slim central gold cartouche with "ARNALDO" in elegant engraved serif capitals and "Nº 3" below in small script. Dark velvet background, dramatic rim light, ultra-detailed foil. No other text, no checkerboard pattern, no portraits.

**A2-4 · Vista de la tapa (estil Hoyo)**
Overhead photograph of an open Spanish-cedar cigar box of ten robustos with oxblood-and-gold bands; inside the lid a richly lithographed label in oxblood, cream and antique gold: a large central oval medallion with a fine engraved scene of a tobacco curing barn among tobacco fields at dawn, framed by Victorian gold filigree and corner rosettes, "ARNALDO" above in large engraved serif capitals on a ribbon, "Pliego de autor" in copperplate script below. Gold-and-red edge trim paper on the box rim. Warm tungsten light. No other text, no flags, no coats of arms, no medals.

**A2-5 · Les tres vitoles**
Studio photograph of three premium cigars standing upright (robusto, toro, churchill) with matching bands from the same family: oxblood-and-gold with oval medallion (Nº 1), gold with crossed-chaveta emblem (Nº 2), black lacquer with woven gold border (Nº 3), each reading "ARNALDO". Black background, rim light. No other text.

**Consell:** genera 3–4 variants de cada prompt i tria'n les millors per al dissenyador. Si el text surt deformat, afegeix «the text ARNALDO must be spelled exactly A-R-N-A-L-D-O» al final del prompt.

---

# RUTA A v3 — «Casa cubana clàssica» (12/10/2026, substituïda per la v4)

*El promotor descarta la fulla i la chaveta de la v2. La v3 adopta la gramàtica comuna de les cases de Habanos (anella lacre i or amb cartel·la troquelada, perlat, segona anella de sèrie, caixa de cedre amb la marca a foc) i hi posa el nom i la signatura reals d'Arnaldo. Els límits de la v2 es mantenen.*

**A3-1 · Anella de la casa**
Macro product photograph of a premium robusto cigar on dark walnut wearing an ornate classic Cuban-style cigar band in the grand nineteenth-century tradition: deep red lacquered field, wide antique-gold foil borders embossed with a row of tiny raised gold pearls, fine gold guilloché on the side panels with small gold rosettes, and a tall die-cut central gold cartouche with scalloped edges that rises above and below the band. Inside the cartouche, on a red ground, the name "ARNALDO" in large bold engraved gold serif capitals with a fine black outline, perfectly centred. That is the only text on the band. Embossed relief, raking warm light, ultra-detailed paper and foil texture, black background.

*Negative:* watermark, misspelled text, extra text, gibberish letters, flags, coat of arms, medals, crown, fleur-de-lis, laurel, tobacco leaf, knife, sickle, blurry, low resolution

**A3-2 · Variant amb signatura (cal·ligrafia provisional)**
Macro product photograph of a premium robusto cigar on dark walnut wearing an ornate classic Cuban-style cigar band in the grand nineteenth-century tradition: deep red lacquered field, wide antique-gold foil borders embossed with a row of tiny raised gold pearls, fine gold guilloché on the side panels with small gold rosettes, and a tall die-cut central gold cartouche with scalloped edges that rises above and below the band. Inside the cartouche, on a red ground, the name "Arnaldo" written as an elegant flowing hand signature in raised gold foil, with a single underline flourish. That is the only text on the band. Embossed relief, raking warm light, ultra-detailed paper and foil texture, black background.

*Negative:* watermark, misspelled text, extra text, gibberish letters, flags, coat of arms, medals, crown, fleur-de-lis, laurel, tobacco leaf, knife, sickle, blurry, low resolution

**A3-3 · Doble anella «Pliego de autor»**
Macro product photograph of a premium robusto cigar on dark walnut wearing two bands. The upper band is an ornate classic Cuban-style cigar band in the grand nineteenth-century tradition: deep red lacquered field, wide antique-gold foil borders embossed with a row of tiny raised gold pearls, fine gold guilloché on the side panels with small gold rosettes, and a tall die-cut central gold cartouche with scalloped edges that rises above and below the band, with "ARNALDO" in large bold engraved gold serif capitals inside the cartouche. Just below it, a narrow second band in glossy black with thin gold borders and the words "PLIEGO DE AUTOR" in small gold serif capitals. No other text. Raking warm light, black background.

*Negative:* watermark, misspelled text, extra text, gibberish letters, flags, coat of arms, medals, crown, fleur-de-lis, laurel, tobacco leaf, knife, sickle, blurry, low resolution

**A3-4 · Caixa de cedre amb la marca a foc**
Three-quarter studio photograph of a closed natural Spanish-cedar cigar box with a brass hinge and clasp, the word "ARNALDO" hot-branded (burnt) deeply into the centre of the lid in classic serif capitals, a thin red-and-gold paper edging strip along the lid rim. No paper labels on the lid, no other text. Warm tungsten light, dark background, ultra-detailed wood grain.

*Negative:* watermark, misspelled text, extra text, gibberish letters, flags, coat of arms, medals, crown, fleur-de-lis, laurel, tobacco leaf, knife, sickle, blurry, low resolution, paper label on lid, sticker

**A3-5 · Caixa oberta amb vista**
Overhead photograph of an open Spanish-cedar cigar box of 25 robustos in neat rows, each wearing a red-and-gold band with a gold central cartouche showing a small plain gold oval with no lettering. A decorative printed paper leaf folded back over the cigars at one end, cream with a fine red and gold border. Inside the lid a lithographed label: a large central oval with an engraved scene of a traditional thatched-roof tobacco curing house among tobacco fields with royal palms, framed by gold filigree, "ARNALDO" above on a ribbon in engraved serif capitals. Warm light.

*Negative:* watermark, misspelled text, extra text, gibberish letters, flags, coat of arms, medals, crown, fleur-de-lis, laurel, tobacco leaf, knife, sickle, blurry, low resolution, lettering on the cigar bands

# DISSENY DE LA CASA — l'anella clàssica (13/10/2026, triada pel promotor)

*El promotor tria l'anella clàssica (`renders/arnaldo-render-anilla-clasica.png`) i demana mantenir-la: banda lacre amb cantells d'or perlats, oval central de laca negra amb marc d'or en guilloché, ARNALDO en capitals romanes d'or i la signatura a sota. Res de monograma ni emblema. La Ruta A v4 (anella marfil amb una «A») queda descartada. Art vectorial: `_build/brand_clasica.py`.*

# FOTOS SENSE TEXT per compondre-hi l'anella (13/10/2026)

*Els renders de la v3 no arriben al nivell buscat. Canvi de mètode: l'art amb text (anelles, vista, marca a foc) és vectorial (`_build/brand_clasica.py`) i la IA només fa **fotografies sense text**, sobre les quals es compon l'art. Així no hi pot haver errors de lletra.*

**F-1 · Puro dret amb anella llisa (per compondre-hi l'anella de la casa)** · format 3:4
Studio product photograph of one premium Cuban-style robusto cigar standing perfectly upright and centered, seen straight-on at eye level, rich colorado-maduro wrapper with fine veins and a slight oily sheen, neat triple-cap head at the top. Around the upper third of the cigar sits a wide plain band of smooth unprinted ivory paper with nothing printed on it: no text, no logo, no ornament, completely blank. Warm raking light from the left, deep black background, crisp focus, 100mm macro lens, high-end catalogue photography.

*Negative:* text, letters, words, logo, monogram, print on band, pattern on band, label, stamp, watermark, signature, numbers, flags, coat of arms, medals, crown, fleur-de-lis, tobacco leaf on band, knife, sickle, blurry, low resolution, cartoon, illustration

**F-3 · Caixa de cedre clavada, tapa sense marca (per gravar-hi la marca a foc)** · format 4:3
Product photograph of a traditional nailed Spanish-cedar cigar box in the classic Cuban style (boite nature), closed, seen from the front at a 35-degree elevated angle, pale natural cedar with straight grain, small brass nails along the edges, a thin plain ivory paper strip sealing the front edge, completely plain unmarked lid with nothing printed or burned on it. Warm low-key light, black background, realistic, sharp, high-end catalogue photography.

*Negative:* text, letters, words, logo, monogram, print on band, pattern on band, label, stamp, watermark, signature, numbers, flags, coat of arms, medals, crown, fleur-de-lis, tobacco leaf on band, knife, sickle, blurry, low resolution, cartoon, illustration, clasp, latch, hinge, varnish, lacquer

**F-5 · Vinyeta gravada sense text (per a l'oval de la vista)** · format 4:3
Antique nineteenth-century steel engraving, a single oval vignette of fine cross-hatched line work printed in one sepia-brown ink on cream paper: a Cuban tobacco plantation at dawn, neat rows of tobacco plants in the foreground, a palm-thatched tobacco curing house in the middle distance, tall royal palms and soft hills behind, rays of the rising sun in the sky. Classic banknote and cigar-box lithography engraving style, highly detailed, no frame, plain cream margins.

*Negative:* text, letters, words, numbers, signature, watermark, frame, border, color, flags, people, fountain, garden, barn, blurry, low resolution

**F-2 · Tres vitoles amb anelles llises (gamma)** · format 4:3
Studio product photograph of three premium Cuban-style cigars standing perfectly upright side by side on a dark walnut surface, seen straight-on at eye level: a short robusto on the left, a longer toro in the middle and a long slender churchill on the right, all with colorado wrappers and neat triple caps. Each wears a wide plain band of smooth unprinted ivory paper in its upper third, completely blank with nothing printed. Warm raking light, black background, crisp focus, high-end catalogue photography.

*Negative:* text, letters, words, logo, monogram, print on band, pattern on band, label, stamp, watermark, signature, numbers, flags, coat of arms, medals, crown, fleur-de-lis, tobacco leaf on band, knife, sickle, blurry, low resolution, cartoon, illustration

**F-4 · Caixa oberta amb la tapa interior en blanc (per a la vista)** · format 4:3
Overhead photograph at a 60-degree angle of an open traditional Spanish-cedar cigar box holding ten robusto cigars in one neat row, each cigar wearing a plain unprinted ivory paper band with nothing printed on it. The inside of the raised lid is covered with a completely blank smooth ivory paper sheet edged by a thin gold border, nothing printed on it. Thin gold-and-ivory edge paper along the box rim. Warm tungsten light, dark background, realistic, sharp, high-end catalogue photography.

*Negative:* text, letters, words, logo, monogram, print on band, pattern on band, label, stamp, watermark, signature, numbers, flags, coat of arms, medals, crown, fleur-de-lis, tobacco leaf on band, knife, sickle, blurry, low resolution, cartoon, illustration
