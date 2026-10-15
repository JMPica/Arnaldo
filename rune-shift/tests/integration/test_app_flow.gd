extends TestCase
## The real app scene: menu -> run -> forge -> next room -> pause -> results.


func _app() -> Node:
	var app: Node = load("res://scenes/main.tscn").instantiate()
	add_child(app)
	return app


func _wait_until(cond: Callable, seconds: float) -> bool:
	var t := 0.0
	while t < seconds:
		if cond.call():
			return true
		await get_tree().physics_frame
		t += 1.0 / 60.0
	return cond.call()


func test_menu_then_run_then_forge() -> void:
	Progression.reset_all()
	var mem = Analytics.MemoryBackend.new()
	Analytics.backends.append(mem)
	var app := _app()
	await get_tree().process_frame
	assert_true(app.overlay != null, "menu shown")
	var bot := Bot.new(3, 1.0)
	app.autopilot = bot
	app.auto_choose_delay = 0.3
	app.start_run(77)
	assert_true(app.session != null, "run started")
	var reached := await _wait_until(func(): return app.session.phase == RunSession.Phase.REWARD, 90.0)
	assert_true(reached, "room 1 cleared and the forge opened")
	assert_true(app.overlay != null, "forge overlay visible")
	var room_before: int = app.session.run.room_index
	var moved := await _wait_until(func(): return app.session.run.room_index > room_before, 5.0)
	assert_true(moved, "a card was chosen and the next room started")
	assert_true(app.session.run.spell.element != "", "the guided first reward added an element")
	var events: Array = mem.records.map(func(r): return r["event"])
	for e in ["run_started", "room_entered", "room_completed", "rune_selected", "spell_configuration_changed"]:
		assert_true(e in events, "analytics: " + e)
	Analytics.backends.erase(mem)
	app.queue_free()


func test_pause_freezes_the_room() -> void:
	var app := _app()
	app.start_run(5)
	await physics_frames(90)
	app._toggle_pause()
	assert_true(app._paused, "paused")
	var t: float = app.session.world.time
	await physics_frames(30)
	assert_eq(app.session.world.time, t, "the simulation does not advance while paused")
	app._toggle_pause()
	await physics_frames(5)
	assert_gt(app.session.world.time, t, "resumes")
	app.queue_free()


func test_death_shows_results_and_saves() -> void:
	Progression.reset_all()
	var mem = Analytics.MemoryBackend.new()
	Analytics.backends.append(mem)
	var app := _app()
	app.start_run(9)
	await physics_frames(80)
	app.session.world.player.hp = 1.0
	app.session.world.hurt_player(10.0, "archer")
	var shown := await _wait_until(func(): return app._results_timer < 0.0 and app.session.is_over() and app.overlay != null, 4.0)
	assert_true(shown, "results screen")
	assert_eq(int(Progression.data["runs"]), 1, "run recorded")
	var events: Array = mem.records.map(func(r): return r["event"])
	assert_true("player_died" in events, "player_died tracked")
	assert_true("run_completed" in events, "run_completed tracked")
	Analytics.backends.erase(mem)
	app.queue_free()
