extends TestCase
## Every mission must be completable with the real physics: the autopilot flies
## each level's reference path pressing only the single button a player has.


func _fly(index: int, ticks := 60, max_seconds := 90.0) -> Dictionary:
	Engine.physics_ticks_per_second = ticks
	var gs := GameScene.new()
	gs.data = game_data()
	gs.level_index = index
	gs.test_mode = true
	gs.autopilot = Autopilot.new(game_data().levels[index])
	add_child(gs)
	var result := {}
	gs.finished.connect(func(ok: bool, reason: String) -> void:
		result["ok"] = ok
		result["reason"] = reason)
	var t := 0.0
	while result.is_empty() and t < max_seconds:
		await get_tree().physics_frame
		t += 1.0 / ticks
	result["integrity"] = gs.rig.integrity.value
	result["time"] = gs.mission.elapsed
	result["hits"] = gs.rig.integrity.total_hits
	gs.queue_free()
	Engine.physics_ticks_per_second = 60
	await get_tree().process_frame
	return result


func _check_level(index: int) -> void:
	var lv: LevelData = game_data().levels[index]
	var r := await _fly(index)
	note("%s: %s, integrity %.0f%%, %d hits, %.1fs%s" % [lv.id, "OK" if r.get("ok") else "FAIL",
			r["integrity"], r["hits"], r["time"], (" (limit %.0fs)" % lv.time_limit) if lv.time_limit > 0 else ""])
	assert_true(r.get("ok", false), "%s must be completable: %s" % [lv.id, r.get("reason", "timeout")])
	assert_gt(r["integrity"], 50.0, lv.id + " completable with margin")


func test_level_01_completable() -> void:
	await _check_level(0)


func test_level_02_completable() -> void:
	await _check_level(1)


func test_level_03_completable() -> void:
	await _check_level(2)


func test_level_04_completable() -> void:
	await _check_level(3)


func test_level_05_completable() -> void:
	await _check_level(4)


func test_five_missions_shipped() -> void:
	assert_eq(game_data().levels.size(), 5, "vertical slice has five missions")
	var cargos := {}
	for lv in game_data().levels:
		cargos[lv.cargo_id] = true
	assert_eq(cargos.size(), 3, "all three cargo types are used")


func test_same_outcome_at_30_and_120_physics_ticks() -> void:
	for ticks in [30, 120]:
		for index in [0, 2, 3]:
			var r := await _fly(index, ticks)
			note("level %d at %d Hz: %s integrity %.0f%%" % [index + 1, ticks, "OK" if r.get("ok") else "FAIL", r["integrity"]])
			assert_true(r.get("ok", false), "level %d completes at %d Hz" % [index + 1, ticks])
