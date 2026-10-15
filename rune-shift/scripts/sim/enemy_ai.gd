class_name EnemyAI
extends RefCounted
## Behaviour of each enemy archetype. Every attack has a visible warning
## (telegraph) with its direction locked at the start, so the player can
## always read it and step out of the line.


static func update(w: CombatWorld, e: Enemy, dt: float) -> void:
	e.anim += dt
	e.flash = maxf(0.0, e.flash - dt * 6.0)
	e.cooldown -= dt
	match e.kind:
		"crawler": _crawler(w, e, dt)
		"archer": _archer(w, e, dt)
		"charger": _charger(w, e, dt)
		"guardian": _guardian(w, e, dt)
		"boss": BossAI.update(w, e, dt)


static func contact_damage(e: Enemy) -> float:
	if e.kind == "charger" and e.state == "dash":
		return float(e.def.get("dash_damage", 14)) * (e.contact / float(e.def["contact"]))
	if e.is_boss() and e.state == "charge":
		return float(e.def.get("charge_damage", 18))
	return e.contact


static func _walk(w: CombatWorld, e: Enemy, dir: Vector2, dt: float, mult := 1.0) -> void:
	e.vel = dir * e.move_speed() * mult
	e.pos = w.move_circle(e.pos, e.vel * dt, e.radius)


static func _crawler(w: CombatWorld, e: Enemy, dt: float) -> void:
	_walk(w, e, (w.player.pos - e.pos).normalized(), dt)


static func _archer(w: CombatWorld, e: Enemy, dt: float) -> void:
	var to := w.player.pos - e.pos
	var d := to.length()
	var sees := w.can_see(e.pos, w.player.pos)
	match e.state:
		"telegraph":
			e.timer -= dt
			if e.timer <= 0.0:
				w.fire_enemy_shot(e.pos + e.aim * 6.0, e.aim, float(e.def["shot_speed"]), float(e.def["shot_damage"]))
				w.emit({"type": "enemy_shot", "pos": e.pos})
				if e.elite != "":
					for a in [-0.25, 0.25]:
						w.fire_enemy_shot(e.pos, e.aim.rotated(a), float(e.def["shot_speed"]), float(e.def["shot_damage"]))
				e.state = "move"
				e.cooldown = float(e.def["fire_every"]) + w.rng.randf_range(-0.3, 0.3)
		_:
			var dir := Vector2.ZERO
			if w.rage or not sees:
				# No shot from here (or the room ran long): come closer.
				dir = to.normalized()
			elif d < float(e.def["keep_min"]):
				dir = -to.normalized()
			elif d > float(e.def["keep_max"]):
				dir = to.normalized()
			else:
				dir = to.normalized().orthogonal() * (1.0 if e.id % 2 == 0 else -1.0) * 0.6
			_walk(w, e, dir, dt)
			if e.cooldown <= 0.0 and d < 260.0 and sees:
				e.state = "telegraph"
				e.timer = float(e.def["telegraph"])
				e.aim = to.normalized()


static func _charger(w: CombatWorld, e: Enemy, dt: float) -> void:
	var to := w.player.pos - e.pos
	match e.state:
		"telegraph":
			e.timer -= dt
			if e.timer <= 0.0:
				e.state = "dash"
				e.timer = float(e.def["dash_time"])
		"dash":
			e.timer -= dt
			var before := e.pos
			var step := e.aim * float(e.def["dash_speed"]) * dt
			e.pos = w.move_circle(e.pos, step, e.radius)
			# Hitting a wall ends the dash early (and leaves it open to attack).
			if e.timer <= 0.0 or e.pos.distance_to(before) < step.length() * 0.5:
				e.state = "recover"
				e.timer = float(e.def["recover"])
				if e.pos.distance_to(before) < step.length() * 0.5:
					w.emit({"type": "bump", "pos": e.pos})
		"recover":
			e.timer -= dt
			if e.timer <= 0.0:
				e.state = "move"
				e.cooldown = float(e.def["cooldown"])
		_:
			var sees := w.can_see(e.pos, w.player.pos)
			if to.length() > float(e.def["trigger_range"]) * 0.8 or not sees or w.rage:
				_walk(w, e, to.normalized(), dt)
			if e.cooldown <= 0.0 and to.length() < float(e.def["trigger_range"]) and sees:
				e.state = "telegraph"
				e.timer = float(e.def["telegraph"])
				e.aim = to.normalized()


static func _guardian(w: CombatWorld, e: Enemy, dt: float) -> void:
	var to := w.player.pos - e.pos
	if e.state == "broken":
		# Guard broken: stunned for a moment, shield down.
		e.timer -= dt
		if e.timer <= 0.0:
			e.state = "move"
		return
	var target_angle := to.angle()
	var turn := float(e.def["turn_speed"]) * dt * (1.0 - (e.slow_amount if e.slow_time > 0.0 else 0.0))
	e.facing = rotate_toward(e.facing, target_angle, turn)
	_walk(w, e, to.normalized(), dt)
