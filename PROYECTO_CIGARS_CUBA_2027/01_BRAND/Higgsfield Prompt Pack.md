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
| **Montecristo** | Emblema heràldic fort i simple, paleta molt reduïda, lectura a distància | Emblema de **dues chavetes creuades** (el ganivet del torcedor) sobre una fulla de tabac, dins d'un escut o cercle propi | El triangle, les espases, la flor de lis, la combinació marró/blanc/vermell en el seu ordre |
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
