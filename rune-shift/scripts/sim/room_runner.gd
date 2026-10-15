class_name RoomRunner
extends RefCounted
## Spawns a room's waves and reports when the room is cleared.

var world: CombatWorld
var room_def: Dictionary
var waves: Array = []
var wave_index := -1
var wave_timer := 0.0
var is_boss := false
var boss: Enemy
var cleared := false
var elapsed := 0.0
var _left_threshold := 1
var _max_wait := 10.0
var _telegraph := 0.9


func start(w: CombatWorld, def: Dictionary, extra_elite := false) -> void:
	world = w
	room_def = def
	var rooms := w.db.rooms
	_left_threshold = int(rooms.get("next_wave_when_left", 1))
	_max_wait = float(rooms.get("max_wait", 10))
	_telegraph = float(rooms.get("spawn_telegraph", 0.9))
	is_boss = def.get("boss", false)
	if is_boss:
		var bd: Dictionary = w.db.enemies["boss"]
		boss = w.make_enemy("boss")
		boss.pos = Vector2(w.arena.get_center().x, w.arena.position.y + 120)
		boss.max_hp = float(bd["hp"])
		boss.hp = boss.max_hp
		BossAI.start(boss)
		w.enemies.append(boss)
		w.emit({"type": "boss_intro", "pos": boss.pos})
		return
	var index: int = w.db.rooms["run"].find(def)
	var sc: Dictionary = w.db.rooms.get("scaling", {})
	w.hp_scale = 1.0 + float(sc.get("hp_per_room", 0.0)) * maxi(index, 0)
	var extra := int(floor(maxi(index, 0) * float(sc.get("extra_per_room", 0.0))))
	waves = def.get("waves", []).duplicate(true)
	if extra > 0:
		for wave in waves:
			for group in wave:
				if group.size() < 3 and group[0] != "guardian":
					group[1] = int(group[1]) + extra
	# Small seeded variation: sometimes one extra crawler in the first wave.
	if w.rng.randf() < 0.5 and not waves.is_empty():
		waves[0].append(["crawler", 1])
	if extra_elite and not waves.is_empty():
		var kinds := ["crawler", "charger", "archer"]
		waves[waves.size() - 1].append([kinds[w.rng.randi() % kinds.size()], 1, "brute" if w.rng.randf() < 0.5 else "swift"])
	_next_wave()


func _next_wave() -> void:
	wave_index += 1
	wave_timer = 0.0
	for group in waves[wave_index]:
		var elite: String = group[2] if group.size() > 2 else ""
		for i in int(group[1]):
			world.queue_spawn(group[0], elite, _telegraph + i * 0.12)


func update(dt: float) -> void:
	if cleared:
		return
	elapsed += dt
	if is_boss:
		cleared = not boss.alive
		return
	wave_timer += dt
	if not world.rage and elapsed >= float(world.db.rooms.get("rage_after", 75)) and wave_index == waves.size() - 1:
		world.rage = true
		world.emit({"type": "rage"})
	var remaining := world.alive_count() + world.pending_spawns.size()
	if wave_index < waves.size() - 1:
		if remaining <= _left_threshold or wave_timer >= _max_wait:
			_next_wave()
	elif remaining == 0:
		cleared = true


func total_waves() -> int:
	return 1 if is_boss else waves.size()
