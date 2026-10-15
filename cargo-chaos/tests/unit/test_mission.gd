extends TestCase
## Mission rules: start, braking, win and every failure condition.


func _mission(time_limit := 0.0) -> Mission:
	var lv: LevelData = game_data().levels[0]
	var copy := LevelData.new()
	copy.id = lv.id
	copy.cruise_speed = 250.0
	copy.pad_center_x = 3000.0
	copy.time_limit = time_limit
	return Mission.new(copy, "Glass Box", game_data().world)


func _ctx(integ: CargoIntegrity, x := 0.0, on_pad := false, speed := 0.0, tilt_ok := true) -> Dictionary:
	return {"courier_x": x, "integrity": integ, "cargo_on_pad": on_pad, "cargo_speed": speed, "cargo_tilt_ok": tilt_ok}


func test_starts_ready_and_waits_for_input() -> void:
	var m := _mission()
	assert_eq(m.state, Mission.State.READY, "ready state")
	assert_eq(m.target_speed_at(0.0), 0.0, "no forward motion before the first tap")
	m.tick(1.0, _ctx(CargoIntegrity.new()))
	assert_eq(m.elapsed, 0.0, "clock does not run before start")
	m.start()
	assert_eq(m.state, Mission.State.RUNNING, "running after start")
	assert_eq(m.target_speed_at(0.0), 250.0, "cruise speed")


func test_brakes_smoothly_to_the_pad() -> void:
	var m := _mission()
	m.start()
	var prev := m.target_speed_at(3000.0 - m.brake_distance)
	for d in [250.0, 150.0, 60.0, 10.0, 0.0]:
		var v := m.target_speed_at(3000.0 - d)
		assert_true(v <= prev + 0.001, "speed decreases approaching the pad")
		prev = v
	assert_eq(m.target_speed_at(3000.0), 0.0, "stops over the pad")
	m.tick(0.1, _ctx(CargoIntegrity.new(), 2900.0))
	assert_eq(m.state, Mission.State.BRAKING, "braking near the pad")


func test_success_requires_settled_cargo_on_pad() -> void:
	var m := _mission()
	var integ := CargoIntegrity.new()
	var result := []
	m.finished.connect(func(ok, reason): result.append([ok, reason]))
	m.start()
	m.tick(0.1, _ctx(integ, 2900.0))
	for i in 10:
		m.tick(0.1, _ctx(integ, 3000.0, true, 300.0))  # touching but bouncing
	assert_eq(m.state, Mission.State.BRAKING, "not delivered while moving fast")
	m.tick(0.2, _ctx(integ, 3000.0, true, 10.0))
	m.tick(0.1, _ctx(integ, 3000.0, false, 10.0))  # lost contact: timer resets
	m.tick(0.2, _ctx(integ, 3000.0, true, 10.0))
	assert_eq(m.state, Mission.State.BRAKING, "settle timer resets when contact is lost")
	m.tick(0.2, _ctx(integ, 3000.0, true, 10.0))
	assert_eq(m.state, Mission.State.SUCCESS, "delivered once settled")
	assert_eq(result.size(), 1, "finished emitted once")
	assert_true(result[0][0], "success flag")


func test_tilted_cake_is_not_delivered() -> void:
	var m := _mission()
	m.start()
	var integ := CargoIntegrity.new()
	m.tick(0.1, _ctx(integ, 2900.0))
	for i in 10:
		m.tick(0.1, _ctx(integ, 3000.0, true, 5.0, false))
	assert_eq(m.state, Mission.State.BRAKING, "a cake lying on its side is not a delivery")


func test_fails_when_cargo_destroyed_with_clear_reason() -> void:
	for kind in ["impact", "tilt", "scrape"]:
		var m := _mission()
		m.start()
		var integ := CargoIntegrity.new()
		integ.apply(200.0, "a billboard", kind)
		m.tick(0.1, _ctx(integ))
		assert_eq(m.state, Mission.State.FAILED, kind + " destroys")
		assert_true(m.result_reason.length() > 10, kind + " reason given")
		if kind == "impact":
			assert_true(m.result_reason.contains("billboard"), "reason names what was hit")


func test_fails_on_timeout() -> void:
	var m := _mission(5.0)
	m.start()
	var integ := CargoIntegrity.new()
	for i in 49:
		m.tick(0.1, _ctx(integ))
	assert_eq(m.state, Mission.State.RUNNING, "still running before the limit")
	m.tick(0.2, _ctx(integ))
	assert_eq(m.state, Mission.State.FAILED, "fails at the time limit")
	assert_true(m.result_reason.contains("Time"), "timeout reason")


func test_no_rules_after_finish() -> void:
	var m := _mission()
	m.start()
	var integ := CargoIntegrity.new()
	integ.apply(200.0, "x", "impact")
	m.tick(0.1, _ctx(integ))
	var t := m.elapsed
	m.tick(1.0, _ctx(integ))
	assert_eq(m.elapsed, t, "clock frozen after the end")


func test_stars_and_coins() -> void:
	assert_eq(Mission.stars_for(100.0), 3, "perfect")
	assert_eq(Mission.stars_for(90.0), 3, "90")
	assert_eq(Mission.stars_for(75.0), 2, "75")
	assert_eq(Mission.stars_for(10.0), 1, "barely")
	assert_eq(Mission.coins_for(100, 100.0), 100, "full reward")
	assert_eq(Mission.coins_for(100, 50.0), 50, "half reward")
	assert_eq(Mission.coins_for(100, 1.0), 20, "minimum share")
