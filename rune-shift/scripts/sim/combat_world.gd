class_name CombatWorld
extends RefCounted
## Deterministic combat simulation of one room. No nodes: it runs headless at
## any speed (tests, balancing bot) and the view only reads its state.
## Fixed order each step: player -> spell -> spawns -> enemy AI -> statuses ->
## projectiles -> separation -> contact damage -> cleanup.

const ARENA_MARGIN := 4.0

var db: GameDB
var rng := RandomNumberGenerator.new()
var time := 0.0
var arena := Rect2(0, 0, 336, 480)
var obstacles: Array[Rect2] = []
var player := PlayerBody.new()
var spell: Spell
var enemies: Array[Enemy] = []
var projectiles: Array[Projectile] = []
var pending_spawns: Array[Dictionary] = []   ## {kind, elite, pos, t, total}
var events: Array[Dictionary] = []           ## drained by the view each frame
var invulnerable := false                    ## tests and tools only
var hp_scale := 1.0                          ## difficulty ramp (set per room)
var rage := false                            ## safety net: long rooms make enemies come to you
var stats := {"damage_taken": 0.0, "hits_taken": 0, "kills": 0, "last_hit_by": ""}
var _next_id := 1


func setup(seed_value: int, the_spell: Spell, room_obstacles: Array, database: GameDB = null) -> void:
	db = database if database else GameDB.get_db()
	rng.seed = seed_value
	spell = the_spell
	var a: Array = db.rooms.get("arena", [336, 480])
	arena = Rect2(0, 0, a[0], a[1])
	obstacles.clear()
	for o in room_obstacles:
		obstacles.append(Rect2(o[0], o[1], o[2], o[3]))
	var pd: Dictionary = db.enemies["player"]
	player.radius = pd["radius"]
	player.base_speed = pd["speed"]
	player.iframe_time = pd["iframes"]
	var start: Array = db.rooms.get("player_start", [168, 420])
	player.pos = Vector2(start[0], start[1])


func emit(ev: Dictionary) -> void:
	ev["t"] = time
	events.append(ev)
	if events.size() > 400:
		events.pop_front()


# ------------------------------------------------------------------ step ----

func step(dt: float, move: Vector2) -> void:
	time += dt
	_move_player(dt, move)
	if not player.is_dead():
		spell.update(dt, self)
	_update_spawns(dt)
	for e in enemies:
		if e.alive:
			EnemyAI.update(self, e, dt)
	_update_statuses(dt)
	_update_projectiles(dt)
	_separate_enemies()
	_contact_damage()
	_cleanup()


func _move_player(dt: float, move: Vector2) -> void:
	player.iframes = maxf(0.0, player.iframes - dt)
	player.hurt_flash = maxf(0.0, player.hurt_flash - dt)
	if player.is_dead():
		player.moving = false
		return
	var m := move.limit_length(1.0)
	player.moving = m.length() > 0.05
	if player.moving and spell.form != "orb" and spell.form != "cone":
		player.facing = m.normalized()
	player.pos = move_circle(player.pos, m * player.speed() * dt, player.radius)


# ------------------------------------------------------------- geometry ----

## Moves a circle and pushes it out of walls and obstacles (slides along them).
func move_circle(pos: Vector2, delta: Vector2, r: float) -> Vector2:
	var p := pos + delta
	for i in 2:
		for o in obstacles:
			p = _push_out(p, r, o)
	p.x = clampf(p.x, arena.position.x + r + ARENA_MARGIN, arena.end.x - r - ARENA_MARGIN)
	p.y = clampf(p.y, arena.position.y + r + ARENA_MARGIN, arena.end.y - r - ARENA_MARGIN)
	return p


static func _push_out(p: Vector2, r: float, o: Rect2) -> Vector2:
	var closest := Vector2(clampf(p.x, o.position.x, o.end.x), clampf(p.y, o.position.y, o.end.y))
	var d := p - closest
	var dist := d.length()
	if dist >= r:
		return p
	if dist > 0.0001:
		return closest + d / dist * r
	# Centre inside the rectangle: leave by the nearest side.
	var left := p.x - o.position.x
	var right := o.end.x - p.x
	var top := p.y - o.position.y
	var bottom := o.end.y - p.y
	var m := minf(minf(left, right), minf(top, bottom))
	if m == left:
		return Vector2(o.position.x - r, p.y)
	if m == right:
		return Vector2(o.end.x + r, p.y)
	if m == top:
		return Vector2(p.x, o.position.y - r)
	return Vector2(p.x, o.end.y + r)


func blocked_point(p: Vector2, r := 0.0) -> bool:
	if not arena.grow(-r).has_point(p):
		return true
	for o in obstacles:
		if o.grow(r).has_point(p):
			return true
	return false


## True if the segment a-b crosses an obstacle (grown by r). Line of sight.
func segment_blocked(a: Vector2, b: Vector2, r := 0.0) -> bool:
	for o in obstacles:
		if _segment_hits_rect(a, b, o.grow(r)):
			return true
	return false


static func _segment_hits_rect(a: Vector2, b: Vector2, rect: Rect2) -> bool:
	# Liang-Barsky clipping, unrolled (no allocations: this runs very often).
	var dx := b.x - a.x
	var dy := b.y - a.y
	var t0 := 0.0
	var t1 := 1.0
	var r := _clip(-dx, a.x - rect.position.x, t0, t1)
	if r.x > r.y: return false
	r = _clip(dx, rect.end.x - a.x, r.x, r.y)
	if r.x > r.y: return false
	r = _clip(-dy, a.y - rect.position.y, r.x, r.y)
	if r.x > r.y: return false
	r = _clip(dy, rect.end.y - a.y, r.x, r.y)
	return r.x <= r.y


static func _clip(p: float, q: float, t0: float, t1: float) -> Vector2:
	if absf(p) < 0.000001:
		return Vector2(t0, t1) if q >= 0.0 else Vector2(1.0, 0.0)
	var t := q / p
	if p < 0.0:
		return Vector2(maxf(t0, t), t1)
	return Vector2(t0, minf(t1, t))


func can_see(a: Vector2, b: Vector2) -> bool:
	return not segment_blocked(a, b)


## Distance from p to the arena wall or first obstacle along dir (for telegraphs).
func ray_length(p: Vector2, dir: Vector2, max_len := 600.0, step := 4.0) -> float:
	var d := 0.0
	while d < max_len:
		if blocked_point(p + dir * d):
			return d
		d += step
	return max_len


# --------------------------------------------------------------- enemies ----

func alive_enemies() -> Array[Enemy]:
	var out: Array[Enemy] = []
	for e in enemies:
		if e.alive:
			out.append(e)
	return out


func alive_count() -> int:
	var n := 0
	for e in enemies:
		if e.alive:
			n += 1
	return n


func has_targets() -> bool:
	return alive_count() > 0


## Targeting rule (configurable in enemies.json "targeting"): the closest enemy,
## with bonuses for immediate threats (telegraphing, or very close).
func pick_target(max_range: float) -> Enemy:
	var cfg: Dictionary = db.enemies.get("targeting", {})
	var best: Enemy = null
	var best_score := INF
	for e in enemies:
		if not e.alive:
			continue
		var d := e.pos.distance_to(player.pos) - e.radius
		if d > max_range:
			continue
		var score := d
		if not can_see(player.pos, e.pos):
			score += 90.0  # prefer enemies the spell can actually reach
		if e.is_telegraphing():
			score -= float(cfg.get("telegraph_bonus", 45))
		if d < float(cfg.get("close_distance", 44)):
			score -= float(cfg.get("close_bonus", 30))
		if score < best_score:
			best_score = score
			best = e
	return best


func nearest_enemy(p: Vector2, max_dist: float, exclude: Enemy = null) -> Enemy:
	var best: Enemy = null
	var bd := max_dist
	for e in enemies:
		if e.alive and e != exclude:
			var d := e.pos.distance_to(p)
			if d <= bd:
				bd = d
				best = e
	return best


func make_enemy(kind: String, elite := "") -> Enemy:
	var d: Dictionary = db.enemies[kind]
	var e := Enemy.new()
	e.id = _next_id
	_next_id += 1
	e.kind = kind
	e.def = d
	e.hp = float(d["hp"])
	e.speed = float(d["speed"])
	e.radius = float(d["radius"])
	e.contact = float(d["contact"])
	e.cooldown = rng.randf_range(0.6, 1.4)
	if elite != "":
		var el: Dictionary = db.enemies["elites"][elite]
		e.elite = elite
		e.hp *= float(el["hp_mult"])
		e.speed *= float(el["speed_mult"])
		e.contact *= float(el["contact_mult"])
		e.radius *= float(el["size_mult"])
	if kind != "boss":
		e.hp *= hp_scale
	e.max_hp = e.hp
	return e


func spawn_enemy(kind: String, pos: Vector2, elite := "") -> Enemy:
	var e := make_enemy(kind, elite)
	e.pos = pos
	e.facing = (player.pos - pos).angle()
	enemies.append(e)
	emit({"type": "spawn", "pos": pos, "kind": kind})
	return e


## Enemies appear after a visible warning (fairness: no surprise spawns).
func queue_spawn(kind: String, elite := "", delay := 0.9) -> void:
	var pos := find_spawn_point(float(db.enemies[kind]["radius"]) + 4.0)
	pending_spawns.append({"kind": kind, "elite": elite, "pos": pos, "t": delay, "total": delay})


func find_spawn_point(r: float) -> Vector2:
	for attempt in 60:
		var p := Vector2(rng.randf_range(arena.position.x + 24, arena.end.x - 24),
				rng.randf_range(arena.position.y + 24, arena.end.y - 24))
		if blocked_point(p, r):
			continue
		if p.distance_to(player.pos) < 130.0:
			continue
		var clash := false
		for s in pending_spawns:
			if s["pos"].distance_to(p) < 22.0:
				clash = true
				break
		if not clash:
			return p
	# Fallback: the far side of the arena from the player.
	return Vector2(arena.get_center().x, arena.position.y + 40 if player.pos.y > arena.get_center().y else arena.end.y - 40)


func _update_spawns(dt: float) -> void:
	for i in range(pending_spawns.size() - 1, -1, -1):
		pending_spawns[i]["t"] -= dt
		if pending_spawns[i]["t"] <= 0.0:
			var s: Dictionary = pending_spawns[i]
			pending_spawns.remove_at(i)
			spawn_enemy(s["kind"], s["pos"], s["elite"])


# ---------------------------------------------------------------- damage ----

## A hit from the spell. Guardians block blockable hits coming from their front.
## Returns true if the hit landed.
func hit_enemy(e: Enemy, amount: float, source: Dictionary, from: Vector2) -> bool:
	if not e.alive:
		return false
	if e.kind == "guardian" and e.state != "broken" and source.get("blockable", false) and _shield_blocks(e, from):
		spell.stats["blocked"] += 1
		e.blocks += 1
		emit({"type": "block", "pos": e.pos + Vector2.from_angle(e.facing) * e.radius})
		# Persistence also works, just slower than flanking: the shield breaks.
		if e.blocks >= int(e.def.get("guard_break_hits", 6)):
			e.blocks = 0
			e.state = "broken"
			e.timer = float(e.def.get("guard_break_time", 1.8))
			emit({"type": "guard_break", "pos": e.pos})
		return false
	damage_enemy(e, amount, source)
	spell.on_hit(self, e, source)
	return true


func _shield_blocks(e: Enemy, from: Vector2) -> bool:
	var to_src := from - e.pos
	if to_src.length() < 0.001:
		return false
	var half := deg_to_rad(float(e.def.get("shield_arc_deg", 120))) * 0.5
	return absf(angle_difference(e.facing, to_src.angle())) <= half


## Raw damage (no element/catalyst side effects except Rupture on kill).
func damage_enemy(e: Enemy, amount: float, source: Dictionary) -> void:
	if not e.alive or amount <= 0.0:
		return
	# Ice: frozen enemies take extra damage from everything.
	if spell.element == "ice" and e.slow_time > 0.0:
		amount *= 1.0 + float(spell.ep("vulnerability", 0.25)) * spell.element_mult
	e.hp -= amount
	e.flash = 1.0
	spell.stats["damage"] += amount
	emit({"type": "hit", "pos": e.pos, "amount": amount, "kind": source.get("kind", ""), "boss": e.is_boss()})
	if e.hp <= 0.0:
		e.alive = false
		stats["kills"] += 1
		emit({"type": "kill", "pos": e.pos, "kind": e.kind, "elite": e.elite})
		spell.on_kill(self, e, source)


func hurt_player(amount: float, by: String) -> void:
	if player.iframes > 0.0 or invulnerable or player.is_dead():
		return
	player.hp = maxf(0.0, player.hp - amount)
	player.iframes = player.iframe_time
	player.hurt_flash = 0.25
	stats["damage_taken"] += amount
	stats["hits_taken"] += 1
	stats["last_hit_by"] = by
	emit({"type": "player_hit", "pos": player.pos, "amount": amount, "by": by})
	if player.is_dead():
		emit({"type": "player_dead", "pos": player.pos, "by": by})


# -------------------------------------------------------------- statuses ----

func _update_statuses(dt: float) -> void:
	for e in enemies:
		if not e.alive:
			continue
		if e.slow_time > 0.0:
			e.slow_time -= dt
			if e.slow_time <= 0.0:
				e.slow_amount = 0.0
		if e.burn_stacks > 0:
			RuneElements.tick_burn(spell, self, e, dt)


# ----------------------------------------------------------- projectiles ----

func _update_projectiles(dt: float) -> void:
	for p in projectiles:
		if not p.alive:
			continue
		p.ttl -= dt
		p.pos += p.vel * dt
		if p.ttl <= 0.0 or blocked_point(p.pos):
			p.alive = false
			if p.ttl > 0.0:
				emit({"type": "fizzle", "pos": p.pos, "team": p.team})
			continue
		if p.team == "player":
			for e in enemies:
				if e.alive and not p.hit_ids.has(e.id) and p.pos.distance_to(e.pos) <= p.radius + e.radius:
					p.hit_ids[e.id] = true
					hit_enemy(e, p.damage, p.source, p.pos - p.vel.normalized() * 4.0)
					if p.pierce <= 0:
						p.alive = false
						break
					p.pierce -= 1
		elif p.pos.distance_to(player.pos) <= p.radius + player.radius:
			p.alive = false
			hurt_player(p.damage, p.kind)


func fire_enemy_shot(from: Vector2, dir: Vector2, speed: float, dmg: float, kind := "arrow", r := 3.0) -> void:
	var p := Projectile.new()
	p.pos = from
	p.vel = dir.normalized() * speed
	p.radius = r
	p.team = "enemy"
	p.damage = dmg
	p.ttl = 6.0
	p.kind = kind
	projectiles.append(p)


# ----------------------------------------------------- crowd and contact ----

func _separate_enemies() -> void:
	var list := alive_enemies()
	for i in list.size():
		for j in range(i + 1, list.size()):
			var a := list[i]
			var b := list[j]
			var d := b.pos - a.pos
			var min_d := a.radius + b.radius
			var dist := d.length()
			if dist < min_d and dist > 0.001:
				var push := d / dist * (min_d - dist) * 0.5
				if a.is_boss():
					b.pos = move_circle(b.pos, push * 2.0, b.radius)
				elif b.is_boss():
					a.pos = move_circle(a.pos, -push * 2.0, a.radius)
				else:
					a.pos = move_circle(a.pos, -push, a.radius)
					b.pos = move_circle(b.pos, push, b.radius)


func _contact_damage() -> void:
	for e in enemies:
		if e.alive and e.pos.distance_to(player.pos) <= e.radius + player.radius - 1.0:
			hurt_player(EnemyAI.contact_damage(e), e.kind)


func _cleanup() -> void:
	var keep: Array[Projectile] = []
	for p in projectiles:
		if p.alive:
			keep.append(p)
	projectiles = keep
	var alive_list: Array[Enemy] = []
	for e in enemies:
		if e.alive:
			alive_list.append(e)
	enemies = alive_list
