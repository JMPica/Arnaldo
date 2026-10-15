# Cargo Chaos — Informe de pruebas

Este informe distingue lo **verificado automáticamente**, lo **verificado visualmente con capturas reales** y lo **no verificado**. Una ejecución headless correcta **no** equivale a una validación visual ni de sensación de juego.

## 1. Cómo ejecutar

```bash
cd cargo-chaos
tools/run_tests.sh                     # compila todos los scripts + todas las pruebas (headless)
tools/run_tests.sh --suite=unit        # solo unitarias
tools/run_tests.sh --filter=level_03   # filtrar por nombre
python3 tools/write_test_report.py     # vuelca tests/output/results.json en este documento
```

`run_tests.sh` también ejecuta `tools/flow_smoke.gd`: cambios de escena reales (menú → misión → reiniciar → pausa → menú → misión 2 → siguiente), todos OK. Código de salida ≠ 0 si algo falla. Entorno usado: contenedor Linux x86_64, Godot 4.7.2-stable oficial (checksum SHA-512 verificado), sin GPU (Mesa llvmpipe para capturas).

## 2. Resultados automáticos

<!-- AUTO:START -->
Ejecución: 2026-10-15 · Godot 4.7.2-stable (official) · **59 OK, 0 fallos** · 5.6 s

| Suite | Prueba | Resultado | Métricas |
|---|---|---|---|
| test_damage | `test_no_damage_below_threshold` | ✅ |  |
| test_damage | `test_damage_grows_with_speed` | ✅ |  |
| test_damage | `test_fragility_orders_cargo` | ✅ | damage at 350 px/s: glass 73.4, cake 38.9, piano 16.2 |
| test_damage | `test_surface_and_level_multipliers` | ✅ |  |
| test_damage | `test_tilt_damage_only_for_tilt_sensitive_cargo_past_limit` | ✅ |  |
| test_damage | `test_scrape_needs_real_sliding` | ✅ |  |
| test_damage | `test_integrity_states_and_signals` | ✅ |  |
| test_data_and_systems | `test_all_shipped_data_is_valid` | ✅ |  |
| test_data_and_systems | `test_level_validation_reports_errors` | ✅ |  |
| test_data_and_systems | `test_obstacle_anchoring` | ✅ |  |
| test_data_and_systems | `test_progress_save_load_and_unlock` | ✅ |  |
| test_data_and_systems | `test_progress_survives_corrupt_save` | ✅ |  |
| test_data_and_systems | `test_analytics_events_reach_backends` | ✅ |  |
| test_data_and_systems | `test_ad_policy_respects_the_player` | ✅ |  |
| test_data_and_systems | `test_null_ad_provider_never_shows` | ✅ |  |
| test_data_and_systems | `test_all_sounds_load` | ✅ |  |
| test_flight_physics | `test_holding_climbs_and_releasing_falls` | ✅ |  |
| test_flight_physics | `test_thrust_response_is_immediate` | ✅ |  |
| test_flight_physics | `test_speed_limits` | ✅ |  |
| test_flight_physics | `test_auto_forward_reaches_cruise_speed` | ✅ |  |
| test_flight_physics | `test_same_result_at_30_60_120_ticks` | ✅ |  |
| test_flight_physics | `test_robust_at_irregular_tick_rate` | ✅ |  |
| test_flight_physics | `test_heavy_piano_climbs_slower_than_glass` | ✅ | climb 200px: glass 0.65s, piano 1.11s |
| test_flight_physics | `test_light_cargo_trails_further_behind` | ✅ | trail angle: glass 9.5°, piano 2.3° |
| test_flight_physics | `test_cake_stays_level_with_smooth_flying` | ✅ | cake max tilt with smooth hover: 7.8° (limit 24°) |
| test_flight_physics | `test_no_explosion_under_random_input` | ✅ |  |
| test_flight_physics | `test_rope_never_pushes` | ✅ |  |
| test_flight_physics | `test_rope_limit_correction_pulls_back` | ✅ |  |
| test_flight_physics | `test_contact_impulse_bounces_and_reports_speed` | ✅ |  |
| test_flight_physics | `test_gentle_contact_does_not_bounce` | ✅ |  |
| test_flight_physics | `test_frontal_bonk_stuns_courier` | ✅ |  |
| test_mission | `test_starts_ready_and_waits_for_input` | ✅ |  |
| test_mission | `test_brakes_smoothly_to_the_pad` | ✅ |  |
| test_mission | `test_success_requires_settled_cargo_on_pad` | ✅ |  |
| test_mission | `test_tilted_cake_is_not_delivered` | ✅ |  |
| test_mission | `test_fails_when_cargo_destroyed_with_clear_reason` | ✅ |  |
| test_mission | `test_fails_on_timeout` | ✅ |  |
| test_mission | `test_no_rules_after_finish` | ✅ |  |
| test_mission | `test_stars_and_coins` | ✅ |  |
| test_game_flow | `test_first_touch_starts_the_delivery` | ✅ |  |
| test_game_flow | `test_keyboard_thrust_works` | ✅ |  |
| test_game_flow | `test_pause_freezes_the_game` | ✅ |  |
| test_game_flow | `test_success_flow_shows_results_and_saves_progress` | ✅ |  |
| test_game_flow | `test_failure_flow_explains_why` | ✅ |  |
| test_game_flow | `test_main_menu_builds_with_all_missions` | ✅ |  |
| test_game_flow | `test_multitouch_keeps_thrust_while_any_finger_is_down` | ✅ |  |
| test_levels | `test_level_01_completable` | ✅ | level_01: OK, integrity 98%, 0 hits, 13.4s |
| test_levels | `test_level_02_completable` | ✅ | level_02: OK, integrity 97%, 1 hits, 18.6s |
| test_levels | `test_level_03_completable` | ✅ | level_03: OK, integrity 96%, 1 hits, 19.2s |
| test_levels | `test_level_04_completable` | ✅ | level_04: OK, integrity 97%, 0 hits, 18.3s (limit 30s) |
| test_levels | `test_level_05_completable` | ✅ | level_05: OK, integrity 100%, 0 hits, 22.3s (limit 34s) |
| test_levels | `test_five_missions_shipped` | ✅ |  |
| test_levels | `test_same_outcome_at_30_and_120_physics_ticks` | ✅ | level 1 at 30 Hz: OK integrity 90%<br>level 3 at 30 Hz: OK integrity 99%<br>level 4 at 30 Hz: OK integrity 97%<br>level 1 at 120 Hz: OK integrity 98%<br>level 3 at 120 Hz: OK integrity 97%<br>level 4 at 120 Hz: OK integrity 94% |
| test_rig_collisions | `test_cargo_hitting_a_wall_takes_damage_with_named_source` | ✅ |  |
| test_rig_collisions | `test_resting_on_the_ground_causes_no_damage` | ✅ |  |
| test_rig_collisions | `test_hard_drop_on_ground_damages_glass_more_than_piano` | ✅ | drop from y=150: glass -100%, piano -37% |
| test_rig_collisions | `test_soft_awning_hurts_less_than_a_roof` | ✅ | drop onto awning -34%, onto roof -100% |
| test_rig_collisions | `test_courier_bonks_and_does_not_get_stuck_on_walls` | ✅ |  |
| test_rig_collisions | `test_moving_obstacle_reports_relative_speed` | ✅ |  |
<!-- AUTO:END -->

## 3. Qué cubren las pruebas

| Área | Cómo se prueba |
|---|---|
| Movimiento y estados del jetpack | Modelo puro: subir/bajar, respuesta <50 ms, límites de velocidad, velocidad de crucero |
| Independencia del framerate | Mismo resultado a 30/60/120 Hz (<0.5 px), 50 Hz dentro del 3 %; niveles 1, 3 y 4 completados a 30 y 120 ticks. **Prueba de mutación:** al quitar los sub-pasos la prueba falla (7.9 px de divergencia) |
| Comportamiento de cargas | Piano sube ≥1.3× más lento; el cristal se queda más atrás; tarta nivelada con vuelo suave; estabilidad 60 s con entrada aleatoria |
| Daño | Umbral sin daño, crecimiento con la velocidad, orden de fragilidad, superficies, inclinación, arrastre, estados e integridad |
| Colisiones reales (`move_and_collide`) | Golpe contra edificio con causa nombrada, reposo sin daño ni temblor, caída cristal vs piano, toldo vs tejado, repartidor no atraviesa muros, velocidad de obstáculos móviles |
| Victoria / derrota | Inicio con el primer toque, frenada, entrega solo con la carga asentada (y la tarta nivelada), destrucción con motivo, tiempo agotado, estrellas y monedas |
| Niveles | Datos válidos, validación detecta errores, 5 misiones y 3 cargas, **cada misión completada por el autopiloto con la física real** |
| Flujo | Toque/teclado/multitáctil, pausa congela física y reloj, pantalla de resultados, guardado de progreso, eventos de analítica, menú con misiones bloqueadas |
| Persistencia | Ida y vuelta, desbloqueo, mejores marcas, fichero corrupto |
| Sistemas | Analítica sin campos personales, política de anuncios, proveedor nulo, sonidos importados |

## 4. Verificación visual (capturas reales renderizadas)

Renderizadas con Godot en Xvfb (`tools/capture.sh`, `tools/overview.sh`) y revisadas una a una:

- Menú principal con mascota animada, PLAY, tarjetas de misión, monedas y sonido.
- Misiones 1–5 en juego (día, atardecer y noche), con las tres mercancías dibujadas y HUD.
- Pantalla de resultados con estrellas, pantalla de fracaso con motivo, menú de pausa.
- Vista completa de cada nivel con la trayectoria del bot (repartidor y carga).
- Vídeo de la misión 4 completa (Movie Maker de Godot).

Problemas encontrados así y corregidos: "NEXT DELIVERY" en la última misión; daño por arrastre sobre la plataforma tras entregar; integridad final distinta de la anunciada; pistas de texto pegadas a la calle.

## 5. NO verificado (limitaciones honestas)

- **Sensación de control con un humano.** Todo el juego se ha jugado con un bot; el tuning se apoya en métricas, no en playtests. Es la siguiente prioridad.
- **Dispositivos móviles / emulador:** no disponibles. El táctil se ha probado con eventos sintéticos (`InputEventScreenTouch`), no con un dedo real. Sin exportación Android/iOS.
- **Rendimiento / 60 FPS en móvil:** no medido. Solo se sabe que la simulación headless es rápida en el contenedor.
- **Audio:** los sonidos se generan, importan y cargan (probado), pero **nadie los ha escuchado**: el entorno no tiene salida de audio.
- **Pantallas de 120 Hz:** la interpolación física está desactivada; podría notarse falta de suavidad.
- **Relaciones de aspecto distintas de 16:9:** diseñado para `expand`, no capturado en 4:3 ni 20:9.
- **Dificultad real:** los porcentajes del bot no miden la dificultad humana.
