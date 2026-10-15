# Rune Shift — Informe de pruebas

Separa lo **verificado automáticamente**, lo **verificado visualmente** y lo **no verificado**. Una ejecución sin pantalla correcta no equivale a validar la diversión.

## Cómo ejecutar

```bash
cd rune-shift
tools/run_tests.sh                    # compila todo y ejecuta las pruebas (se niega a correr si algo no compila)
tools/run_tests.sh --filter=boss      # filtrar
godot --headless --path . --script res://tools/balance.gd -- --seeds=4 --skill=0.8   # equilibrado con el bot
python3 tools/write_test_report.py    # vuelca tests/output/results.json en la tabla de abajo
```

## Resultados automáticos

<!-- AUTO:START -->
Ejecución: 2026-10-15 · Godot 4.7.2-stable (official) · **46 OK, 0 fallos** · 7.1 s

| Suite | Prueba | Resultado | Métricas |
|---|---|---|---|
| test_enemies | `test_crawler_chases_the_player` | ✅ |  |
| test_enemies | `test_archer_telegraphs_then_shoots_along_the_locked_line` | ✅ |  |
| test_enemies | `test_stepping_out_of_the_charge_lane_avoids_the_hit` | ✅ |  |
| test_enemies | `test_guardian_blocks_from_the_front_and_breaks` | ✅ |  |
| test_enemies | `test_spawns_are_announced_and_never_on_top_of_the_player` | ✅ |  |
| test_enemies | `test_elites_are_stronger` | ✅ |  |
| test_enemies | `test_boss_patterns_are_telegraphed_and_leave_gaps` | ✅ |  |
| test_enemies | `test_boss_enters_phase_two_at_half_health` | ✅ |  |
| test_enemies | `test_long_rooms_end_with_enraged_enemies` | ✅ |  |
| test_run | `test_run_has_eight_rooms_and_a_boss` | ✅ |  |
| test_run | `test_first_rooms_guide_the_three_rune_families` | ✅ |  |
| test_run | `test_cards_change_the_spell` | ✅ |  |
| test_run | `test_standard_offers_are_distinct_and_valid` | ✅ |  |
| test_run | `test_challenge_adds_an_elite_and_a_second_pick` | ✅ |  |
| test_run | `test_death_ends_the_run` | ✅ |  |
| test_run | `test_beating_the_boss_wins_the_run` | ✅ |  |
| test_run | `test_same_seed_same_run` | ✅ |  |
| test_run | `test_bot_runs_end_and_rooms_last_a_reasonable_time` | ✅ | seed 101: WIN, 9 rooms, 280s, Orbe de Hielo · Ruptura<br>seed 202: WIN, 9 rooms, 232s, Orbe de Fuego · Rebote<br>seed 303: WIN, 9 rooms, 222s, Orbe de Fuego · Ruptura<br>bot room median 28.7s |
| test_runes | `test_all_27_combinations_work` | ✅ |  |
| test_runes | `test_each_rune_leaves_only_its_own_fingerprint` | ✅ |  |
| test_runes | `test_forms_hit_differently` | ✅ | cone/fire/echo: 84 hits, 1617 damage, 12 casts<br>orb/fire/echo: 12 hits, 171 damage, 12 casts<br>orbit/fire/echo: 47 hits, 830 damage, 7 casts |
| test_runes | `test_spell_without_element_or_catalyst_still_works` | ✅ |  |
| test_runes | `test_rupture_explosions_never_chain` | ✅ |  |
| test_runes | `test_rebound_does_not_feed_itself` | ✅ |  |
| test_runes | `test_echo_repeats_casts` | ✅ |  |
| test_runes | `test_storm_discharge_happens_on_the_nth_hit` | ✅ |  |
| test_runes | `test_ice_slows_and_makes_vulnerable` | ✅ |  |
| test_runes | `test_fire_burn_stacks_and_expires` | ✅ |  |
| test_runes | `test_upgrades_change_the_spell` | ✅ |  |
| test_runes | `test_targeting_prefers_immediate_threats` | ✅ |  |
| test_runes | `test_display_names` | ✅ |  |
| test_systems | `test_data_is_valid` | ✅ |  |
| test_systems | `test_param_reads_levels` | ✅ |  |
| test_systems | `test_room_obstacles_leave_the_start_free` | ✅ |  |
| test_systems | `test_progression_saves_and_survives_corruption` | ✅ |  |
| test_systems | `test_no_permanent_damage_multipliers` | ✅ |  |
| test_systems | `test_analytics_minimal_and_known_events` | ✅ |  |
| test_systems | `test_ads_never_interrupt_play` | ✅ |  |
| test_systems | `test_sprites_are_well_formed` | ✅ |  |
| test_systems | `test_text_only_uses_glyphs_the_font_has` | ✅ |  |
| test_systems | `test_simulation_is_fast_enough_for_phones` | ✅ | 40 enemies + 120 shots: 0.56 ms per step on this machine |
| test_systems | `test_all_sounds_and_music_load` | ✅ |  |
| test_systems | `test_flipped_sprites_are_drawn_in_place` | ✅ |  |
| test_app_flow | `test_menu_then_run_then_forge` | ✅ |  |
| test_app_flow | `test_pause_freezes_the_room` | ✅ |  |
| test_app_flow | `test_death_shows_results_and_saves` | ✅ |  |
<!-- AUTO:END -->

## Equilibrado con el bot (27 combinaciones × 4 semillas)

Última ejecución: 108 partidas, **79 victorias del bot (73%)**, todas terminan. Mediana de sala 29,1 s (p10 14,2 s, p90 41,6 s); combate por partida 211–289 s.

| Familia | Victorias del bot |
|---|---|
| Formas | Orbe 30/36 · Cono 28/36 · Órbita 21/36 |
| Elementos | Fuego 31/36 · Hielo 24/36 · Tormenta 24/36 |
| Catalizadores | Eco 31/36 · Ruptura 24/36 · Rebote 24/36 |

Tabla completa por combinación: `docs/balance_latest.txt`.

El bot solo mueve el "joystick" y elige cartas; esquiva avisos y proyectiles y flanquea guardianes con reglas simples. Es una **referencia de completabilidad y de diferencias entre combinaciones, no una medida de la dificultad humana**.

## Problemas encontrados por las pruebas y corregidos

| Hallazgo | Cómo apareció | Corrección |
|---|---|---|
| Salas imposibles: el escudo del Guardián bloqueaba >1000 impactos de Orbe/Cono | Bot atascado 20 min en la sala 4 | "Guardia rota" tras 6 bloqueos, giro más lento, el bot aprende a flanquear |
| Arqueros escondidos tras muros contra formas de corto alcance | Bot atascado en "Paso Estrecho" | Línea de visión: el Cono no atraviesa muros, el autoapuntado prefiere objetivos visibles, los arqueros sin visión se acercan; furia a los 75 s como red de seguridad |
| Tormenta + Cono casi nunca descargaba | Prueba de las 27 combinaciones | La carga se acumula en el hechizo, no en cada enemigo |
| Sprites girados dibujados 24 px a la derecha | Captura en un iPhone emulado | Volteo con transformación espejo + prueba |
| La barra de runas no aparecía | Captura | Recolocación del HUD en un `_layout` que también responde al tamaño de pantalla |
| Scripts rotos colgaban las herramientas | Medición que no terminaba | `run_tests.sh` y `capture.sh` compilan primero y abortan con un mensaje |

## Verificado visualmente (capturas reales del juego)

Menú, salas con plantillas distintas, avisos de arquero, embestidor, guardián con escudo, explosión de Ruptura, forja con cartas, barra de runas, jefe con barra de vida y sus dos avisos, resultados. Web probada en Chromium emulando un **iPhone 13 en vertical**, con toques reales: carga en ~4 s, botón JUGAR, joystick dinámico y movimiento.

## No verificado

- **Ningún humano lo ha jugado.** Los objetivos del GDD §21 (80% entiende los controles, 70% supera 3 salas, 60% repite partida) solo se pueden medir con playtests observados.
- **iPhone real / Safari:** solo emulación de Chromium.
- **Rendimiento en móviles:** no medido (sí en el contenedor: <1 ms por paso con 40 enemigos).
- **Audio:** se genera y carga, pero nadie lo ha escuchado (el entorno no tiene salida de sonido).
- Android: existe el preset arm64, pero no he generado ni instalado ese APK en este encargo.
