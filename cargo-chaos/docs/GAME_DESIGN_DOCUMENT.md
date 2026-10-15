# CARGO CHAOS — Game Design Document

*Deliver it. Don't destroy it.* · Versión 0.1.0 (vertical slice) · 15/10/2026

> Este documento describe lo que **existe y funciona** en el repositorio, y marca claramente lo que es diseño futuro.

## 1. Visión

Arcade físico casual para móvil (horizontal). El jugador es **Zippy**, un repartidor con jetpack que lleva una mercancía colgada de una cuerda. La dificultad no es solo esquivar: es **gestionar cómo se mueve la carga**, que cuelga por debajo y por detrás, oscila, pesa y se rompe.

Principio rector: *divertido en cinco segundos, interesante después de cien partidas.*

- **5 segundos:** un solo control (mantener = subir, soltar = bajar). La carga se balancea de forma visible y cómica desde el primer toque.
- **100 partidas:** cada mercancía cambia la física (inercia, arrastre, fragilidad, inclinación), y las misiones exigen anticipación, suavidad y precisión.

## 2. Control (implementado)

| Entrada | Acción |
|---|---|
| Mantener pulsado (táctil / clic izquierdo / Espacio / ↑ / W) | Jetpack encendido: sube y acelera ligeramente (+8 % velocidad) |
| Soltar | El jetpack queda al ralentí: desciende con gravedad |
| Esc / P / botón II | Pausa |
| R | Reiniciar misión |

- El primer toque **inicia** la misión ("HOLD TO FLY"): el jugador nunca empieza sin estar preparado.
- Respuesta inmediata: empuje completo en 40 ms, corte en 60 ms.
- Avance lateral automático a la velocidad de crucero de cada nivel (235–265 px/s).
- Al perder el foco (llamada, cambio de app) el juego se pausa solo.

## 3. Física del vuelo y de la carga (implementado)

Sistema propio de dos cuerpos (repartidor + carga) unidos por una **cuerda** (muelle que solo tira, con amortiguación) e integrado con sub-pasos fijos de 1/120 s:

- **Gravedad 1500 px/s²**, empuje 3300 px/s², ralentí 500 px/s², velocidades máximas de subida 480 y caída 720 px/s.
- **La cuerda se ajusta por mercancía** (frecuencia y amortiguación propias), así es igual de estable con una caja de cristal que con un piano.
- **Eslinga (bridle):** la carga se alinea con la cuerda como si colgara de 4 correas. Sin ella, el sistema era un doble péndulo caótico e injusto (medido: giros de >100°).
- **Arrastre horizontal:** las cargas ligeras quedan por detrás (cristal ≈10°, piano ≈2°). **La carga no sigue la misma trayectoria que el jugador**: esa es la habilidad central.
- **Contactos de cuerpo rígido:** impulso en el punto de contacto con restitución y fricción → la carga gira, rebota y vuelca de forma creíble.
- **Choques frontales del repartidor:** rebote + aturdimiento breve ("BONK!") sin quedarse atascado.
- **Modo aterrizaje:** sobre la zona de entrega la caída se limita a 300 px/s. Aterrizar sin cuidado sigue dañando, pero soltar el botón no es una muerte instantánea.

## 4. Mercancías (implementadas, `data/cargo_types.json`)

| | Glass Box | Heavy Piano | Birthday Cake |
|---|---|---|---|
| Masa (repartidor = 2.0) | 0.35 | 1.3 | 0.7 |
| Subir 200 px | 0.65 s | 1.11 s | ≈0.73 s |
| Ángulo de arrastre | ≈10° | ≈2° | ≈4° |
| Fragilidad | 1.6 (máxima) | 0.45 | 0.9 |
| Umbral de impacto | 95 px/s | 150 px/s | 110 px/s |
| Daño a 350 px/s | 73 % | 16 % | 39 % |
| Especial | Se rompe con 1–2 golpes fuertes; queda detrás | Inercia: te arrastra; oscila amplio y largo | **Inclinación:** >24° la daña de forma continua; con toques nerviosos rebota |

Lo que el jugador percibe: el cristal es ligero y "vuela" detrás; el piano tarda en subir, cae pesado y tira del repartidor; la tarta exige suavidad (vuelo tranquilo ≈8° de inclinación, toques rápidos ≈26°).

## 5. Integridad y daño (implementado)

- Integridad 0–100 con estados **Intacta (≥70) → Dañada (≥35) → Crítica (>0) → Destruida**.
- **Impacto:** `(velocidad normal − umbral) × 0.18 × fragilidad × superficie × fragilidad del nivel`. Por debajo del umbral nunca hay daño (sin daños injustos por vibraciones); enfriamiento de 0.15 s entre impactos.
- **Superficies:** toldo 0.3 (blando, rebota), plataforma 0.6, edificio 1.0, cartel/torre 1.1, viga/grúa 1.3, dron 1.2.
- **Arrastre (scrape):** arrastrar la carga por una superficie a >90 px/s daña poco a poco (nunca en la plataforma de entrega).
- **Inclinación (tarta):** más allá de 24°, daño proporcional al exceso.
- La carga en reposo no recibe daño (fricción estática; verificado por test).

**Feedback de daño:** destello blanco de la carga, partículas del color de la carga, texto flotante "-24%", sacudida de cámara proporcional, barra de integridad que tiembla y cambia de color, grietas/teclas rotas/pisos de tarta desplazados según el daño, sonido por tipo de carga, avisos "TILT!" / "SCRAPE!" / "KEEP IT LEVEL!". Al destruirse: estallido de restos, la cuerda se corta, el repartidor pone cara triste.

## 6. Misiones (implementadas, `data/levels/*.json`)

| # | Nombre | Carga | Enseña | Velocidad | Límite | Bot* |
|---|---|---|---|---|---|---|
| 1 | First Delivery | Glass Box (fragilidad ×0.5) | Volar, soltar, la carga cuelga debajo, toldos blandos, aterrizar suave. Pistas en pantalla | 250 | — | 98 %, 13.4 s |
| 2 | Fragile Business | Glass Box | Precisión: pasillos entre carteles y edificios; la caja va detrás y roza esquinas | 255 | — | 97 %, 18.6 s |
| 3 | Heavy Duty | Heavy Piano | Inercia: empezar a subir pronto; grúa con ritmo; pasarela por encima | 235 | — | 96 %, 19.2 s |
| 4 | Cake Emergency | Birthday Cake | Suavidad: túneles bajos, mantener la tarta nivelada, contra reloj | 250 | 30 s | 97 %, 18.3 s |
| 5 | Downtown Chaos | Glass Box | Todo junto (noche): drones, grúa, túnel, viga, escalera de edificios, reloj | 265 | 34 s | 100 %, 22.3 s |

\* Resultado del autopiloto de pruebas siguiendo la ruta de referencia del nivel (prueba de que es completable, **no** una medida de dificultad humana).

La dificultad crece por **exigencia de control** (ventanas más estrechas, anticipación, suavidad, timing), no por velocidad: la velocidad de crucero varía solo entre 235 y 265 px/s.

**Victoria:** la carga reposa sobre la plataforma (contacto + velocidad <70 px/s durante 0.35 s, y la tarta nivelada). Al acercarse, el repartidor frena con desaceleración constante y se detiene sobre la plataforma.
**Derrota:** integridad 0 (con motivo explícito: "The Glass Box smashed into a billboard.", "The Birthday Cake tipped over. Keep it level!", "…was dragged along…") o tiempo agotado.

**Resultados:** 1–3 estrellas (≥90 % = 3, ≥60 % = 2), tiempo, monedas (recompensa × integridad, mínimo 20 %), botones Menu / Restart(Retry) / Next Delivery.

## 7. Flujo de pantallas (implementado)

Menú (logo, mascota animada, PLAY → primera misión sin completar, 5 tarjetas con candado y estrellas, monedas, sonido on/off) → Misión ("HOLD TO FLY") → Pausa (Resume/Restart/Menu) → Resultados (Menu/Retry/Next) → … Transiciones con fundido. Progreso guardado localmente: misiones desbloqueadas, mejores estrellas, mejor tiempo, monedas.

## 8. Dirección artística (implementado, provisional-profesional)

Cartoon 2D vectorial con contorno oscuro grueso, colores saturados, siluetas claras. Todo se dibuja por código (`scripts/art/`), separado del gameplay, y es sustituible por sprites sin tocar la física.
- **Zippy:** mono teal, gorra naranja con gafas, jetpack rojo, bufanda amarilla que ondea; se inclina al acelerar/caer, se estira al encender el jetpack (anticipación), llama y partículas proporcionales al empuje, estrellas al aturdirse, poses de victoria y derrota.
- **Ciudad:** cielo degradado, sol/luna, nubes y dos capas de skyline en parallax; temas día, atardecer y noche.
- Regla de legibilidad: **lo que se ve es lo que choca**. Los carteles cuelgan de estructuras sólidas hasta el techo, el cable de la grúa también es sólido, no hay decoración en el espacio jugable.

## 9. Audio (implementado, básico)

14 efectos sintetizados (`tools/gen_audio.py`): clic, golpes por tipo de carga, cristal roto, piano destrozado, tarta aplastada, bonk, aterrizaje, inicio, victoria, derrota y bucle del jetpack (volumen/tono según empuje). Sin música todavía. **No se han escuchado en este entorno** (sin salida de audio): requiere validación humana.

## 10. Diseño futuro (NO implementado)

- **Hangar:** elegir personaje/jetpack, ver mercancías, mejoras, estadísticas. La arquitectura ya separa `FlightParams` y `CargoType` (datos), de modo que mejoras = modificadores sobre esos datos.
- **Economía:** las monedas ya se ganan y guardan; no hay tienda. Regla: las mejoras deben dar comodidad (p. ej. +5 % empuje) sin anular la habilidad.
- **Misiones secundarias, coleccionables, skins.**
- **Segmentos reutilizables y retos generados de forma controlada**, validados con el mismo autopiloto.
- **Monetización:** ver arquitectura técnica (AdPolicy). Recompensados opcionales (reintentar desde el último punto, duplicar monedas) e intersticiales solo entre entregas, con periodo de gracia. Nada pay-to-win, nada que obligue a ver anuncios.

## 11. Preguntas abiertas para validar con jugadores

1. ¿El arrastre de la caja de cristal (la carga va detrás) se entiende sin explicarlo, o hace falta una pista visual (sombra/línea de trayectoria)?
2. ¿El piano resulta "pesado divertido" o "lento frustrante"?
3. ¿La penalización de inclinación de la tarta se percibe como justa?
4. ¿El modo aterrizaje (caída limitada) quita tensión al final o la hace justa?
5. ¿Las sesiones de 13–23 s por misión son la duración correcta para móvil?
