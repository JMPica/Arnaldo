class_name CargoArt
extends Node2D
## Procedural drawing of the three cargos with progressive damage states.
## Centred on the cargo body (which rotates), so the art rotates with it.

var kind := "glass_box"
var size := Vector2(54, 54)
var integrity := 1.0          ## 0..1
var tilt_warning := false
var flash := 0.0              ## white flash after a hit
var delivered := false

var _t := 0.0
var _cracks: Array[PackedVector2Array] = []
var _drawn_integrity := -1.0


func setup(cargo: CargoType) -> void:
	kind = cargo.art
	size = cargo.size
	_build_cracks()


func _build_cracks() -> void:
	# Deterministic crack lines (seeded), revealed progressively with damage.
	var rng := RandomNumberGenerator.new()
	rng.seed = hash(kind)
	_cracks.clear()
	var h := size * 0.5
	for i in 7:
		var line := PackedVector2Array()
		var p := Vector2(rng.randf_range(-h.x, h.x) * 0.8, rng.randf_range(-h.y, h.y) * 0.8)
		var dir := Vector2.from_angle(rng.randf() * TAU)
		line.append(p)
		for j in 4:
			dir = dir.rotated(rng.randf_range(-0.9, 0.9))
			p += dir * rng.randf_range(6.0, 12.0)
			p = p.clamp(-h + Vector2(3, 3), h - Vector2(3, 3))
			line.append(p)
		_cracks.append(line)


func hit_flash() -> void:
	flash = 1.0


func advance(dt: float) -> void:
	_t += dt
	flash = maxf(0.0, flash - dt * 6.0)
	# Only the cake (candles) needs a constant redraw; others redraw on change.
	if kind == "birthday_cake" or flash > 0.0 or tilt_warning or not is_equal_approx(_drawn_integrity, integrity):
		queue_redraw()


func _draw() -> void:
	_drawn_integrity = integrity
	if integrity <= 0.0:
		return
	# Soft drop shadow helps read the silhouette against busy backgrounds.
	match kind:
		"heavy_piano": _draw_piano()
		"birthday_cake": _draw_cake()
		_: _draw_glass()
	if flash > 0.0:
		draw_rect(Rect2(-size * 0.5, size), Color(1, 1, 1, flash * 0.6))


func _damage_level() -> int:
	# 0 intact, 1..7 visible damage marks.
	return clampi(int((1.0 - integrity) * 8.0), 0, 7)


func _draw_cracks(color: Color, width: float) -> void:
	var n := _damage_level()
	for i in mini(n, _cracks.size()):
		draw_polyline(_cracks[i], color, width, true)


func _draw_glass() -> void:
	var r := Rect2(-size * 0.5, size)
	DrawUtil.rounded_rect(self, r, Palette.GLASS, 5, Palette.OUTLINE, 3)
	# Inner bevel + shine.
	draw_rect(r.grow(-6), Color(1, 1, 1, 0.18), false, 2.0)
	draw_line(r.position + Vector2(9, 8), r.position + Vector2(20, 8), Color(1, 1, 1, 0.9), 3.0)
	draw_line(r.position + Vector2(8, 13), r.position + Vector2(8, 22), Color(1, 1, 1, 0.9), 3.0)
	# A wine glass inside: you know it is fragile at a glance.
	var c := Vector2(6, 2)
	draw_arc(c + Vector2(0, -6), 7, 0.0, PI, 10, Palette.WHITE, 2.5, true)
	draw_line(c + Vector2(-7, -6), c + Vector2(7, -6), Palette.WHITE, 2.5)
	draw_line(c + Vector2(0, 1), c + Vector2(0, 10), Palette.WHITE, 2.5)
	draw_line(c + Vector2(-5, 11), c + Vector2(5, 11), Palette.WHITE, 2.5)
	# FRAGILE tape.
	var tape := Rect2(r.position.x, r.position.y + size.y * 0.68, size.x, 11)
	draw_rect(tape, Palette.TAPE)
	draw_rect(tape, Palette.OUTLINE, false, 1.5)
	DrawUtil.text(self, tape.position + Vector2(0, 9.5), "FRAGILE", 10, Palette.WHITE, size.x)
	_draw_cracks(Color(1, 1, 1, 0.95), 2.0)
	if integrity < 0.35:
		# A chunk missing from the corner.
		draw_colored_polygon(PackedVector2Array([r.position + Vector2(size.x, 0), r.position + Vector2(size.x - 16, 0),
				r.position + Vector2(size.x, 14)]), Color(0.1, 0.1, 0.2, 0.6))


func _draw_piano() -> void:
	var r := Rect2(-size * 0.5, size)
	var body := Rect2(r.position + Vector2(4, 0), Vector2(size.x - 8, size.y - 12))
	# Legs.
	var leg_drop := 2.0 if integrity >= 0.35 else 6.0
	DrawUtil.rounded_rect(self, Rect2(body.position + Vector2(6, body.size.y - 2), Vector2(9, 14)), Palette.PIANO_LIGHT, 2, Palette.OUTLINE, 2.5)
	DrawUtil.rounded_rect(self, Rect2(body.position + Vector2(body.size.x - 15, body.size.y - 2), Vector2(9, 14 - leg_drop)), Palette.PIANO_LIGHT, 2, Palette.OUTLINE, 2.5)
	DrawUtil.rounded_rect(self, body, Palette.PIANO, 6, Palette.OUTLINE, 3)
	# Lid.
	var lid_tilt := 0.0 if integrity >= 0.6 else 4.0
	DrawUtil.polygon(self, PackedVector2Array([body.position + Vector2(-3, 0), body.position + Vector2(body.size.x + 3, -lid_tilt),
			body.position + Vector2(body.size.x + 3, 7 - lid_tilt), body.position + Vector2(-3, 7)]), Palette.PIANO_LIGHT, Palette.OUTLINE, 2.5)
	# Gold trim and panel.
	draw_rect(Rect2(body.position + Vector2(10, 13), Vector2(body.size.x - 20, 16)), Palette.PIANO_LIGHT)
	draw_rect(Rect2(body.position + Vector2(10, 13), Vector2(body.size.x - 20, 16)), Palette.PIANO_TRIM, false, 2.0)
	DrawUtil.text(self, body.position + Vector2(0, 26), "GRAND-ISH", 10, Palette.PIANO_TRIM, body.size.x)
	# Keyboard.
	var keys := Rect2(body.position + Vector2(5, body.size.y - 26), Vector2(body.size.x - 10, 14))
	draw_rect(keys, Palette.WHITE)
	var n := 14
	var kw := keys.size.x / n
	var missing := _damage_level()
	for i in n:
		var kx := keys.position.x + i * kw
		draw_line(Vector2(kx, keys.position.y), Vector2(kx, keys.end.y), Palette.OUTLINE, 1.0)
		if i % 7 in [0, 1, 3, 4, 5] and i < n - 1:
			draw_rect(Rect2(kx + kw * 0.6, keys.position.y, kw * 0.8, keys.size.y * 0.6), Palette.OUTLINE)
		if missing > 2 and (i * 5 + 3) % 9 < missing - 2:
			draw_rect(Rect2(kx + 1, keys.position.y + 1, kw - 1, keys.size.y - 1), Color(0.15, 0.1, 0.2))
	draw_rect(keys, Palette.OUTLINE, false, 2.0)
	_draw_cracks(Color(0.75, 0.65, 0.85, 0.9), 2.0)


func _draw_cake() -> void:
	var h := size * 0.5
	var dmg := 1.0 - integrity
	# Tiers slide sideways as the cake gets damaged: readable at a glance.
	var slide := dmg * 10.0
	var wobble := sin(_t * 9.0) * (2.0 if tilt_warning else 0.0)
	# Plate.
	DrawUtil.rounded_rect(self, Rect2(-h.x - 4, h.y - 7, size.x + 8, 7), Palette.CAKE_PLATE, 3, Palette.OUTLINE, 2.5)
	var t1 := Rect2(-h.x + 2, h.y - 31, size.x - 4, 25)
	var t2 := Rect2(-h.x + 11 + slide * 0.6 + wobble * 0.5, t1.position.y - 19, size.x - 22, 20)
	var t3 := Rect2(-h.x + 20 + slide + wobble, t2.position.y - 15, size.x - 40, 16)
	for tier in [[t1, Palette.CAKE_PINK], [t2, Palette.CAKE_CREAM], [t3, Palette.CAKE_PINK]]:
		var rr: Rect2 = tier[0]
		DrawUtil.rounded_rect(self, rr, tier[1], 6, Palette.OUTLINE, 2.5)
		_drips(rr, Palette.WHITE if tier[1] == Palette.CAKE_PINK else Palette.CAKE_PINK)
	# Berries.
	for i in 3:
		DrawUtil.circle(self, Vector2(t1.position.x + 12 + i * 21, t1.position.y + 15), 3.2, Palette.BERRY, Palette.OUTLINE, 1.5)
	# Candles.
	var lean := 0.35 if tilt_warning else 0.0
	for i in 3:
		var base := Vector2(t3.position.x + 6 + i * (t3.size.x - 12) / 2.0, t3.position.y)
		var top := base + Vector2(sin(lean) * 12.0, -12)
		draw_line(base, top, Palette.OUTLINE, 6.0)
		draw_line(base, top, [Color("7fe7ff"), Palette.GOGGLE, Color("b48cff")][i], 3.5)
		if integrity > 0.35:
			var f := 1.0 + 0.25 * sin(_t * 23.0 + i * 2.0)
			draw_colored_polygon(PackedVector2Array([top + Vector2(-3, -1), top + Vector2(0, -9 * f), top + Vector2(3, -1)]), Palette.FLAME_MID)
			draw_circle(top + Vector2(0, -2), 2.0, Palette.FLAME_CORE)
	# Frosting smears when damaged.
	if dmg > 0.3:
		draw_circle(Vector2(-h.x + 6, h.y - 18), 5 + dmg * 6, Color(Palette.CAKE_CREAM, 0.9))
	if dmg > 0.6:
		draw_circle(Vector2(h.x - 8, h.y - 22), 4 + dmg * 6, Color(Palette.CAKE_PINK.lightened(0.2), 0.9))
	_draw_cracks(Color(0.6, 0.25, 0.4, 0.7), 2.0)


func _drips(r: Rect2, color: Color) -> void:
	var n := int(r.size.x / 10.0)
	for i in n:
		var x := r.position.x + 5 + i * (r.size.x - 10) / maxf(n - 1, 1)
		var d := 4.0 + float((i * 7) % 5)
		draw_line(Vector2(x, r.position.y + 2), Vector2(x, r.position.y + d), color, 4.0)
	draw_line(r.position + Vector2(3, 3), Vector2(r.end.x - 3, r.position.y + 3), color, 4.0)
