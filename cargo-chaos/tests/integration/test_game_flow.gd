extends TestCase
## Input, pause, results screen, persistence and analytics through the real scene.


func _scene(index: int, ui := true) -> GameScene:
	var gs := GameScene.new()
	gs.data = game_data()
	gs.level_index = index
	gs.test_mode = not ui
	add_child(gs)
	return gs


func _press(pressed: bool) -> void:
	var ev := InputEventMouseButton.new()
	ev.button_index = MOUSE_BUTTON_LEFT
	ev.pressed = pressed
	ev.position = Vector2(640, 500)
	Input.parse_input_event(ev)


func test_first_touch_starts_the_delivery() -> void:
	var gs := _scene(0, false)
	await physics_frames(10)
	assert_eq(gs.mission.state, Mission.State.READY, "waits for the player")
	var x0 := gs.rig.model.courier_pos.x
	assert_eq(gs.rig.model.courier_pos.x, x0, "no movement before input")
	_press(true)
	await physics_frames(20)
	assert_eq(gs.mission.state, Mission.State.RUNNING, "touch starts the delivery")
	assert_lt(gs.rig.model.courier_vel.y, 0.0, "holding climbs")
	_press(false)
	await physics_frames(30)
	assert_gt(gs.rig.model.courier_vel.y, 0.0, "releasing descends")
	assert_gt(gs.rig.model.courier_pos.x, x0 + 20.0, "auto-forward movement")
	gs.queue_free()


func test_keyboard_thrust_works() -> void:
	var gs := _scene(0, false)
	Input.action_press("thrust")
	await physics_frames(20)
	Input.action_release("thrust")
	assert_eq(gs.mission.state, Mission.State.RUNNING, "space/up/W start and thrust")
	gs.queue_free()


func test_pause_freezes_the_game() -> void:
	var gs := _scene(0)
	_press(true)
	await physics_frames(5)
	_press(false)
	gs._toggle_pause()
	assert_true(get_tree().paused, "tree paused")
	assert_true(gs.menus.is_open(), "pause menu visible")
	var x := gs.rig.model.courier_pos.x
	var t := gs.mission.elapsed
	await get_tree().create_timer(0.3, true).timeout
	assert_eq(gs.rig.model.courier_pos.x, x, "nothing moves while paused")
	assert_eq(gs.mission.elapsed, t, "clock stopped while paused")
	gs._toggle_pause()
	assert_false(get_tree().paused, "resumed")
	assert_false(gs.menus.is_open(), "menu closed")
	gs.queue_free()


func test_success_flow_shows_results_and_saves_progress() -> void:
	Progress.reset_all()
	var mem = Analytics.MemoryBackend.new()
	Analytics.backends.append(mem)
	var gs := _scene(0)
	gs.autopilot = Autopilot.new(game_data().levels[0])
	var t := 0.0
	while not gs.menus.is_open() and t < 60.0:
		await get_tree().physics_frame
		t += 1.0 / 60.0
	assert_true(gs.menus.is_open(), "results screen shown")
	assert_eq(gs.mission.state, Mission.State.SUCCESS, "delivered")
	assert_true(Progress.is_unlocked(1), "mission 2 unlocked")
	assert_gt(Progress.best_stars("level_01"), 0.0, "stars saved")
	var events: Array = mem.records.map(func(r): return r["event"])
	for e in ["delivery_started", "tutorial_started", "delivery_completed", "tutorial_completed"]:
		assert_true(e in events, "analytics event " + e)
	Analytics.backends.erase(mem)
	gs.queue_free()


func test_failure_flow_explains_why() -> void:
	var mem = Analytics.MemoryBackend.new()
	Analytics.backends.append(mem)
	var gs := _scene(1)
	_press(true)
	await physics_frames(3)
	_press(false)
	gs.rig.integrity.apply(200.0, "a billboard", "impact")
	var t := 0.0
	while not gs.menus.is_open() and t < 5.0:
		await get_tree().physics_frame
		t += 1.0 / 60.0
	assert_eq(gs.mission.state, Mission.State.FAILED, "failed")
	assert_true(gs.mission.result_reason.contains("billboard"), "reason names the cause")
	assert_true(gs.menus.is_open(), "results screen with retry")
	assert_false(gs.rig.model.cargo_attached, "destroyed cargo is cut loose")
	var failed: Array = mem.records.filter(func(r): return r["event"] == "delivery_failed")
	assert_eq(failed.size(), 1, "delivery_failed tracked once")
	if failed.size() == 1:
		assert_eq(failed[0]["props"]["cause"], "impact", "failure cause recorded")
	Analytics.backends.erase(mem)
	gs.queue_free()


func test_main_menu_builds_with_all_missions() -> void:
	Progress.reset_all()
	var menu: Control = load("res://scenes/main/main_menu.tscn").instantiate()
	add_child(menu)
	await get_tree().process_frame
	var buttons := menu.find_children("*", "Button", true, false)
	assert_eq(buttons.size(), game_data().levels.size() + 2, "play + sound + one card per mission")
	var locked := buttons.filter(func(b): return b.disabled)
	assert_eq(locked.size(), game_data().levels.size() - 1, "only the first mission is open on a new save")
	menu.queue_free()


func _touch(index: int, pressed: bool) -> void:
	var ev := InputEventScreenTouch.new()
	ev.index = index
	ev.pressed = pressed
	ev.position = Vector2(400 + index * 100, 500)
	Input.parse_input_event(ev)


func test_multitouch_keeps_thrust_while_any_finger_is_down() -> void:
	var gs := _scene(0, false)
	_touch(0, true)
	await physics_frames(3)
	assert_true(gs.thrust_input(), "first finger thrusts")
	_touch(1, true)
	_touch(0, false)
	await physics_frames(2)
	assert_true(gs.thrust_input(), "second finger keeps thrusting after the first lifts")
	_touch(1, false)
	await physics_frames(2)
	assert_false(gs.thrust_input(), "no fingers, no thrust")
	gs.queue_free()
