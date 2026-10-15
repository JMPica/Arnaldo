extends TestCase
## The real rig (move_and_collide) against real level geometry.


func _world(obstacles: Array) -> LevelWorld:
	var errors: Array[String] = []
	var lv := LevelData.from_dict({"id": "t", "name": "T", "cargo": "glass_box", "cruise_speed": 250,
		"delivery": {"x": 6000, "top": 500}, "autopilot_path": [[0, 300], [6000, 300]],
		"obstacles": obstacles}, game_data().world, game_data().obstacle_types, errors)
	assert_eq(errors.size(), 0, "test level valid")
	var w := LevelWorld.new()
	add_child(w)
	w.build(lv, game_data())
	return w


func _rig(cargo_id: String, start: Vector2) -> CourierRig:
	var rig := CourierRig.new()
	add_child(rig)
	rig.setup(flight(), cargo(cargo_id), start)
	rig.simulate = true
	return rig


func _step(rig: CourierRig, seconds: float, thrust_fn: Callable, speed := 250.0) -> void:
	var t := 0.0
	while t < seconds:
		rig.thrusting = thrust_fn.call(rig)
		rig.target_speed = speed
		rig.physics_step(1.0 / 60.0)
		await get_tree().physics_frame
		t += 1.0 / 60.0


func test_cargo_hitting_a_wall_takes_damage_with_named_source() -> void:
	var w := _world([{"type": "building", "x": 700, "width": 200, "height": 260}])
	var rig := _rig("glass_box", Vector2(300, 300))
	var hits := []
	rig.cargo_impact.connect(func(_p, speed, dmg, label): hits.append([speed, dmg, label]))
	# Hold altitude at 300: the courier clears the roof (390) but the box does not.
	await _step(rig, 3.0, func(r): return r.model.courier_vel.y > 0.0 and r.model.courier_pos.y > 300.0)
	assert_lt(rig.integrity.value, 100.0, "glass box damaged by the building")
	assert_gt(hits.size(), 0.0, "impact reported")
	if hits.size() > 0:
		assert_eq(hits[0][2], "a building", "impact names the obstacle")
	w.queue_free()
	rig.queue_free()


func test_resting_on_the_ground_causes_no_damage() -> void:
	var w := _world([])
	# The box starts resting on the street; the courier drops down next to it.
	var ground := float(game_data().world["ground_y"])
	var rig := _rig("glass_box", Vector2(300, ground - 155))
	await _step(rig, 4.0, func(_r): return false, 0.0)
	assert_eq(rig.integrity.value, 100.0, "no damage from resting contact (no physics jitter damage)")
	assert_true(rig.courier_on_floor or rig.model.courier_vel.length() < 5.0, "courier settled")
	assert_lt(rig.model.cargo_vel.length(), 5.0, "cargo at rest, not jittering")
	w.queue_free()
	rig.queue_free()


func test_hard_drop_on_ground_damages_glass_more_than_piano() -> void:
	var results := {}
	for id in ["glass_box", "heavy_piano"]:
		var w := _world([])
		var rig := _rig(id, Vector2(300, 150))
		await _step(rig, 2.5, func(_r): return false, 0.0)
		results[id] = 100.0 - rig.integrity.value
		w.queue_free()
		rig.queue_free()
		await get_tree().process_frame
	note("drop from y=150: glass -%.0f%%, piano -%.0f%%" % [results["glass_box"], results["heavy_piano"]])
	assert_gt(results["glass_box"], results["heavy_piano"], "glass is more fragile than the piano")


func test_soft_awning_hurts_less_than_a_roof() -> void:
	var loss := {}
	for kind in ["awning", "building"]:
		var w := _world([{"type": kind, "rect": [200, 470, 400, 30]}])
		var rig := _rig("glass_box", Vector2(400, 150))
		await _step(rig, 2.0, func(_r): return false, 0.0)
		loss[kind] = 100.0 - rig.integrity.value
		w.queue_free()
		rig.queue_free()
		await get_tree().process_frame
	note("drop onto awning -%.0f%%, onto roof -%.0f%%" % [loss["awning"], loss["building"]])
	assert_lt(loss["awning"], loss["building"], "awnings are soft")


func test_courier_bonks_and_does_not_get_stuck_on_walls() -> void:
	var w := _world([{"type": "building", "x": 600, "width": 200, "height": 640}])
	var rig := _rig("heavy_piano", Vector2(300, 300))
	var bonks := [0]
	rig.courier_bonk.connect(func(_p, _s): bonks[0] += 1)
	await _step(rig, 3.0, func(r): return r.model.courier_vel.y > 0.0)
	assert_gt(bonks[0], 0.0, "frontal hit is a readable bonk")
	assert_lt(rig.model.courier_pos.x, 600.0, "courier cannot pass through walls")
	var finite := is_finite(rig.model.courier_pos.x) and is_finite(rig.model.cargo_pos.y)
	assert_true(finite, "simulation stays stable against a wall")
	w.queue_free()
	rig.queue_free()


func test_moving_obstacle_reports_relative_speed() -> void:
	var w := _world([{"type": "drone", "rect": [300, 420, 80, 34], "move": [0, -200], "period": 1.0}])
	var drone: Obstacle = w.movers[0]
	w.advance_movers(0.25, 1.0 / 60.0)
	assert_gt(drone.motion_velocity.length(), 100.0, "mover exposes its velocity")
	w.queue_free()
