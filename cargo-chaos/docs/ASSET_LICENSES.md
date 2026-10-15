# Licencias de assets — Cargo Chaos

Estado a 15/10/2026. Todo asset nuevo debe añadirse aquí **antes** de hacer commit.

## Resumen

| Asset | Ubicación | Origen | Licencia |
|---|---|---|---|
| Personaje "Zippy", mercancías, edificios, drones, grúas, plataforma, fondos, partículas | `scripts/art/*.gd` | Dibujo vectorial procedural original, creado para este proyecto (código GDScript que dibuja con primitivas de Godot) | Propiedad del proyecto |
| Icono de la app | `icon.svg` | SVG original creado para este proyecto | Propiedad del proyecto |
| Efectos de sonido (14 `.wav`) | `assets/audio/` | Síntesis procedural original con `tools/gen_audio.py` (solo stdlib de Python, sin muestras de terceros). Regenerables y deterministas | Propiedad del proyecto |
| Tipografía **Lilita One** | `assets/fonts/LilitaOne-Regular.ttf` | Google Fonts (repo `google/fonts`, `ofl/lilitaone`). Autor: Juan Montoreano | **SIL Open Font License 1.1** — texto completo en `assets/fonts/LilitaOne-OFL.txt` |
| Motor Godot Engine 4.7.2 | (no se incluye en el repo) | godotengine.org | MIT (aviso obligatorio en los créditos de la versión publicada) |

## Notas

- **Ningún asset descargado sin licencia.** No hay imágenes, sonidos ni música de terceros.
- **Lilita One (OFL 1.1):** se puede incrustar en la app y distribuir comercialmente. No se puede vender la fuente por separado. El nombre reservado "Lilita" no puede usarse si se modifica la fuente. Hay que conservar el fichero de licencia junto a la fuente.
- **Godot (MIT):** la versión publicada debe incluir el aviso de copyright de Godot y de sus librerías de terceros (Godot genera la lista con `Engine.get_license_text()` / `Engine.get_copyright_info()`); pendiente añadir una pantalla de créditos antes de publicar.
- Las referencias de diseño (Jetpack Joyride, Hill Climb Racing, Totally Reliable Delivery Service) son solo de inspiración de mecánicas: no se ha copiado código, arte, personajes, sonidos ni textos.
- Los textos de los carteles ("SKY PIZZA", "BIG SALE", "COFFEE!"…) son genéricos e inventados; no imitan marcas reales.
