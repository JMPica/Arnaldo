class_name ArenaView
extends Node2D
## Draws one room of the simulation. Read-only: it never changes the world.
## Readability rules (GDD section 12): enemy projectiles and danger telegraphs
## are drawn ABOVE spell effects and particles, with dark outlines.

const SCALE := 2.0                 ## sprites are authored at 12 px, shown at 24 px
const ELEMENT_COLORS := {"": Color("c9a6ff"), "fire": Color("ff8a3d"), "ice": Color("7fd8ff"), "storm": Color("ffe14d")}

var session: RunSession
var shake := 0.0
var _particles: Array[Dictionary] = []
var _flashes: Array[Dictionary] = []     ## short-lived shapes: cones, rings, bolts
var _texts: Array[Dictionary] = []
var _t := 0.0
var _floor: Texture2D
var _floor_key := ""
var _shake_offset := Vector2.ZERO

signal world_event(ev: Dictionary)


func _process(delta: float) -> void:
	_t += delta
	if session == null or session.world == null:
		return
	var w := session.world
	var key := "%d|%s" % [session.run.room_index, session.template_id]
	if key != _floor_key:
		_floor_key = key
		_floor = PixelArt.floor_texture(Vector2i(int(w.arena.size.x), int(w.arena.size.y)), session.run.seed_value + session.run.room_index * 13)
		_particles.clear()
		_flashes.clear()
		_texts.clear()
	for ev in w.events:
		_on_event(ev)
		world_event.emit(ev)
	w.events.clear()
	_update_fx(delta)
	shake = maxf(0.0, shake - delta * 18.0)
	_shake_offset = Vector2(randf_range(-1, 1), randf_range(-1, 1)) * shake if shake > 0.2 else Vector2.ZERO
	queue_redraw()


# ------------------------------------------------------------------ events --

func _on_event(ev: Dictionary) -> void:
	var el: String = session.run.spell.element
	match ev["type"]:
		"hit":
			var c: Color = ELEMENT_COLORS.get(el, ELEMENT_COLORS[""])
			if ev.get("kind", "") == "burn":
				c = ELEMENT_COLORS["fire"]
			_burst(ev["pos"], c, 3, 40.0)
		"kill":
			_burst(ev["pos"], Color("8a8fa8"), 10, 70.0)
			_burst(ev["pos"], ELEMENT_COLORS.get(el, ELEMENT_COLORS[""]), 6, 50.0)
			shake = maxf(shake, 0.6)
		"cone":
			_flashes.append({"kind": "cone", "pos": ev["pos"], "dir": ev["dir"], "range": ev["range"],
				"half": ev["half"], "life": 0.16, "max": 0.16, "color": ELEMENT_COLORS.get(ev.get("element", ""), ELEMENT_COLORS[""])})
		"explosion":
			_flashes.append({"kind": "ring", "pos": ev["pos"], "radius": ev["radius"], "life": 0.3, "max": 0.3,
				"color": ELEMENT_COLORS.get(ev.get("element", ""), Color("ff8a3d"))})
			_burst(ev["pos"], Color("ffc36b"), 12, 90.0)
			shake = maxf(shake, 1.5)
			_text(ev["pos"], "¡Ruptura!", Color("ffc36b"))
		"discharge":
			_flashes.append({"kind": "bolt", "pos": ev["pos"], "to": ev["to"], "life": 0.18, "max": 0.18, "color": ELEMENT_COLORS["storm"]})
			_burst(ev["pos"], ELEMENT_COLORS["storm"], 8, 70.0)
		"block":
			_burst(ev["pos"], Color("d6f4ff"), 4, 50.0)
		"guard_break":
			_burst(ev["pos"], Color("9db7d1"), 12, 80.0)
			_text(ev["pos"] + Vector2(0, -14), "¡Guardia rota!", Color("d6f4ff"))
		"player_hit":
			shake = maxf(shake, 3.0)
			_burst(ev["pos"], Color("ff5a4e"), 8, 70.0)
		"player_dead":
			_burst(ev["pos"], Color("c9a6ff"), 24, 110.0)
		"boss_slam":
			shake = maxf(shake, 4.0)
			_burst(ev["pos"], Color("8a8fa8"), 16, 100.0)
		"boss_phase":
			shake = maxf(shake, 3.0)
			_text(ev["pos"] + Vector2(0, -34), "¡El sello se agrieta!", Color("ff5a4e"))
		"rage":
			_text(session.world.arena.get_center(), "¡Los enemigos se enfurecen!", Color("ff5a4e"))
		"spawn":
			_burst(ev["pos"], Color("7e4fc2"), 8, 50.0)


func _burst(pos: Vector2, color: Color, n: int, speed: float) -> void:
	if _particles.size() > 220:
		return
	for i in n:
		_particles.append({"pos": pos, "vel": Vector2.from_angle(randf() * TAU) * randf_range(speed * 0.3, speed),
			"life": randf_range(0.25, 0.55), "max": 0.55, "color": color})


func _text(pos: Vector2, s: String, color: Color) -> void:
	_texts.append({"pos": pos, "text": s, "color": color, "life": 1.1, "max": 1.1})


func _update_fx(dt: float) -> void:
	for p in _particles:
		p["life"] -= dt
		p["pos"] += p["vel"] * dt
		p["vel"] *= 0.9
	_particles = _particles.filter(func(p): return p["life"] > 0.0)
	for f in _flashes:
		f["life"] -= dt
	_flashes = _flashes.filter(func(f): return f["life"] > 0.0)
	for t in _texts:
		t["life"] -= dt
		t["pos"] += Vector2(0, -14) * dt
	_texts = _texts.filter(func(t): return t["life"] > 0.0)


# ----------------------------------------------------------------- drawing --

func _draw() -> void:
	if session == null or session.world == null:
		return
	var w := session.world
	draw_set_transform(_shake_offset)
	_draw_room(w)
	_draw_spawns(w)
	for e in w.enemies:
		_draw_shadow(e.pos, e.radius)
	_draw_shadow(w.player.pos, w.player.radius)
	_draw_spell_effects(w)
	for e in w.enemies:
		_draw_enemy(e)
	_draw_player(w)
	_draw_player_projectiles(w)
	for p in _particles:
		var a := clampf(p["life"] / p["max"], 0.0, 1.0)
		draw_rect(Rect2(p["pos"].round(), Vector2(1, 1)), Color(p["color"], a))
	# Danger on top of everything else: telegraphs and enemy projectiles.
	for e in w.enemies:
		_draw_telegraph(w, e)
	_draw_enemy_projectiles(w)
	for t in _texts:
		var a := clampf(t["life"] / 0.3, 0.0, 1.0)
		var font := ThemeDB.fallback_font
		draw_string_outline(font, t["pos"] - Vector2(60, 0), t["text"], HORIZONTAL_ALIGNMENT_CENTER, 120, 12, 3, Color(0, 0, 0, a))
		draw_string(font, t["pos"] - Vector2(60, 0), t["text"], HORIZONTAL_ALIGNMENT_CENTER, 120, 12, Color(t["color"], a))
	draw_set_transform(Vector2.ZERO)


func _draw_room(w: CombatWorld) -> void:
	var a := w.arena
	# Walls around the arena.
	var wall := Rect2(a.position - Vector2(8, 14), a.size + Vector2(16, 22))
	draw_rect(wall, Color("0b0a12"))
	draw_rect(Rect2(wall.position + Vector2(2, 2), Vector2(wall.size.x - 4, 10)), Color("3a3d4f"))
	for x in range(int(wall.position.x) + 4, int(wall.end.x) - 4, 12):
		draw_rect(Rect2(Vector2(x, wall.position.y + 4), Vector2(10, 6)), Color("5a5e74"))
	if _floor:
		draw_texture(_floor, a.position)
	for o in w.obstacles:
		_draw_block(o)


func _draw_block(o: Rect2) -> void:
	# Raised stone: dark drop shadow, lit top face, darker front face.
	draw_rect(Rect2(o.position + Vector2(2, 4), o.size), Color(0, 0, 0, 0.45))
	if is_equal_approx(o.size.x, 24.0) and is_equal_approx(o.size.y, 24.0):
		draw_texture_rect(PixelArt.tex("pillar"), o, false)
		return
	draw_rect(o, Color("0b0a12"))
	var inner := o.grow(-1)
	var face_h := minf(6.0, inner.size.y * 0.4)
	draw_rect(inner, Color("5a5e74"))
	draw_rect(Rect2(inner.position, Vector2(inner.size.x, inner.size.y - face_h)), Color("8a8fa8"))
	draw_rect(Rect2(Vector2(inner.position.x, inner.end.y - face_h), Vector2(inner.size.x, face_h)), Color("3a3d4f"))
	for x in range(int(inner.position.x) + 10, int(inner.end.x), 12):
		draw_line(Vector2(x, inner.end.y - face_h), Vector2(x, inner.end.y), Color("2b2d3a"))
	draw_line(inner.position + Vector2(1, 1), Vector2(inner.end.x - 1, inner.position.y + 1), Color("c9c2a8"))


func _draw_shadow(p: Vector2, r: float) -> void:
	draw_rect(Rect2(p + Vector2(-r, r - 1), Vector2(r * 2, 3)).abs(), Color(0, 0, 0, 0.35))


func _draw_spawns(w: CombatWorld) -> void:
	for s in w.pending_spawns:
		var k := 1.0 - float(s["t"]) / float(s["total"])
		var size := 24.0 * (0.4 + 0.6 * k)
		var tex := PixelArt.tex("portal")
		draw_texture_rect(tex, Rect2(s["pos"] - Vector2(size, size) * 0.5, Vector2(size, size)), false,
				Color(1, 1, 1, 0.5 + 0.5 * absf(sin(_t * 10.0))))


func _sprite(name: String, pos: Vector2, flip := false, variant := "", scale_k := 1.0, modulate_c := Color.WHITE) -> void:
	var tex := PixelArt.tex(name, variant)
	var size := Vector2(tex.get_width(), tex.get_height()) * SCALE * scale_k
	var rect := Rect2((pos - Vector2(size.x * 0.5, size.y * 0.6)).round(), size)
	if flip:
		rect = Rect2(rect.position + Vector2(rect.size.x, 0), Vector2(-rect.size.x, rect.size.y))
	draw_texture_rect(tex, rect, false, modulate_c)


func _draw_enemy(e: Enemy) -> void:
	var frame := int(e.anim * 6.0) % 2
	var variant := "white" if e.flash > 0.5 else ""
	if variant == "" and e.slow_time > 0.0:
		variant = "#7fd8ff"
	var flip := e.vel.x < -1.0 if e.kind != "guardian" else cos(e.facing) < 0.0
	if e.is_boss():
		var size := Vector2(64, 64)
		var bv := "white" if e.flash > 0.6 else ("#ff5a4e" if e.phase == 2 and int(_t * 4.0) % 2 == 0 else "")
		draw_texture_rect(PixelArt.tex("boss", bv), Rect2((e.pos - Vector2(32, 38)).round(), size), false)
		return
	var scale_k := e.radius / float(e.def["radius"])
	if e.elite == "swift":
		_sprite("%s_%d" % [e.kind, frame], e.pos + Vector2(0, 1), flip, "#7fd8ff", scale_k * 1.15, Color(1, 1, 1, 0.35))
	elif e.elite == "brute":
		_sprite("%s_%d" % [e.kind, frame], e.pos, flip, "#ff5a4e", scale_k * 1.12, Color(1, 1, 1, 0.4))
	_sprite("%s_%d" % [e.kind, frame], e.pos, flip, variant, scale_k)
	if e.kind == "guardian":
		_draw_shield(e)
	# Status markers.
	if e.burn_stacks > 0 and int(_t * 12.0 + e.id) % 3 == 0:
		_particles.append({"pos": e.pos + Vector2(randf_range(-5, 5), -6), "vel": Vector2(0, -20), "life": 0.3, "max": 0.3, "color": ELEMENT_COLORS["fire"]})
	if e.hp < e.max_hp:
		var bw := e.radius * 2.0 + 4.0
		var top := e.pos + Vector2(-bw * 0.5, -e.radius - 9)
		draw_rect(Rect2(top, Vector2(bw, 2)), Color("0b0a12"))
		draw_rect(Rect2(top, Vector2(bw * clampf(e.hp / e.max_hp, 0.0, 1.0), 2)), Color("ff5a4e"))


func _draw_shield(e: Enemy) -> void:
	var half := deg_to_rad(float(e.def.get("shield_arc_deg", 120))) * 0.5
	var col := Color("9db7d1") if e.state != "broken" else Color(0.5, 0.5, 0.55, 0.5)
	var r := e.radius + 5.0
	draw_arc(e.pos, r, e.facing - half, e.facing + half, 10, Color("0b0a12"), 4.0)
	draw_arc(e.pos, r, e.facing - half, e.facing + half, 10, col, 2.0)


func _draw_player(w: CombatWorld) -> void:
	var p := w.player
	if p.is_dead():
		return
	if p.iframes > 0.0 and int(_t * 20.0) % 2 == 0:
		return
	var frame := int(_t * 8.0) % 2 if p.moving else 0
	var variant := "white" if p.hurt_flash > 0.12 else ""
	_sprite("hero_%d" % frame, p.pos, p.facing.x < 0.0, variant)
	var sp := w.spell
	if sp.element == "storm":
		var need := int(sp.ep("charges", 4))
		for i in need:
			var c := ELEMENT_COLORS["storm"] if i < sp.storm_charge else Color(0.3, 0.27, 0.2)
			draw_rect(Rect2(p.pos + Vector2(-need * 2 + i * 4, 12), Vector2(3, 2)), c)


func _draw_spell_effects(w: CombatWorld) -> void:
	var spell := w.spell
	var col: Color = ELEMENT_COLORS.get(spell.element, ELEMENT_COLORS[""])
	if spell.form == "orbit" and not w.player.is_dead():
		for b in RuneForms.orbit_positions(spell, w):
			var pts := PackedVector2Array([b + Vector2(0, -5), b + Vector2(4, 0), b + Vector2(0, 5), b + Vector2(-4, 0)])
			draw_colored_polygon(pts, Color("0b0a12"))
			var inner := PackedVector2Array([b + Vector2(0, -3), b + Vector2(2, 0), b + Vector2(0, 3), b + Vector2(-2, 0)])
			draw_colored_polygon(inner, col)
	for f in _flashes:
		var a := clampf(f["life"] / f["max"], 0.0, 1.0)
		match f["kind"]:
			"cone":
				var pts := PackedVector2Array([f["pos"]])
				for i in 9:
					var ang: float = f["dir"].angle() - f["half"] + 2.0 * f["half"] * i / 8.0
					pts.append(f["pos"] + Vector2.from_angle(ang) * f["range"])
				draw_colored_polygon(pts, Color(f["color"], 0.35 * a))
				draw_polyline(pts.slice(1), Color(f["color"], 0.9 * a), 2.0)
			"ring":
				var r: float = f["radius"] * (1.0 - a * 0.6)
				draw_arc(f["pos"], r, 0, TAU, 24, Color(f["color"], a), 3.0)
			"bolt":
				var pts := PackedVector2Array()
				var from: Vector2 = f["pos"]
				var to: Vector2 = f["to"]
				for i in 6:
					var k := i / 5.0
					pts.append(from.lerp(to, k) + (Vector2(randf_range(-4, 4), randf_range(-4, 4)) if i > 0 and i < 5 else Vector2.ZERO))
				draw_polyline(pts, Color(f["color"], a), 2.0)


func _draw_player_projectiles(w: CombatWorld) -> void:
	var col: Color = ELEMENT_COLORS.get(w.spell.element, ELEMENT_COLORS[""])
	for p in w.projectiles:
		if p.team != "player":
			continue
		if p.kind == "rebound":
			draw_line(p.pos - p.vel.normalized() * 8.0, p.pos, Color("0b0a12"), 4.0)
			draw_line(p.pos - p.vel.normalized() * 8.0, p.pos, Color("c9a6ff"), 2.0)
			continue
		draw_line(p.pos - p.vel.normalized() * 6.0, p.pos, Color(col, 0.4), 3.0)
		draw_circle(p.pos, p.radius + 1.0, Color("0b0a12"))
		draw_circle(p.pos, p.radius, col)
		draw_circle(p.pos - Vector2(1, 1), 1.0, Color.WHITE)


func _draw_enemy_projectiles(w: CombatWorld) -> void:
	for p in w.projectiles:
		if p.team != "enemy":
			continue
		if p.kind == "boss":
			draw_circle(p.pos, p.radius + 2.0, Color("0b0a12"))
			draw_circle(p.pos, p.radius, Color("ff5a4e"))
			draw_circle(p.pos, p.radius - 2.0, Color("fff6b0"))
		else:
			var d := p.vel.normalized()
			draw_line(p.pos - d * 9.0, p.pos + d * 2.0, Color("0b0a12"), 4.0)
			draw_line(p.pos - d * 8.0, p.pos, Color("d9d2b8"), 2.0)
			draw_rect(Rect2(p.pos - Vector2(1.5, 1.5), Vector2(3, 3)), Color("ff5a4e"))


func _draw_telegraph(w: CombatWorld, e: Enemy) -> void:
	var blink := 0.55 + 0.45 * absf(sin(_t * 14.0))
	match e.state:
		"telegraph":
			var k := 1.0 - e.timer / float(e.def.get("telegraph", 0.7))
			if e.kind == "archer":
				var len := w.ray_length(e.pos, e.aim, 300.0)
				_dashed(e.pos, e.pos + e.aim * len, Color(1.0, 0.35, 0.3, 0.35 + 0.5 * k * blink))
			elif e.kind == "charger":
				var len := minf(w.ray_length(e.pos, e.aim, 300.0), float(e.def["dash_speed"]) * float(e.def["dash_time"]))
				_lane(e.pos, e.aim, len, e.radius * 2.0, k, blink)
		"charge_telegraph":
			var k2 := 1.0 - e.timer / float(e.def["charge_telegraph"])
			_lane(e.pos, e.aim, w.ray_length(e.pos, e.aim, 600.0), e.radius * 2.0, k2, blink)
		"radial_telegraph":
			var k3 := 1.0 - e.timer / float(e.def["radial_telegraph"])
			draw_arc(e.pos, e.radius + 6.0 + 30.0 * (1.0 - k3), 0, TAU, 32, Color(1.0, 0.35, 0.3, 0.3 + 0.6 * k3 * blink), 2.0)


func _lane(from: Vector2, dir: Vector2, length: float, width: float, k: float, blink: float) -> void:
	var side := dir.orthogonal() * width * 0.5
	var pts := PackedVector2Array([from + side, from + side + dir * length, from - side + dir * length, from - side])
	draw_colored_polygon(pts, Color(1.0, 0.3, 0.25, 0.10 + 0.22 * k))
	var closed := pts.duplicate()
	closed.append(pts[0])
	draw_polyline(closed, Color(1.0, 0.35, 0.3, 0.4 + 0.5 * k * blink), 1.0)


func _dashed(a: Vector2, b: Vector2, c: Color) -> void:
	var d := b - a
	var n := int(d.length() / 6.0)
	for i in n:
		if i % 2 == 0:
			draw_line(a + d * (float(i) / n), a + d * (float(i + 1) / n), c, 1.0)
