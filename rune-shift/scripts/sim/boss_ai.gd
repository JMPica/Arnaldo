class_name BossAI
extends RefCounted
## "El Guardián de los Sellos". Two patterns, always announced:
##   radial: runes glow, then a ring of projectiles with safe gaps
##   charge: a marked lane on the floor, then a straight charge to the wall
## Phase 2 (below 50% HP): double rings with shifted gaps, and a ring right
## after each charge. Warnings keep their length: more intensity, same fairness.


static func update(w: CombatWorld, e: Enemy, dt: float) -> void:
	var d := e.def
	if e.phase == 1 and e.hp <= e.max_hp * 0.5:
		e.phase = 2
		w.emit({"type": "boss_phase", "pos": e.pos})
	match e.state:
		"intro":
			e.timer -= dt
			if e.timer <= 0.0:
				e.state = "idle"
				e.timer = 0.6
		"idle":
			e.timer -= dt
			var home := Vector2(w.arena.get_center().x, w.arena.position.y + 150)
			var to := w.player.pos - e.pos
			var wander := (home - e.pos) * 0.5 + to.normalized() * 30.0
			e.vel = wander.limit_length(1.0) * e.move_speed()
			e.pos = w.move_circle(e.pos, e.vel * dt, e.radius)
			e.facing = to.angle()
			if e.timer <= 0.0:
				_next_pattern(w, e)
		"radial_telegraph":
			e.timer -= dt
			if e.timer <= 0.0:
				_fire_ring(w, e, float(e.pattern_index) * 0.37)
				if e.phase == 2:
					e.state = "radial_second"
					e.timer = 0.45
				else:
					_to_idle(e)
		"radial_second":
			e.timer -= dt
			if e.timer <= 0.0:
				_fire_ring(w, e, float(e.pattern_index) * 0.37 + PI / float(d["radial_count"]))
				_to_idle(e)
		"charge_telegraph":
			e.timer -= dt
			if e.timer <= 0.0:
				e.state = "charge"
				e.timer = 1.6
		"charge":
			e.timer -= dt
			var before := e.pos
			var step := e.aim * float(d["charge_speed"]) * dt
			e.pos = w.move_circle(e.pos, step, e.radius)
			if e.timer <= 0.0 or e.pos.distance_to(before) < step.length() * 0.5:
				w.emit({"type": "boss_slam", "pos": e.pos})
				e.state = "recover"
				e.timer = float(d["charge_recover"])
		"recover":
			e.timer -= dt
			if e.timer <= 0.0:
				if e.phase == 2:
					e.state = "radial_telegraph"
					e.timer = float(d["radial_telegraph"])
					e.pattern_index += 1
				else:
					_to_idle(e)


static func start(e: Enemy) -> void:
	e.state = "intro"
	e.timer = 1.2


static func _to_idle(e: Enemy) -> void:
	e.state = "idle"
	var pauses: Array = e.def["pattern_pause"]
	e.timer = float(pauses[0] if e.phase == 1 else pauses[1])


static func _next_pattern(w: CombatWorld, e: Enemy) -> void:
	e.pattern_index += 1
	if e.pattern_index % 2 == 1:
		e.state = "radial_telegraph"
		e.timer = float(e.def["radial_telegraph"])
	else:
		e.state = "charge_telegraph"
		e.timer = float(e.def["charge_telegraph"])
		e.aim = (w.player.pos - e.pos).normalized()


## Ring of projectiles with `radial_gaps` safe openings (2 missing shots each).
static func _fire_ring(w: CombatWorld, e: Enemy, offset: float) -> void:
	var n := int(e.def["radial_count"])
	var gaps := int(e.def["radial_gaps"])
	var skip := {}
	for g in gaps:
		var start := int(round(float(g) * n / gaps)) + (e.pattern_index % 3)
		skip[start % n] = true
		skip[(start + 1) % n] = true
	for i in n:
		if skip.has(i):
			continue
		var dir := Vector2.from_angle(offset + TAU * i / n)
		w.fire_enemy_shot(e.pos + dir * e.radius, dir, float(e.def["radial_speed"]), float(e.def["radial_damage"]), "boss", 4.0)
	w.emit({"type": "boss_ring", "pos": e.pos})
