# CARGO CHAOS — Estado del proyecto

Última actualización: 15/10/2026 · Versión 0.1.0 · Fase actual: **fin de Fase 2 (vertical slice) + parte de Fase 3**

## Resumen

Prototipo jugable de principio a fin sin el editor: menú → 5 misiones con 3 mercancías → victoria/derrota → resultados → siguiente misión. 59/59 pruebas automáticas pasan. **Nunca lo ha jugado un humano**: es la siguiente prioridad.

## Criterios de aceptación del primer prototipo

| Criterio | Estado | Evidencia |
|---|---|---|
| Abre correctamente en Godot | ✅ | Importa y compila los 47 scripts sin errores (`tools/check_scripts.gd`) |
| Ejecutable sin el editor | ✅ | `godot --path cargo-chaos`; capturas y vídeo renderizados así |
| Responde al control de un toque | ✅ (sintético) | Pruebas de ratón, teclado y multitáctil con eventos sintéticos. **Sin dedo real ni dispositivo** |
| Jetpack con movimiento coherente | ✅ | Pruebas de subida/bajada, respuesta <50 ms, límites, crucero |
| Balanceo e inercia de la carga | ✅ | Probe de física + pruebas + capturas |
| Tres mercancías diferenciadas | ✅ | Medido: piano sube 1.7× más lento; cristal 73 % de daño vs piano 16 % al mismo golpe; tarta sensible a inclinación |
| Cinco misiones jugables | ✅ | Las 5 completadas por el bot con la física real (también a 30/120 Hz) |
| Colisiones con consecuencias consistentes | ✅ | Pruebas con `move_and_collide` real; causa nombrada en cada daño |
| Integridad funciona | ✅ | Estados, umbrales, sin daño en reposo |
| Victoria y derrota | ✅ | Pruebas + capturas de ambas pantallas |
| Reiniciar sin problemas | ✅ | `tools/flow_smoke.gd`: cambios de escena reales menú → misión → reiniciar → pausa → menú → misión 2 → siguiente (sin pulsación humana) |
| Flujo menú → partida → resultados | ✅ | Prueba de integración + capturas |
| Pruebas pasan | ✅ | 59/59 |
| Limitaciones documentadas | ✅ | Abajo y en `docs/TEST_REPORT.md` |
| Visualmente comprensible | ✅ (criterio propio) | Revisión de capturas; falta opinión de jugadores |

## Informe por fases

### Fase 0 — Preparación ✅
- **Completado:** Godot 4.7.2-stable instalado (checksum SHA-512 verificado), proyecto en `cargo-chaos/` (el repositorio contiene otro proyecto no relacionado que no se ha tocado), estructura modular, runner de pruebas propio, herramientas de captura con Xvfb.
- **Decisiones:** renderer Compatibility; JSON para contenido; runner propio en vez de GUT (cero dependencias).

### Fase 1 — Core gameplay ✅
- **Completado:** repartidor con jetpack, avance automático, cámara, física propia de cuerda y carga, colisiones, integridad.
- **Verificado:** probe de física con métricas por mercancía; pruebas unitarias e integración.
- **Problemas encontrados y resueltos con medición:** carga girando >100° (doble péndulo caótico → eslinga), carga "cometa" a 90° en caída libre (→ arrastre solo horizontal + empuje al ralentí), resonancia de la tarta con toques rápidos (→ amortiguación de cuerda 0.55), temblor/daño fantasma en reposo (→ fricción estática).

### Fase 2 — Vertical slice ✅
- **Completado:** 3 mercancías, 5 misiones, HUD, pausa, resultados con estrellas y monedas, menú con progreso guardado, pistas de tutorial, feedback visual, reinicio rápido.
- **Problemas encontrados y resueltos:** daño por arrastre al aterrizar, integridad final ≠ anunciada, "Next Delivery" en la última misión, aterrizajes letales al soltar el botón (→ modo aterrizaje).

### Fase 3 — Polish y QA 🟡 en curso
- **Hecho:** audio básico sintetizado (14 efectos), partículas, sacudida de cámara, animaciones del personaje (inclinación, estiramiento, poses), pausa automática al perder el foco, multitáctil, vídeo de una partida.
- **Pendiente:** playtests humanos y ajuste de dificultad, música, pantalla de créditos/licencias, profiling en dispositivo, probar relaciones de aspecto 4:3 y 20:9.

### Fase 4 — MVP comercial ⛔ no iniciada (a propósito)
Solo hay preparación arquitectónica: `Analytics` (backend local), `Ads` + `AdPolicy` (sin SDK), monedas guardadas. No avanzar hasta validar la diversión.

## Problemas y limitaciones conocidas

1. **Sin validación humana:** la sensación de control y la dificultad se han ajustado con métricas y un bot.
2. **Sin móvil:** no hay exportación, ni emulador, ni medición de FPS/memoria. No se afirma que alcance 60 FPS en móvil.
3. **Audio no escuchado** (el contenedor no tiene salida de audio).
4. Interpolación física desactivada: posible falta de suavidad en pantallas de 120 Hz.
5. Los niveles con obstáculos móviles se prueban con un solo timing determinista del bot.
6. El arte es procedural provisional (de calidad presentable, sustituible por sprites).
7. Retención D1/D7/D30 imposible de medir sin backend remoto (no existe).

## Decisiones relevantes

- Física propia en vez de joints → determinismo y testabilidad (ver arquitectura).
- "Modo aterrizaje": en la zona de entrega la caída se limita a 300 px/s (perdonar sin regalar).
- La dificultad progresa por exigencia de control, no por velocidad (235–265 px/s en todas las misiones).
- Cada nivel incluye una ruta de referencia: si una edición rompe la completabilidad, las pruebas fallan.
- El código se ha subido a la rama de trabajo designada para esta sesión (`claude/cargo-chaos-game-dev-lw29jo`); no se ha creado PR ni publicado nada.

## Siguiente prioridad (más valor)

1. **Playtest con 5–10 personas** (build de escritorio o Android de pruebas): ¿se entiende que la carga va detrás?, ¿piano divertido o lento?, ¿tarta justa? Registrar con la analítica local (`user://analytics/*.jsonl`).
2. Exportación Android de pruebas + profiling en un móvil de gama media.
3. Ajustes según playtest; luego música y pantalla de créditos.
4. Solo después: hangar/economía (Fase 4).
