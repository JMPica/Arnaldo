# Cargo Chaos — Arquitectura técnica

Estado real a 15/10/2026 · Godot **4.7.2-stable** · GDScript · sin dependencias externas.

## 1. Configuración del proyecto

| Ajuste | Valor | Motivo |
|---|---|---|
| Renderer | GL Compatibility (también en móvil) | Máxima compatibilidad en Android/iOS de gama media; funciona con Mesa/llvmpipe para capturas en CI |
| Resolución de referencia | 1280×720, `canvas_items`, aspecto `expand` | Pantallas más anchas ven más por delante; las más altas, más cielo/calle. El área jugable (y 0–650) siempre visible |
| Orientación | sensor landscape | Horizontal en ambos sentidos |
| Física | 60 ticks/s + sub-pasos propios ≤1/120 s | Determinista e independiente del tick rate (probado a 30/50/60/120 Hz) |
| Interpolación física | **desactivada** | La cuerda se dibuja desde el estado físico; con interpolación había desfase visual entre cuerda y cuerpos. A revisar en pantallas de 120 Hz |
| Táctil | `emulate_mouse_from_touch = true` | Un único camino de entrada para ratón y dedo |
| Tipografía | Lilita One (OFL) | Estilo arcade legible |

## 2. Estructura

```
cargo-chaos/
├── project.godot
├── data/                    # TODO el contenido y el tuning (JSON, editable sin código)
│   ├── tuning.json          # vuelo del repartidor + constantes del mundo
│   ├── cargo_types.json     # física y daño de cada mercancía
│   ├── obstacle_types.json  # dureza, rebote y nombre de cada tipo de obstáculo
│   └── levels/              # index.json + una misión por fichero
├── scenes/main/             # main_menu.tscn, game.tscn (raíces mínimas; el resto se construye en código)
├── scripts/
│   ├── physics/             # PURO (sin nodos): FlightParams, CargoType, RigModel, DamageModel, CargoIntegrity
│   ├── gameplay/            # nodos: CourierRig, Obstacle, LevelWorld, Mission, Autopilot, GameCamera, GameScene
│   ├── core/                # autoloads Game y Progress; GameData/LevelData (carga y validación)
│   ├── systems/             # autoloads Analytics, Ads (+AdPolicy), Sfx
│   ├── art/                 # dibujo procedural: personaje, cargas, obstáculos, ciudad, efectos, paleta
│   └── ui/                  # UiKit (tema), HUD, menús superpuestos, menú principal
├── assets/fonts, assets/audio
├── tests/                   # runner propio + unit/ + integration/
├── tools/                   # run_tests.sh, capture.sh, overview.sh, probe_physics.gd, gen_audio.py, check_scripts.gd
└── docs/
```

Separación clave: **física (pura) ← gameplay (nodos) ← arte/UI (solo leen estado)**. El arte nunca modifica la física; la física no conoce el arte.

## 3. Núcleo físico

### RigModel (`scripts/physics/rig_model.gd`)
Estado: posición/velocidad del repartidor, posición/velocidad/ángulo/velocidad angular de la carga, nivel de empuje. Fuerzas por paso:

1. **Cuerda:** muelle unilateral `k·estiramiento + c·velocidad_de_cierre`, con `k = μω²`, `c = 2ζμω` (μ = masa reducida; ω y ζ por mercancía). Solo tira.
2. **Amortiguación de balanceo:** fuerza sobre la velocidad relativa perpendicular a la cuerda, igual y opuesta en ambos cuerpos (conserva el momento).
3. **Repartidor:** gravedad − empuje (interpolado entre ralentí y máximo) − amortiguación vertical − cuerda + motor horizontal (controlador P hacia la velocidad objetivo, limitado).
4. **Carga:** gravedad + cuerda + arrastre horizontal; vertical comparte amortiguación y velocidad máxima con el repartidor (si no, "planea" en caída libre).
5. **Rotación:** par de la cuerda en el punto de enganche + par de eslinga (bridle) hacia la dirección de la cuerda − amortiguación angular.
6. **Contactos:** `apply_cargo_contact()` = impulso de cuerpo rígido en el punto de contacto con restitución (0 si <80 px/s, evita temblores) y fricción de Coulomb. Devuelve la velocidad de impacto que usa el modelo de daño.
7. **Límite de cuerda:** corrección posicional a 130 % de la longitud, repartida por masas inversas.

Integración: Euler semi-implícito. **Decisiones derivadas de medición** (`tools/probe_physics.gd`): eslinga, arrastre solo horizontal, empuje al ralentí y amortiguación de balanceo; cada una corrigió un comportamiento injusto medido (giros >100°, carga "cometa" a 90°).

### CourierRig (`scripts/gameplay/courier_rig.gd`)
Convierte el modelo en dos `CharacterBody2D` (capas: mundo 1, repartidor 2, carga 4; repartidor y carga no chocan entre sí). En cada tick: `pasos = ceil(dt / 1/120)`, y por sub-paso: empuje → velocidades → `move_and_collide` del repartidor → giro + `move_and_collide` de la carga (con `recovery_as_collision`) → límite de cuerda. Las colisiones vuelven al modelo y generan daño (`DamageModel`) y señales (`cargo_impact`, `courier_bonk`, `courier_landed`). Incluye fricción estática en reposo, enfriamiento de impactos e invulnerabilidad tras terminar la misión.

### Por qué no joints de Godot
No se prototiparon joints (decisión de diseño, no medida): `PinJoint2D/DampedSpringJoint2D` + `RigidBody2D` dan menos control sobre estabilidad con masas muy distintas (0.35 vs 2.0), el daño por impulso de contacto de GodotPhysics2D es poco fiable, y no es testeable sin escena. El modelo propio es determinista, testeable en milisegundos y estable a cualquier tick rate.

## 4. Datos y niveles

`GameData.load_all()` carga y **valida** todo; los errores se listan con fichero y motivo (campos obligatorios, tipos de obstáculo desconocidos, plataforma mal situada, ruta de referencia ausente…). `LevelData` normaliza obstáculos:

- `"height"` → crece desde el suelo; `"bottom"` → cuelga del techo; `"rect"` → libre.
- `"move": [dx, dy]`, `"period"`, `"phase"` → obstáculo móvil sinusoidal, guiado por el reloj de la misión (determinista).
- `"autopilot_path"` → ruta de referencia obligatoria: **prueba ejecutable de que el nivel es completable**.

Añadir una misión = crear un JSON y listarlo en `data/levels/index.json`. Sin tocar código.

## 5. Reglas de misión

`Mission` (RefCounted, sin nodos): READY → RUNNING → BRAKING → SUCCESS/FAILED. Calcula la velocidad objetivo (crucero, y frenada `v = √(2·a·d)` hacia la plataforma), el temporizador, la condición de entrega (contacto con la plataforma + velocidad baja + tarta nivelada durante 0.35 s) y el motivo de derrota legible.

`GameScene` orquesta cada tick en orden fijo: **obstáculos móviles → rig → reglas**, y traduce eventos en feedback (partículas, texto, cámara, sonido, HUD) y en analítica/progreso.

## 6. Autoloads (servicios)

| Autoload | Responsabilidad |
|---|---|
| `Progress` | Guardado local `user://save.json`: escritura atómica (tmp + rename), validación, copia `.corrupt` si está dañado, fusión con valores por defecto (migración) |
| `Analytics` | Fachada `track(evento, props)` con backends enchufables. Hoy: log JSONL local en `user://analytics/` (máx. 10 ficheros × 512 KB). Sin datos personales; id de sesión aleatorio por arranque |
| `Ads` | Fachada + `AdPolicy` (reglas) + `NullAdProvider`. **Ningún SDK incluido** |
| `Sfx` | Pool de 8 reproductores + bucle del jetpack; si falta un sonido se ignora |
| `Game` | Carga de datos, misión actual, transiciones con fundido, registro de acciones de entrada |

### Eventos de analítica implementados
`game_started`, `tutorial_started`, `tutorial_completed`, `delivery_started`, `delivery_completed` (tiempo, integridad, golpes, estrellas), `delivery_failed` (motivo, causa, posición x), `cargo_damaged` (cantidad, fuente, velocidad, x), `retry_selected` (reintentos seguidos), `session_ended` (duración). Con `session` y `ts` permiten calcular duración de sesión, tasa de fracaso, reintentos y puntos de dificultad. **Retención D1/D7/D30 requiere un backend remoto** y un identificador de instalación (con consentimiento): no existe todavía y no se inventan datos.

### Monetización futura (preparada, no implementada)
`AdPolicy`: intersticiales solo en contexto `results`, nunca durante el juego, periodo de gracia de 180 s, intervalo mínimo de 150 s, al menos 3 entregas entre anuncios. Para integrar AdMob: implementar `AdProvider` (3 métodos) con el plugin oficial de Godot y asignarlo a `Ads.provider`. Requiere aprobación del propietario.

## 7. Pruebas y herramientas

- `tools/run_tests.sh` — compila todos los scripts y ejecuta el runner headless (`tests/test_runner.tscn`, `--fixed-fps 60`). Resultados en `tests/output/results.json`.
- `tools/overview.sh N` — renderiza un nivel completo con la trayectoria real del bot (diseño de niveles).
- `tools/capture.sh` — capturas reales bajo Xvfb (`--level`, `--times`, `--menu`, `--destroy-at`, `--pause-at`).
- `tools/probe_physics.gd` — métricas de tuning por mercancía.
- `tools/gen_audio.py` — regenera los sonidos.

## 8. Rendimiento (diseño; sin medición en dispositivo)

- 2 cuerpos cinemáticos activos, ≤4 `move_and_collide` por sub-paso (≤8 por tick a 60 Hz); obstáculos estáticos/animables (≈10–20 por nivel).
- Partículas CPU con pocas unidades (8–28) y autodestrucción.
- Dibujo procedural: los obstáculos estáticos se dibujan una vez; solo repartidor, carga (tarta), drones y plataforma se redibujan por frame.
- Sin texturas: memoria gráfica mínima. Sonido: 376 KB en WAV.
- **No medido en móvil.** En el contenedor (CPU, render por software) las 5 misiones se simulan en ~2 s headless.

## 9. Exportación

`export_presets.cfg` (versionado, **sin secretos**) define tres presets: **Android**, **Linux** y **Windows**. Todos excluyen `tests/`, `tools/` y `docs/`.

- **Android:** plantilla precompilada (sin Gradle), ARMv7 + ARM64, `com.jmpica.cargochaos`, minSdk 24, targetSdk 36, sin permisos, orientación horizontal, modo inmersivo. Firma con `apksigner`; la clave y su contraseña se pasan por variables de entorno (`GODOT_ANDROID_KEYSTORE_RELEASE_*`) desde `tools/export_android.sh`. **La clave nunca va al repositorio.** La APK de prueba actual usa una clave de pruebas temporal: una futura APK firmada con otra clave obligará a desinstalar antes de instalar.
- En el contenedor de desarrollo, `dl.google.com` está bloqueado, así que el "SDK" es un directorio mínimo con `apksigner`/`zipalign` de Ubuntu. Para Google Play hará falta el SDK completo, exportación con Gradle y formato AAB.
- **iOS:** requiere macOS + Xcode; no disponible.
