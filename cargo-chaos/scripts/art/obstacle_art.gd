class_name ObstacleArt
extends Node2D
## Draws level geometry. The drawing always fills the collision rectangle
## exactly: what you see is what you hit (no decorative props in the play space).

var kind := "building"
var size := Vector2(100, 100)
var variant := 0
var animated := false
var theme_name := "day"
var _t := 0.0

const STREET_DECOR_STEP := 260.0


func setup(k: String, s: Vector2, v: int, moving: bool) -> void:
	kind = k
	size = s
	variant = v
	animated = moving or kind == "drone" or kind == "pad"
	theme_name = LevelTheme.current


func _process(delta: float) -> void:
	if animated:
		_t += delta
		queue_redraw()


func _draw() -> void:
	var r := Rect2(-size * 0.5, size)
	match kind:
		"building": _building(r)
		"tower": _tower(r)
		"sign": _sign(r)
		"girder": _girder(r)
		"skybridge": _skybridge(r)
		"awning": _awning(r)
		"drone": _drone(r)
		"crane": _crane(r)
		"street": _street(r)
		"pad": _pad(r)
		_: pass


func _theme() -> Dictionary:
	return Palette.theme(theme_name)


func _building(r: Rect2) -> void:
	var col: Color = Palette.BUILDING_COLORS[variant % Palette.BUILDING_COLORS.size()]
	if _theme()["night"]:
		col = col.darkened(0.45)
	DrawUtil.rounded_rect(self, r, col, 4, Palette.OUTLINE, 3)
	# Roof ledge.
	DrawUtil.rounded_rect(self, Rect2(r.position + Vector2(-4, -2), Vector2(r.size.x + 8, 12)), col.darkened(0.25), 3, Palette.OUTLINE, 3)
	# Windows grid (lit windows are seeded so a level always looks the same).
	var cols := maxi(1, int((r.size.x - 20) / 30.0))
	var rows := maxi(1, int((r.size.y - 40) / 40.0))
	var gap_x := (r.size.x - 20) / cols
	for row in rows:
		for c in cols:
			var w := Rect2(r.position + Vector2(10 + c * gap_x + gap_x * 0.2, 24 + row * 40), Vector2(gap_x * 0.6, 22))
			if w.end.y > r.end.y - 8:
				continue
			var lit := ((row * 7 + c * 13 + variant * 5) % 5) == 0
			var wc: Color = _theme()["window_lit"] if lit else _theme()["window"]
			draw_rect(w, wc)
			draw_rect(w, col.darkened(0.45), false, 2.0)
	# Brick pattern hint on the lower part.
	for i in 4:
		var y := r.end.y - 10 - i * 9
		if y < r.position.y + 20:
			break
		draw_line(Vector2(r.position.x + 4, y), Vector2(r.end.x - 4, y), col.darkened(0.12), 1.0)


func _tower(r: Rect2) -> void:
	var col := Color("5aa9d6")
	if _theme()["night"]:
		col = Color("2c4f7a")
	DrawUtil.rounded_rect(self, r, col, 3, Palette.OUTLINE, 3)
	var n := maxi(2, int(r.size.x / 22.0))
	for i in range(1, n):
		var x := r.position.x + r.size.x * i / n
		draw_line(Vector2(x, r.position.y + 3), Vector2(x, r.end.y - 3), col.darkened(0.25), 2.0)
	for j in int(r.size.y / 26.0):
		var y := r.position.y + 14 + j * 26
		draw_line(Vector2(r.position.x + 3, y), Vector2(r.end.x - 3, y), col.lightened(0.2), 1.5)
	# Diagonal reflections.
	for k in 3:
		var x0 := r.position.x + 10 + k * 18
		draw_line(Vector2(x0, r.position.y + 10), Vector2(x0 + 30, r.position.y + 50), Color(1, 1, 1, 0.25), 6.0)


func _truss(r: Rect2, col: Color) -> void:
	DrawUtil.rounded_rect(self, r, col.darkened(0.1), 2, Palette.OUTLINE, 3)
	var step := 26.0
	var y := r.position.y
	var flip := false
	while y < r.end.y - 2:
		var y2 := minf(y + step, r.end.y)
		var a := Vector2(r.position.x + 4, y)
		var b := Vector2(r.end.x - 4, y2)
		if flip:
			a = Vector2(r.end.x - 4, y)
			b = Vector2(r.position.x + 4, y2)
		draw_line(a, b, col.darkened(0.45), 3.0)
		draw_line(Vector2(r.position.x + 2, y2), Vector2(r.end.x - 2, y2), col.darkened(0.45), 2.0)
		flip = not flip
		y = y2
	draw_line(Vector2(r.position.x + 5, r.position.y), Vector2(r.position.x + 5, r.end.y), col.lightened(0.2), 3.0)


func _sign(r: Rect2) -> void:
	var board_h := minf(r.size.y, 110.0)
	var truss_r := Rect2(r.position + Vector2(r.size.x * 0.2, 0), Vector2(r.size.x * 0.6, r.size.y - board_h + 4))
	if truss_r.size.y > 6:
		_truss(truss_r, Palette.METAL_DARK)
	var board := Rect2(Vector2(r.position.x, r.end.y - board_h), Vector2(r.size.x, board_h))
	var hues := [Color("ff5d8f"), Color("ffb534"), Color("4fd1c5"), Color("9b7bff")]
	var col: Color = hues[variant % hues.size()]
	DrawUtil.rounded_rect(self, board, col, 8, Palette.OUTLINE, 4)
	DrawUtil.rounded_rect(self, board.grow(-8), col.lightened(0.25), 5, col.darkened(0.3), 2)
	var words := ["SKY PIZZA", "BIG SALE", "FLY SAFE", "COFFEE!", "JETPACKS", "NOODLES"]
	var font_size := int(clampf(board.size.x / 7.0, 14.0, 30.0))
	DrawUtil.text(self, Vector2(board.position.x, board.get_center().y + font_size * 0.35), words[variant % words.size()],
			font_size, Palette.WHITE, board.size.x, HORIZONTAL_ALIGNMENT_CENTER, 6, col.darkened(0.5))
	# Bulb lights along the bottom edge.
	var n := int(board.size.x / 22.0)
	for i in n:
		draw_circle(Vector2(board.position.x + 11 + i * 22, board.end.y - 6), 3, Palette.FLAME_CORE)


func _girder(r: Rect2) -> void:
	_truss(r, Palette.STEEL)
	# Hazard stripes at the tip.
	var tip := Rect2(Vector2(r.position.x, r.end.y - 14), Vector2(r.size.x, 14))
	draw_rect(tip, Palette.OUTLINE)
	var x := tip.position.x
	while x < tip.end.x:
		draw_colored_polygon(PackedVector2Array([Vector2(x, tip.end.y), Vector2(minf(x + 8, tip.end.x), tip.position.y),
				Vector2(minf(x + 16, tip.end.x), tip.position.y), Vector2(minf(x + 8, tip.end.x), tip.end.y)]), Palette.GOGGLE)
		x += 16
	draw_rect(tip, Palette.OUTLINE, false, 3.0)


func _skybridge(r: Rect2) -> void:
	DrawUtil.rounded_rect(self, r, Color("7c8bb8"), 6, Palette.OUTLINE, 3)
	var inner := r.grow(-7)
	draw_rect(inner, Color(0.75, 0.95, 1.0, 0.75))
	var n := int(inner.size.x / 34.0)
	for i in range(1, n):
		var x := inner.position.x + inner.size.x * i / n
		draw_line(Vector2(x, inner.position.y), Vector2(x, inner.end.y), Color("5a6893"), 3.0)
	draw_line(inner.position + Vector2(6, 5), inner.position + Vector2(40, 5), Color(1, 1, 1, 0.8), 3.0)


func _awning(r: Rect2) -> void:
	DrawUtil.rounded_rect(self, r, Palette.WHITE, 8, Palette.OUTLINE, 3)
	var stripe := 18.0
	var x := r.position.x + 4
	var i := 0
	while x < r.end.x - 4:
		if i % 2 == 0:
			draw_rect(Rect2(x, r.position.y + 3, minf(stripe, r.end.x - 4 - x), r.size.y - 6), Palette.DANGER)
		x += stripe
		i += 1
	# Scalloped edge.
	var n := int(r.size.x / 18.0)
	for k in n:
		draw_circle(Vector2(r.position.x + 9 + k * 18, r.end.y - 1), 7, Palette.DANGER if k % 2 == 0 else Palette.WHITE)
	DrawUtil.text(self, Vector2(r.position.x, r.position.y - 6), "SOFT", 13, Palette.WHITE, r.size.x, HORIZONTAL_ALIGNMENT_CENTER, 5)


func _drone(r: Rect2) -> void:
	var c := r.get_center()
	# Arms and rotors.
	for side in [-1.0, 1.0]:
		var hub := c + Vector2(side * r.size.x * 0.38, -r.size.y * 0.18)
		draw_line(c, hub, Palette.OUTLINE, 6.0)
		draw_line(c, hub, Palette.METAL_DARK, 3.0)
		var spin := absf(sin(_t * 40.0 + side))
		var blade := r.size.x * 0.2 * (0.4 + 0.6 * spin)
		draw_line(hub + Vector2(-blade, -5), hub + Vector2(blade, -5), Palette.OUTLINE, 5.0)
		draw_line(hub + Vector2(-blade, -5), hub + Vector2(blade, -5), Palette.METAL, 3.0)
		DrawUtil.circle(self, hub, 4, Palette.METAL, Palette.OUTLINE, 2)
	var body := Rect2(c - Vector2(r.size.x * 0.28, r.size.y * 0.2), Vector2(r.size.x * 0.56, r.size.y * 0.62))
	DrawUtil.rounded_rect(self, body, Palette.DRONE, 8, Palette.OUTLINE, 3)
	DrawUtil.circle(self, body.get_center() + Vector2(0, 2), 5, Palette.LENS, Palette.OUTLINE, 2)
	var blink := Palette.DANGER if fmod(_t, 0.8) < 0.4 else Palette.DANGER.darkened(0.5)
	draw_circle(body.position + Vector2(body.size.x * 0.5, -1), 3, blink)


func _crane(r: Rect2) -> void:
	# Cable up to the sky (it is solid: see Obstacle).
	var top := r.position + Vector2(r.size.x * 0.5, 0)
	draw_line(top, top - Vector2(0, 1200), Palette.OUTLINE, 6.0)
	draw_line(top, top - Vector2(0, 1200), Palette.METAL_DARK, 3.0)
	DrawUtil.rounded_rect(self, Rect2(top + Vector2(-10, -16), Vector2(20, 14)), Palette.STEEL, 3, Palette.OUTLINE, 2.5)
	# Shipping crate.
	DrawUtil.rounded_rect(self, r, Color("3f8f5c"), 3, Palette.OUTLINE, 3)
	var n := int(r.size.x / 12.0)
	for i in range(1, n):
		var x := r.position.x + r.size.x * i / n
		draw_line(Vector2(x, r.position.y + 4), Vector2(x, r.end.y - 4), Color("2e6b44"), 2.0)
	draw_rect(Rect2(r.position + Vector2(0, r.size.y * 0.5 - 7), Vector2(r.size.x, 14)), Palette.GOGGLE)
	draw_rect(Rect2(r.position + Vector2(0, r.size.y * 0.5 - 7), Vector2(r.size.x, 14)), Palette.OUTLINE, false, 2.0)


func _street(r: Rect2) -> void:
	draw_rect(r, Palette.STREET)
	draw_rect(Rect2(r.position, Vector2(r.size.x, 16)), Palette.SIDEWALK)
	draw_line(r.position + Vector2(0, 16), Vector2(r.end.x, r.position.y + 16), Palette.OUTLINE, 3.0)
	draw_line(r.position, Vector2(r.end.x, r.position.y), Palette.OUTLINE, 3.0)
	var x := r.position.x
	while x < r.end.x:
		draw_line(Vector2(x, r.position.y + 2), Vector2(x, r.position.y + 14), Palette.SIDEWALK.darkened(0.2), 2.0)
		draw_rect(Rect2(x + 30, r.position.y + 44, 60, 6), Palette.LANE)
		x += 120.0


func _pad(r: Rect2) -> void:
	var col := Color("f0e6d2")
	if _theme()["night"]:
		col = Color("8f86a8")
	DrawUtil.rounded_rect(self, r, col, 4, Palette.OUTLINE, 3)
	# Hazard edge on the landing surface.
	var top := Rect2(r.position + Vector2(-6, -4), Vector2(r.size.x + 12, 16))
	draw_rect(top, Palette.OUTLINE)
	var x := top.position.x + 3
	var i := 0
	while x < top.end.x - 3:
		draw_rect(Rect2(x, top.position.y + 3, minf(14.0, top.end.x - 3 - x), 10), Palette.GOGGLE if i % 2 == 0 else Palette.OUTLINE)
		x += 14
		i += 1
	# Facade sign.
	var sign_r := Rect2(r.position + Vector2(14, 30), Vector2(r.size.x - 28, 46))
	var pulse := 0.5 + 0.5 * sin(_t * 4.0)
	DrawUtil.rounded_rect(self, sign_r, Palette.GOOD.lerp(Palette.WHITE, pulse * 0.25), 10, Palette.OUTLINE, 3)
	DrawUtil.text(self, Vector2(sign_r.position.x, sign_r.position.y + 33), "DELIVERY", 28, Palette.WHITE, sign_r.size.x,
			HORIZONTAL_ALIGNMENT_CENTER, 6, Palette.OUTLINE)
	# Big down arrow above the pad, bobbing (drawn above the building, out of the
	# collision rect but far above the landing surface and clearly a UI marker).
	var a := Vector2(0, r.position.y - 150 + sin(_t * 5.0) * 8.0)
	var arrow := PackedVector2Array([a + Vector2(-14, -30), a + Vector2(14, -30), a + Vector2(14, 0), a + Vector2(28, 0),
			a + Vector2(0, 28), a + Vector2(-28, 0), a + Vector2(-14, 0)])
	DrawUtil.polygon(self, arrow, Color(Palette.GOOD, 0.85), Palette.OUTLINE, 3)
	# Windows on the remaining facade.
	var y := sign_r.end.y + 20
	while y < r.end.y - 30:
		for k in 3:
			var w := Rect2(r.position.x + 20 + k * (r.size.x - 40) / 3.0, y, (r.size.x - 40) / 3.0 - 12, 20)
			draw_rect(w, _theme()["window"])
			draw_rect(w, col.darkened(0.4), false, 2.0)
		y += 40
