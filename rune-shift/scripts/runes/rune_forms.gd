class_name RuneForms
extends RefCounted
## Form runes: the geometry of the attack. Each form only decides WHERE damage
## lands; what the damage does is up to the element and the catalyst.

const PRIMARY := {"primary": true, "depth": 0, "blockable": true}


## Fires the form once. Returns false when there was nothing to aim at.
static func activate(spell: Spell, world: CombatWorld, is_echo: bool) -> bool:
	var ok := false
	match spell.form:
		"orb": ok = _orb(spell, world)
		"cone": ok = _cone(spell, world)
		"orbit": ok = _orbit_burst(spell, world)
	if ok:
		spell.on_cast(world, is_echo)
	return ok


static func _orb(spell: Spell, world: CombatWorld) -> bool:
	var target := world.pick_target(float(spell.fp("range", 300)))
	if target == null:
		return false
	var origin := world.player.pos
	var dir := (target.pos - origin).normalized()
	world.player.facing = dir
	var n := int(spell.fp("projectiles", 1))
	var spread := deg_to_rad(float(spell.fp("spread_deg", 12)))
	for i in n:
		var a := (i - (n - 1) * 0.5) * spread
		var p := Projectile.new()
		p.pos = origin + dir * 6.0
		p.vel = dir.rotated(a) * float(spell.fp("speed", 240))
		p.radius = float(spell.fp("radius", 4))
		p.team = "player"
		p.damage = spell.form_damage()
		p.pierce = int(spell.fp("pierce", 0))
		p.ttl = 1.6
		p.kind = "orb"
		p.source = PRIMARY.merged({"kind": "orb"})
		world.projectiles.append(p)
	world.emit({"type": "cast", "form": "orb", "pos": origin, "dir": dir})
	return true


static func _cone(spell: Spell, world: CombatWorld) -> bool:
	var target := world.pick_target(float(spell.fp("seek_range", 140)))
	if target == null:
		return false
	var origin := world.player.pos
	var dir := (target.pos - origin).normalized()
	world.player.facing = dir
	var rng_len := float(spell.fp("range", 74))
	var half := deg_to_rad(float(spell.fp("angle_deg", 70))) * 0.5
	var src := PRIMARY.merged({"kind": "cone"})
	for e: Enemy in world.enemies.duplicate():
		if not e.alive:
			continue
		var to := e.pos - origin
		var d := to.length()
		if d - e.radius > rng_len or not world.can_see(origin, e.pos):
			continue
		# Inside the arc, with a little tolerance for the enemy's size.
		var ang := absf(dir.angle_to(to)) if d > 0.001 else 0.0
		var tol := asin(clampf(e.radius / maxf(d, e.radius), 0.0, 1.0))
		if ang <= half + tol:
			world.hit_enemy(e, spell.form_damage(), src, origin)
	world.emit({"type": "cone", "pos": origin, "dir": dir, "range": rng_len, "half": half,
		"element": spell.element})
	return true


## Orbit's "cast": the blades fling outward for a moment (more reach).
static func _orbit_burst(spell: Spell, world: CombatWorld) -> bool:
	spell.orbit_burst = float(spell.fp("burst_time", 0.35))
	world.emit({"type": "cast", "form": "orbit", "pos": world.player.pos})
	return true


## Current blade positions (used by the simulation and the view).
static func orbit_positions(spell: Spell, world: CombatWorld) -> PackedVector2Array:
	var pts := PackedVector2Array()
	var n := int(spell.fp("blades", 3))
	var r := float(spell.fp("orbit_radius", 34))
	if spell.orbit_burst > 0.0:
		var bt := float(spell.fp("burst_time", 0.35))
		var k := sin(PI * clampf(1.0 - spell.orbit_burst / bt, 0.0, 1.0))
		r = lerpf(r, float(spell.fp("burst_radius", 64)), k)
	for i in n:
		pts.append(world.player.pos + Vector2.from_angle(spell.orbit_angle + TAU * i / n) * r)
	return pts


static func orbit_tick(spell: Spell, world: CombatWorld, dt: float) -> void:
	spell.orbit_angle = wrapf(spell.orbit_angle + float(spell.fp("spin", 3.4)) * dt, 0.0, TAU)
	spell.orbit_burst = maxf(0.0, spell.orbit_burst - dt)
	var blades := orbit_positions(spell, world)
	var br := float(spell.fp("blade_radius", 6))
	var interval := float(spell.fp("hit_interval", 0.4))
	var src := PRIMARY.merged({"kind": "orbit"})
	for i in blades.size():
		for e: Enemy in world.enemies.duplicate():
			if not e.alive:
				continue
			if blades[i].distance_to(e.pos) <= br + e.radius:
				var last: float = e.orbit_hit.get(i, -100.0)
				if world.time - last >= interval:
					e.orbit_hit[i] = world.time
					world.hit_enemy(e, spell.form_damage(), src, blades[i])
