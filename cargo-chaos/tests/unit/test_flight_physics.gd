extends TestCase
## Flight + rope model, without collisions.


func _model(cargo_id := "glass_box") -> RigModel:
	var m := RigModel.new(flight(), cargo(cargo_id))
	m.place(Vector2(0, 300))
	return m


## Same sub-stepping as CourierRig: tick dt split into steps <= max_substep.
func _run(m: RigModel, seconds: float, tick_dt: float, input: Callable, cruise := 270.0) -> void:
	var t := 0.0
	while t < seconds - 0.00001:
		var thrust: bool = input.call(t)
		var steps := maxi(1, ceili(tick_dt / m.flight.max_substep - 0.0001))
		var h := tick_dt / steps
		for i in steps:
			m.step_free(h, thrust, cruise)
		t += tick_dt


func test_holding_climbs_and_releasing_falls() -> void:
	var m := _model()
	_run(m, 1.0, 1.0 / 60.0, func(_t): return true)
	assert_lt(m.courier_vel.y, -200.0, "holding thrust should climb")
	var y_top := m.courier_pos.y
	_run(m, 1.0, 1.0 / 60.0, func(_t): return false)
	assert_gt(m.courier_vel.y, 200.0, "releasing should fall")
	assert_gt(m.courier_pos.y, y_top, "courier should have descended")


func test_thrust_response_is_immediate() -> void:
	var m := _model()
	_run(m, 0.05, 1.0 / 60.0, func(_t): return true)
	assert_near(m.thrust_level, 1.0, 0.001, "full thrust within 50 ms")
	_run(m, 0.1, 1.0 / 60.0, func(_t): return false)
	assert_near(m.thrust_level, 0.0, 0.001, "thrust off within 100 ms")


func test_speed_limits() -> void:
	var m := _model()
	_run(m, 4.0, 1.0 / 60.0, func(_t): return true)
	assert_true(m.courier_vel.y >= -m.flight.max_rise_speed - 0.01, "rise speed capped")
	_run(m, 4.0, 1.0 / 60.0, func(_t): return false)
	assert_true(m.courier_vel.y <= m.flight.max_fall_speed + 0.01, "fall speed capped")


func test_auto_forward_reaches_cruise_speed() -> void:
	var m := _model()
	_run(m, 3.0, 1.0 / 60.0, func(_t): return m.courier_vel.y > 0.0)
	assert_near(m.courier_vel.x, 270.0, 30.0, "cruise speed")


func test_same_result_at_30_60_120_ticks() -> void:
	# Input changes on 1/30 s boundaries so every tick rate sees the same input.
	var pattern := func(t: float) -> bool: return fmod(t + 0.00001, 0.6) < 0.3
	var finals: Array[Vector2] = []
	for hz in [30.0, 60.0, 120.0]:
		var m := _model()
		_run(m, 4.0, 1.0 / hz, pattern)
		finals.append(m.cargo_pos)
	assert_lt(finals[0].distance_to(finals[1]), 0.5, "30 vs 60 Hz cargo position")
	assert_lt(finals[1].distance_to(finals[2]), 0.5, "60 vs 120 Hz cargo position")


func test_robust_at_irregular_tick_rate() -> void:
	# 50 Hz does not divide into the 1/120 sub-step: results must stay close.
	var pattern := func(t: float) -> bool: return fmod(t, 0.8) < 0.4
	var a := _model()
	_run(a, 4.0, 1.0 / 60.0, pattern)
	var b := _model()
	_run(b, 4.0, 1.0 / 50.0, pattern)
	var travel := a.courier_pos.distance_to(Vector2(0, 300))
	assert_lt(a.courier_pos.distance_to(b.courier_pos), travel * 0.03, "50 Hz within 3% of 60 Hz")


func test_heavy_piano_climbs_slower_than_glass() -> void:
	var times := {}
	for id in ["glass_box", "heavy_piano"]:
		var m := _model(id)
		_run(m, 1.0, 1.0 / 120.0, func(_t): return m.courier_vel.y > 0.0)
		var y0 := m.courier_pos.y
		var t := 0.0
		while m.courier_pos.y > y0 - 200.0 and t < 5.0:
			m.step_free(1.0 / 120.0, true, 270.0)
			t += 1.0 / 120.0
		times[id] = t
	note("climb 200px: glass %.2fs, piano %.2fs" % [times["glass_box"], times["heavy_piano"]])
	assert_gt(times["heavy_piano"], times["glass_box"] * 1.3, "piano should feel heavier")


func test_light_cargo_trails_further_behind() -> void:
	var trail := {}
	for id in ["glass_box", "heavy_piano"]:
		var m := _model(id)
		_run(m, 4.0, 1.0 / 60.0, func(_t): return m.courier_vel.y > 0.0)
		trail[id] = absf(rad_to_deg(m.rope_angle()))
	note("trail angle: glass %.1f°, piano %.1f°" % [trail["glass_box"], trail["heavy_piano"]])
	assert_gt(trail["glass_box"], trail["heavy_piano"] + 3.0, "glass trails more than piano")


func test_cake_stays_level_with_smooth_flying() -> void:
	var m := _model("birthday_cake")
	var max_tilt := 0.0
	var on := false
	var t := 0.0
	var base := 300.0
	while t < 8.0:
		var target := base + (60.0 if int(t / 1.5) % 2 == 0 else -60.0)
		if m.courier_pos.y > target + 12.0:
			on = true
		elif m.courier_pos.y < target - 12.0:
			on = false
		m.step_free(1.0 / 120.0, on, 270.0)
		if t > 1.0:
			max_tilt = maxf(max_tilt, absf(m.tilt_degrees()))
		t += 1.0 / 120.0
	note("cake max tilt with smooth hover: %.1f° (limit %.0f°)" % [max_tilt, m.cargo.tilt_limit_deg])
	assert_lt(max_tilt, m.cargo.tilt_limit_deg, "smooth flight must not hurt the cake")


func test_no_explosion_under_random_input() -> void:
	for id in ["glass_box", "heavy_piano", "birthday_cake"]:
		var m := _model(id)
		var rng := RandomNumberGenerator.new()
		rng.seed = 1234
		var thrust := false
		for i in 120 * 60:
			if rng.randf() < 0.08:
				thrust = not thrust
			m.step_free(1.0 / 120.0, thrust, 270.0)
		var finite := is_finite(m.cargo_pos.x) and is_finite(m.cargo_pos.y) and is_finite(m.cargo_angle)
		assert_true(finite, "%s state stays finite" % id)
		assert_lt(m.rope_length_now(), m.cargo.rope_length * 1.6, "%s rope stays sane" % id)


func test_rope_never_pushes() -> void:
	var m := _model()
	m.cargo_pos = m.rope_anchor() + Vector2(0, 30)  # rope slack
	assert_eq(m.rope_force_on_cargo(), Vector2.ZERO, "slack rope applies no force")


func test_rope_limit_correction_pulls_back() -> void:
	var m := _model()
	m.cargo_pos += Vector2(0, m.cargo.rope_length)  # far over-stretched
	var corr := m.rope_limit_correction()
	m.courier_pos += corr[0]
	m.cargo_pos += corr[1]
	assert_lt(m.rope_length_now(), m.cargo.rope_length * 1.3 + 0.5, "rope back within limit")


func test_contact_impulse_bounces_and_reports_speed() -> void:
	var m := _model()
	m.cargo_vel = Vector2(0, 400)
	var bottom := m.cargo_pos + Vector2(0, m.cargo.size.y * 0.5)
	var impact := m.apply_cargo_contact(Vector2.UP, bottom, Vector2.ZERO)
	assert_near(impact, 400.0, 0.01, "impact speed")
	assert_lt(m.cargo_vel.y, 0.0, "cargo bounces up")
	assert_lt(absf(m.cargo_vel.y), 400.0, "bounce loses energy")


func test_gentle_contact_does_not_bounce() -> void:
	var m := _model()
	m.cargo_vel = Vector2(0, 30)
	var bottom := m.cargo_pos + Vector2(0, m.cargo.size.y * 0.5)
	m.apply_cargo_contact(Vector2.UP, bottom, Vector2.ZERO)
	assert_near(m.cargo_vel.y, 0.0, 0.01, "resting contact has no bounce (no jitter)")


func test_frontal_bonk_stuns_courier() -> void:
	var m := _model()
	m.courier_vel = Vector2(300, 0)
	m.apply_courier_contact(Vector2.LEFT, Vector2.ZERO)
	assert_lt(m.courier_vel.x, 0.0, "courier bounces back from a wall")
	assert_gt(m.stun_time, 0.0, "courier is briefly stunned")
