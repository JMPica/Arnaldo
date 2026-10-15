# RUNE SHIFT — Estado del proyecto

15/10/2026 · v0.1.0 · **Prototipo técnico jugable** (GDD §19: "el primer prototipo técnico podrá incluir menos contenido…"). En la práctica cubre todo el contenido del vertical slice salvo lo indicado abajo.

## Contenido del MVP (GDD §19)

| Componente | GDD | Estado |
|---|---|---|
| Héroes | 1 | ✅ El Forjador |
| Biomas | 1 | ✅ La Cripta de los Sellos |
| Habitaciones por partida | 8 + jefe | ✅ |
| Plantillas de habitación | 6 | ✅ (+1 arena del jefe) |
| Arquetipos de enemigos | 4 | ✅ Rastrero, Arquero, Embestidor, Guardián |
| Variantes de élite | 2 | ✅ Veloz, Coloso |
| Jefes | 1 | ✅ El Guardián de los Sellos (2 patrones, fase 2 al 50%) |
| Runas | 3 + 3 + 3 | ✅ 27 combinaciones, todas probadas |
| Interfaz de forja | 1 | ✅ Cartas: runa nueva, cambio, mejora, mejora del Forjador, curación, desafío |
| Sistema de guardado | 1 | ✅ Local, atómico, resistente a corrupción |

## Verificado

- **46/46 pruebas automáticas** (ver `docs/TEST_REPORT.md`): las 27 combinaciones hacen daño y cada runa deja su efecto (y solo el suyo), límites anti-cadena, avisos de todos los ataques, escudo del guardián, jefe, recompensas guiadas, desafío, victoria/derrota, determinismo por semilla, guardado, analítica, anuncios, texto y pixel art, flujo real de la app (menú → sala → forja → pausa → resultados).
- **Bot de equilibrado:** 108 partidas completas (27 combinaciones × 4 semillas). Todas terminan (sin salas en tablas); el bot gana el 73%; mediana de sala 29 s (objetivo GDD 30–60 s); por familia, formas 21–30/36, elementos 24–31/36, catalizadores 24–31/36.
- **Capturas reales** del juego y **web en iPhone 13 emulado (vertical)** con toques reales.

## No verificado / pendiente

1. **Diversión con humanos.** Es la condición nº 1 del GDD §22. Nadie ha jugado aún.
2. **iPhone y Safari reales** (solo emulación de Chromium), **rendimiento en móvil** y **audio** (no escuchado).
3. **Duración de partida:** al bot le duran ~4 min de combate (211–289 s); el GDD pide 8–12 min. A una persona le durará más (forja, menos precisión), pero probablemente haga falta alargar las salas tras el playtest. Se ajusta en `rooms.json` (`scaling`) sin tocar código.
4. No implementado todavía: gastar fragmentos (desbloqueos), pantalla de compendio (solo el contador), estadísticas detalladas para jugadores avanzados, repetir la tirada de cartas con anuncio recompensado (no hay SDK), animaciones dedicadas de ataque y muerte (hay destellos, partículas y 2 fotogramas de paso).

## Decisiones que se apartan o concretan el GDD

| Tema | Decisión | Por qué |
|---|---|---|
| Guardián | Tras 6 bloqueos se rompe la guardia 1,8 s | Sin esto, con Orbe/Cono la sala podía ser imposible si no se flanquea (lo encontró el bot) |
| Salas largas | A los 75 s los enemigos dejan de huir ("furia") | Evita tablas con enemigos a distancia contra formas de corto alcance |
| Tormenta | La carga se acumula en el hechizo, no por enemigo | Con Cono casi nunca descargaba; ahora la regla funciona igual con las tres formas |
| Hielo | Además de ralentizar, los helados reciben +25% de daño | Hielo no aportaba daño y quedaba por detrás |
| Línea de visión | El Cono no atraviesa muros; el autoapuntado prefiere objetivos visibles | Coherencia: lo que se ve es lo que golpea |
| Idioma | Interfaz en español | Coherente con el GDD; los textos están en datos para traducir |

## Siguiente prioridad

1. **Prueba observada con 15–25 jugadores** (GDD §21), con la web o un APK. La analítica local ya registra los eventos necesarios.
2. Ajustar la duración de partida y el equilibrio con datos humanos.
3. Si la forja convence: desbloqueos con fragmentos, compendio y más variedad de salas.
