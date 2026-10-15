# Licencias de assets — Rune Shift

Estado a 15/10/2026. Todo asset nuevo se registra aquí antes del commit.

| Asset | Ubicación | Origen | Licencia |
|---|---|---|---|
| Pixel art: Forjador, Rastrero, Arquero, Embestidor, Guardián, columna, portal, 9 iconos de runa, 8 iconos de mejora, fragmento | `art/sprites_src.py` → `scripts/view/sprite_data.gd` | Dibujado como mapas de caracteres para este proyecto | Propiedad del proyecto |
| Jefe "El Guardián de los Sellos" (32×32) y suelo de la cripta | `scripts/view/pixel_art.gd` | Generado por código, original | Propiedad del proyecto |
| Efectos de sonido (16 `.wav`) y música (3 bucles `.ogg`) | `assets/audio/` | Síntesis procedural con `tools/gen_audio.py` (solo stdlib de Python); música convertida a Ogg Vorbis con ffmpeg | Propiedad del proyecto |
| Icono de la app | `icon.svg` | SVG original | Propiedad del proyecto |
| Tipografía **Pixelify Sans** | `assets/fonts/PixelifySans.ttf` | Google Fonts (`google/fonts`, `ofl/pixelifysans`), © 2021 The Pixelify Sans Project Authors | **SIL Open Font License 1.1** (`assets/fonts/PixelifySans-OFL.txt`) |
| Motor Godot 4.7.2 | no incluido en el repo | godotengine.org | MIT: los créditos de la versión publicada deben incluir su aviso |

- No hay imágenes, sonidos ni música de terceros.
- La versión web carga Pixelify Sans desde Google Fonts solo para la pantalla de carga HTML; el juego usa la copia incluida.
- Los nombres, textos y criaturas son originales; no se ha copiado nada de juegos de referencia.
- "Rune Shift" es un nombre provisional: falta comprobar marcas y disponibilidad antes de publicar (GDD).
