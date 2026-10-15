extends SceneTree

const BRAKE := 180.0
## Headless probe used while tuning: prints how each cargo behaves under scripted inputs.
## Run: godot --headless --path . --script res://tools/probe_physics.gd

func _initialize() -> void:
	var tuning: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://data/tuning.json"))
	var cargos: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://data/cargo_types.json"))
	var flight := FlightParams.from_dict(tuning["courier"])
	var dt := 1.0 / 120.0
	for id in cargos.keys():
		var c := CargoType.from_dict(id, cargos[id])
		# 1) Settle at cruise, hovering with a simple servo, measure trail angle.
		var m := RigModel.new(flight, c)
		m.place(Vector2(0, 360))
		var t := 0.0
		while t < 4.0:
			m.step_free(dt, m.courier_vel.y > 0.0, 280.0)
			t += dt
		var trail := m.tilt_degrees()
		# 2) Climb test from settled hover: time to rise 200 px holding thrust.
		var y0 := m.courier_pos.y
		var climb := 0.0
		while m.courier_pos.y > y0 - 200.0 and climb < 5.0:
			m.step_free(dt, true, 280.0)
			climb += dt
		# 2b) "Human" hover: hysteresis band of +-12 px around a target that
		# changes every 1.5 s (how a player holds an altitude with taps).
		var human_tilt := 0.0
		var on := false
		t = 0.0
		var base := m.courier_pos.y
		while t < 6.0:
			var target := base + (60.0 if int(t / 1.5) % 2 == 0 else -60.0)
			if m.courier_pos.y > target + 12.0: on = true
			elif m.courier_pos.y < target - 12.0: on = false
			m.step_free(dt, on, 280.0)
			human_tilt = maxf(human_tilt, absf(m.tilt_degrees()))
			t += dt
		# 3) Max tilt under rapid tapping (0.15 s on / 0.15 s off) for 4 s.
		var max_tilt_tap := 0.0
		var max_rope := 0.0
		t = 0.0
		while t < 4.0:
			m.step_free(dt, fmod(t, 0.3) < 0.15, 280.0)
			max_tilt_tap = maxf(max_tilt_tap, absf(m.tilt_degrees())); max_rope = maxf(max_rope, absf(rad_to_deg(m.rope_angle())))
			t += dt
		# 4) Max tilt for long hold/release cycles (1 s up, 1 s down).
		var max_tilt_cycle := 0.0
		t = 0.0
		while t < 6.0:
			m.step_free(dt, fmod(t, 2.0) < 0.8, 280.0)
			max_tilt_cycle = maxf(max_tilt_cycle, absf(m.tilt_degrees())); max_rope = maxf(max_rope, absf(rad_to_deg(m.rope_angle())))
			t += dt
		# 5) Braking from cruise to 0 (delivery): max tilt.
		var max_tilt_brake := 0.0
		t = 0.0
		var stop_x := m.courier_pos.x + 260.0
		while t < 3.0:
			var dist := maxf(stop_x - m.courier_pos.x, 0.0)
			m.step_free(dt, m.courier_vel.y > 0.0, minf(280.0, sqrt(2.0 * BRAKE * dist)))
			max_tilt_brake = maxf(max_tilt_brake, absf(m.tilt_degrees()))
			t += dt
		print("%-14s trail=%5.1f deg  climb200=%4.2fs  human=%5.1f  tilt_tap=%5.1f  tilt_cycle=%5.1f  tilt_brake=%5.1f  tension=%6.0f rope_max=%5.1f" % [
			id, trail, climb, human_tilt, max_tilt_tap, max_tilt_cycle, max_tilt_brake, m.last_rope_tension, max_rope])
	quit()
