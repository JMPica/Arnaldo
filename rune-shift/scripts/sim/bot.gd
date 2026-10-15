class_name Bot
extends RefCounted
## A simple player bot for automated tests and balancing. It only produces a
## movement direction (like the joystick) and picks forge cards. It is not
## meant to play well, just plausibly: it kites, dodges marked danger and keeps
## the distance its spell form wants.

var skill := 1.0             ## 0..1: how much it reacts to projectiles and telegraphs
var rng := RandomNumberGenerator.new()
var preferred: Dictionary = {}   ## family -> rune id it will pick when offered
var _wander := Vector2.ZERO
var _wander_t := 0.0


func _init(seed_v := 7, skill_level := 1.0) -> void:
	rng.seed = seed_v
	skill = skill_level


func move(w: CombatWorld, dt: float) -> Vector2:
	var p := w.player.pos
	var push := Vector2.ZERO
	var want: float = {"orb": 120.0, "cone": 48.0, "orbit": 30.0}.get(w.spell.form, 100.0)
	var nearest: Enemy = w.nearest_enemy(p, 9999.0)
	for e in w.enemies:
		if not e.alive:
			continue
		var to := p - e.pos
		var d := maxf(to.length(), 1.0)
		var danger := e.radius + 26.0
		if e.state == "dash" or e.state == "charge":
			danger += 40.0
		if d < danger + want * 0.4:
			push += to / d * (danger + want * 0.4 - d) / 20.0
		# Step out of announced charge lanes.
		if skill > 0.3 and (e.state == "telegraph" or e.state == "charge_telegraph") and e.kind != "archer":
			var along := (p - e.pos).dot(e.aim)
			if along > 0.0:
				var off := (p - e.pos) - e.aim * along
				if off.length() < e.radius + 18.0:
					push += (off.normalized() if off.length() > 0.1 else e.aim.orthogonal()) * 2.5 * skill
		# Flank guardians: circle around them while their shield faces us.
		if e.kind == "guardian" and e.state != "broken" and d < 170.0:
			var in_front := absf(angle_difference(e.facing, (p - e.pos).angle())) < deg_to_rad(70.0)
			if in_front:
				var tangent := to.orthogonal().normalized()
				if angle_difference(e.facing, to.angle()) < 0.0:
					tangent = -tangent
				push += tangent * 1.3 * skill
	if nearest:
		var d2 := p.distance_to(nearest.pos)
		if d2 > want or not w.can_see(p, nearest.pos):
			push += (_waypoint(w, p, nearest.pos) - p).normalized() * 0.9
	# Dodge incoming enemy projectiles.
	for pr in w.projectiles:
		if pr.team != "enemy":
			continue
		var rel := p - pr.pos
		var closing := -rel.dot(pr.vel.normalized())
		if closing < -4.0 and rel.length() < 90.0:
			var side := rel - pr.vel.normalized() * rel.dot(pr.vel.normalized())
			if side.length() < 16.0:
				push += (side.normalized() if side.length() > 0.1 else pr.vel.orthogonal().normalized()) * 2.0 * skill
	# Stay away from walls and wander a little.
	var c := w.arena.get_center()
	push += (c - p) / 260.0
	_wander_t -= dt
	if _wander_t <= 0.0:
		_wander_t = rng.randf_range(0.6, 1.4)
		_wander = Vector2.from_angle(rng.randf() * TAU) * 0.35
	push += _wander
	return push.limit_length(1.0)


## Walk around obstacles: aim for the most useful visible corner.
func _waypoint(w: CombatWorld, from: Vector2, to: Vector2) -> Vector2:
	if not w.segment_blocked(from, to, 6.0):
		return to
	var best := to
	var best_len := INF
	for o in w.obstacles:
		var g := o.grow(14.0)
		for c: Vector2 in [g.position, Vector2(g.end.x, g.position.y), g.end, Vector2(g.position.x, g.end.y)]:
			if not w.arena.grow(-8.0).has_point(c):
				continue
			if w.segment_blocked(from, c, 4.0):
				continue
			var l := from.distance_to(c) + c.distance_to(to) + (0.0 if not w.segment_blocked(c, to, 4.0) else 200.0)
			if l < best_len:
				best_len = l
				best = c
	return best


func choose(offers: Array) -> int:
	for i in offers.size():
		var c: Dictionary = offers[i]
		if c["type"] == "rune" and preferred.get(c["family"], "") == c["id"]:
			return i
	for i in offers.size():
		if offers[i]["type"] == "upgrade":
			return i
	for i in offers.size():
		if offers[i]["type"] == "heal":
			return i
	for i in offers.size():
		if offers[i]["type"] != "rune" and offers[i]["type"] != "challenge":
			return i
	return rng.randi() % offers.size()


## Plays a whole run headless. Returns a summary dictionary.
static func play_run(seed_v: int, prefs: Dictionary, skill_level := 1.0, max_seconds := 1200.0) -> Dictionary:
	var s := RunSession.new()
	s.start(seed_v)
	var bot := Bot.new(seed_v, skill_level)
	bot.preferred = prefs
	var dt := 1.0 / 60.0
	var t := 0.0
	while not s.is_over() and t < max_seconds:
		if s.phase == RunSession.Phase.REWARD:
			s.choose(bot.choose(s.offers))
			continue
		var mv := bot.move(s.world, dt) if s.phase == RunSession.Phase.COMBAT else Vector2.ZERO
		s.step(dt, mv)
		t += dt
	return {
		"victory": s.phase == RunSession.Phase.VICTORY,
		"rooms_cleared": s.room_seconds.size(),
		"room_seconds": s.room_seconds,
		"run_seconds": s.run.time,
		"combo": s.run.spell.combo_key(),
		"name": s.run.spell.display_name(),
		"hp": s.run.hp,
		"fragments": s.run.fragments,
		"died_in_room": -1 if s.phase == RunSession.Phase.VICTORY else s.run.room_index + 1,
		"killed_by": s.world.stats["last_hit_by"],
		"damage_taken": s.run.damage_taken + s.world.stats["damage_taken"],
	}
