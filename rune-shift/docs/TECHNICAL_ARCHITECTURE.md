# Rune Shift — Arquitectura técnica

Godot **4.7.2** · GDScript · GL Compatibility · sin dependencias externas · 15/10/2026

## Decisiones principales

| Decisión | Motivo |
|---|---|
| **Simulación de combate pura** (`scripts/sim`, `scripts/runes`, `scripts/core`) sin nodos ni física de Godot | Determinista con semilla, se ejecuta sin pantalla a ~200× tiempo real: permite un bot de equilibrado, pruebas de las 27 combinaciones y partidas reproducibles para depurar (GDD §11) |
| **La vista solo lee** (`scripts/view`) | Arte sustituible sin tocar el combate; las pruebas no dependen de gráficos |
| Resolución lógica **360×640**, estirado `viewport` + `expand`, filtro *nearest* | Pixel art nítido; los móviles más altos ganan espacio vertical (HUD y barra de runas se recolocan) |
| Sprites de 12 px a escala ×2 (24 px) | Tamaño del GDD (~24 px) con arte fácil de editar |
| Contenido en `data/*.json` | Runas, enemigos, salas, oleadas y escalado de dificultad se editan sin código |

## Capas

```
data/            runes.json · enemies.json · rooms.json  (todo el contenido y el equilibrio)
art/             sprites_src.py: pixel art en mapas de caracteres (valida y genera sprite_data.gd)
scripts/runes/   Spell (composición) · RuneForms · RuneElements · RuneCatalysts
scripts/sim/     CombatWorld · Enemy · Projectile · PlayerBody · EnemyAI · BossAI · RoomRunner · Bot
scripts/core/    GameDB · RunState · RewardManager · RunSession (máquina de estados) · Progression (autoload)
scripts/systems/ Analytics · Ads + AdPolicy · Sfx (autoloads)
scripts/view/    ArenaView · PixelArt · SpriteData (generado)
scripts/ui/      App (pantallas y flujo) · TouchStick · UiTheme
tests/           runner propio, unit/ e integration/
tools/           run_tests.sh · balance.gd · capture.sh · build_web_page.sh · gen_audio.py
```

Correspondencia con los sistemas del GDD §18: Player Controller = `PlayerBody` + `TouchStick`; Enemy AI = `EnemyAI`/`BossAI`; Combat System = `CombatWorld`; Rune Engine + Spell Composition = `scripts/runes`; Room Manager = `RoomRunner`; Reward Manager = `RewardManager`; Run State = `RunState` + `RunSession`; Progression Manager + Save System = `Progression`; UI Manager = `App`; Analytics/Ads Interface = autoloads.

## Motor de runas

Un `Spell` = forma + elemento (opcional) + catalizador (opcional). Las piezas no se conocen entre sí; se comunican por **tres eventos**:

| Evento | Quién lo emite | Quién escucha |
|---|---|---|
| `on_cast(world, is_echo)` | la forma al lanzar | Eco |
| `on_hit(world, enemy, source)` | `CombatWorld.hit_enemy` | Elemento (quemadura, ralentización, carga), Rebote |
| `on_kill(world, enemy, source)` | `CombatWorld.damage_enemy` | Ruptura |

`source = {kind, primary, depth, blockable}`:
- `primary`: impacto directo de la forma. Solo estos alimentan el Rebote, así que **un rebote no genera rebotes**.
- `depth`: 0 = hechizo, 1 = efecto de catalizador. Las muertes de profundidad 1 **no vuelven a explotar** (sin cadenas infinitas).
- `blockable`: el escudo del Guardián bloquea orbes, conos, cuchillas y rebotes frontales; explosiones, quemaduras y descargas no.
- Eco no puede generar ecos; la carga de Tormenta se acumula en el hechizo (cualquier enemigo cuenta), así funciona igual con Orbe, Cono y Órbita.

Con 9 comportamientos pequeños salen las 27 combinaciones (GDD §6), y las pruebas comprueban cada una.

## Simulación

Orden fijo por paso (1/60 s): jugador → hechizo → apariciones → IA → estados → proyectiles → separación → daño por contacto → limpieza. Geometría propia: círculos contra rectángulos, línea de visión (Liang-Barsky sin asignaciones), rayos para dibujar avisos.

Reglas de equidad implementadas:
- Todo ataque enemigo tiene aviso (dirección fijada al empezar el aviso): flecha 0,6 s, embestida 0,8 s, anillo del jefe 0,9 s, carga del jefe 1,0 s.
- Los enemigos aparecen tras un portal de 0,9 s y a ≥130 px del jugador.
- **Guardia rota:** tras 6 bloqueos el escudo cae 1,8 s (flanquear es rápido; insistir, lento).
- **Furia a los 75 s:** si una sala se alarga, los enemigos dejan de huir; ninguna sala puede quedar en tablas (encontrado con el bot).
- Los arqueros sin línea de visión se acercan en lugar de esconderse.

## Partida

`RunSession`: INTRO (1,1 s, rótulo de sala) → COMBAT → REWARD (pausado) → … → VICTORY/DEFEAT. Semilla por partida; cada sala usa `semilla·31 + sala·977`. Recompensas guiadas en las salas 1–3 (elemento, catalizador, forma), luego cartas ponderadas: mejoras de runa (niveles 1–3), cambios de runa, mejoras del Forjador, curación y desafío (élite extra → dos elecciones). Dificultad: vida ×(1 + 0,18·sala) y +⌊0,3·sala⌋ enemigos por grupo.

## Servicios

- **Progression:** fragmentos de sello, compendio de combinaciones completas, mejor sala, ajustes. Escritura atómica; un guardado corrupto se aparta (`.corrupt`). Sin multiplicadores permanentes de poder (GDD §15).
- **Analytics:** los 11 eventos del GDD §17 más `session_ended`; backend local JSONL; id de sesión aleatorio; `player_damaged` limitado a uno por segundo.
- **Ads:** `AdPolicy` (solo tras la partida, periodo de gracia, intervalo mínimo) con proveedor nulo: no hay SDK.

## Rendimiento

Una sala con 40 enemigos y 120 proyectiles cuesta ~0,6–0,9 ms por paso en el contenedor (CPU de servidor, sin GPU). **No se ha medido en móviles.** El dibujo es un único `_draw` por frame con texturas pequeñas cacheadas.

## Exportación

`export_presets.cfg`: **Web** (un hilo, WebGL 2) y **Android arm64**. `tools/build_web_page.sh` empaqueta la web como página autocontenida (motor gzip+base64, ~13 MB). iOS nativo requiere macOS + Xcode.
