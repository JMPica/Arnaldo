class_name CourierArt
extends Node2D
## "Zippy", the courier. Fully procedural vector drawing (no external assets):
## teal jumpsuit, orange cap with goggles, red jetpack, yellow scarf.
## Purely visual: it reads the rig state and never affects gameplay.

enum Pose { FLY, HAPPY, SAD }

var thrust := 0.0
var velocity := Vector2.ZERO
var on_floor := false
var stunned := false
var pose := Pose.FLY

var _t := 0.0
var _lean := 0.0
var _squash := 1.0
var _prev_thrust := 0.0
var _blink := 0.0
var _flicker := 1.0
var _jet: CPUParticles2D


func _ready() -> void:
	_jet = CPUParticles2D.new()
	_jet.position = Vector2(-18, 26)
	_jet.amount = 28
	_jet.lifetime = 0.4
	_jet.direction = Vector2(-0.25, 1)
	_jet.spread = 14.0
	_jet.initial_velocity_min = 140.0
	_jet.initial_velocity_max = 220.0
	_jet.gravity = Vector2(0, -60)
	_jet.scale_amount_min = 5.0
	_jet.scale_amount_max = 9.0
	var curve := Curve.new()
	curve.add_point(Vector2(0, 1))
	curve.add_point(Vector2(1, 0.1))
	_jet.scale_amount_curve = curve
	var ramp := Gradient.new()
	ramp.set_color(0, Palette.FLAME_CORE)
	ramp.set_color(1, Color(0.55, 0.5, 0.6, 0.0))
	ramp.add_point(0.25, Palette.FLAME_MID)
	ramp.add_point(0.5, Color(Palette.FLAME_OUT, 0.8))
	_jet.color_ramp = ramp
	_jet.local_coords = false
	_jet.emitting = false
	_jet.show_behind_parent = true
	add_child(_jet)


func advance(dt: float) -> void:
	_t += dt
	# Lean back while thrusting, nose down while dropping.
	var target_lean := -0.12 * thrust + clampf(velocity.y / 2400.0, -0.1, 0.18)
	if pose != Pose.FLY:
		target_lean = 0.0
	_lean = lerpf(_lean, target_lean, minf(1.0, dt * 10.0))
	# A small stretch when the jetpack kicks in (anticipation) that settles back.
	if thrust > 0.5 and _prev_thrust <= 0.5:
		_squash = 1.12
	_prev_thrust = thrust
	_squash = lerpf(_squash, 1.0, minf(1.0, dt * 12.0))
	_blink -= dt
	if _blink < -3.2:
		_blink = 0.12
	_flicker = 0.85 + 0.15 * sin(_t * 47.0) + 0.1 * sin(_t * 31.0)
	if _jet:
		_jet.emitting = thrust > 0.15 and pose == Pose.FLY
	rotation = _lean
	scale = Vector2(1.0 / _squash, _squash)
	queue_redraw()


func _draw() -> void:
	_draw_scarf()
	_draw_flame()
	_draw_jetpack()
	_draw_legs()
	_draw_body()
	_draw_arm()
	_draw_head()
	if stunned:
		_draw_stars()


func _draw_flame() -> void:
	if pose != Pose.FLY:
		return
	var base := Vector2(-18, 25)
	var length := (8.0 + 34.0 * thrust) * _flicker
	var width := 6.0 + 3.0 * thrust
	_flame_shape(base, length, width, Palette.FLAME_OUT)
	_flame_shape(base, length * 0.72, width * 0.7, Palette.FLAME_MID)
	_flame_shape(base, length * 0.42, width * 0.4, Palette.FLAME_CORE)


func _flame_shape(base: Vector2, length: float, width: float, color: Color) -> void:
	var dir := Vector2(-0.22, 1).normalized()
	var side := Vector2(dir.y, -dir.x)
	var pts := PackedVector2Array([
		base + side * width, base + side * width * 0.8 + dir * length * 0.5,
		base + dir * length, base - side * width * 0.8 + dir * length * 0.5, base - side * width,
	])
	draw_colored_polygon(pts, color)


func _draw_jetpack() -> void:
	DrawUtil.rounded_rect(self, Rect2(-28, -14, 18, 32), Palette.JETPACK, 7)
	draw_rect(Rect2(-24, -10, 4, 22), Palette.JETPACK_DARK.lightened(0.15))
	DrawUtil.polygon(self, PackedVector2Array([Vector2(-23, 17), Vector2(-13, 17), Vector2(-14, 25), Vector2(-22, 25)]),
			Palette.METAL, Palette.OUTLINE, 2.5)
	DrawUtil.circle(self, Vector2(-19, -16), 4, Palette.METAL, Palette.OUTLINE, 2)


func _draw_legs() -> void:
	var swing := sin(_t * 9.0) * 3.0 if pose == Pose.FLY and not on_floor else 0.0
	var legs := [[Vector2(-3, 18), Vector2(-8, 27 + swing), Vector2(-15, 31 + swing)],
			[Vector2(7, 18), Vector2(4, 28 - swing), Vector2(-2, 33 - swing)]]
	if on_floor or pose != Pose.FLY:
		legs = [[Vector2(-4, 18), Vector2(-5, 26), Vector2(-6, 31)], [Vector2(6, 18), Vector2(7, 26), Vector2(8, 31)]]
	for leg in legs:
		draw_polyline(PackedVector2Array(leg), Palette.OUTLINE, 11.0, true)
		draw_polyline(PackedVector2Array(leg), Palette.SUIT_DARK, 6.0, true)
		DrawUtil.rounded_rect(self, Rect2(leg[2] + Vector2(-5, -4), Vector2(13, 8)), Palette.BOOTS, 4, Palette.OUTLINE, 2.5)


func _draw_body() -> void:
	DrawUtil.rounded_rect(self, Rect2(-14, -6, 28, 28), Palette.SUIT, 11)
	draw_rect(Rect2(-12, 12, 24, 5), Palette.SUIT_DARK)
	DrawUtil.rounded_rect(self, Rect2(-3, 11, 7, 7), Palette.GOGGLE, 2, Palette.OUTLINE, 2)
	# Little parcel badge on the chest.
	DrawUtil.rounded_rect(self, Rect2(1, -1, 9, 8), Color("c98a4b"), 1, Palette.OUTLINE, 1.5)
	draw_line(Vector2(5.5, -1), Vector2(5.5, 7), Palette.OUTLINE, 1.2)


func _draw_arm() -> void:
	var shoulder := Vector2(7, 0)
	var hand := Vector2(3, 21)
	if pose == Pose.HAPPY:
		hand = Vector2(16, -26 + sin(_t * 12.0) * 3.0)
	elif pose == Pose.SAD:
		hand = Vector2(12, -12)
	var elbow := (shoulder + hand) * 0.5 + Vector2(6, 0)
	var arm := PackedVector2Array([shoulder, elbow, hand])
	draw_polyline(arm, Palette.OUTLINE, 10.0, true)
	draw_polyline(arm, Palette.SUIT, 5.5, true)
	DrawUtil.circle(self, hand, 4.5, Palette.WHITE, Palette.OUTLINE, 2)


func _draw_head() -> void:
	var c := Vector2(3, -19)
	DrawUtil.circle(self, c, 15, Palette.SKIN)
	draw_circle(c + Vector2(4, 6), 4, Color(1.0, 0.55, 0.55, 0.35))
	DrawUtil.circle(self, c + Vector2(14, 1), 3.5, Palette.SKIN_DARK, Palette.OUTLINE, 2)
	# Cap: dome + brim.
	var dome := PackedVector2Array()
	for i in 13:
		var a := PI + PI * i / 12.0
		dome.append(c + Vector2(cos(a) * 16.5, sin(a) * 14.0 - 3.0))
	DrawUtil.polygon(self, dome, Palette.CAP)
	DrawUtil.polygon(self, PackedVector2Array([c + Vector2(6, -5), c + Vector2(26, -4), c + Vector2(25, 0), c + Vector2(6, 0)]),
			Palette.CAP_DARK, Palette.OUTLINE, 2.5)
	# Goggles resting on the cap.
	DrawUtil.circle(self, c + Vector2(-2, -11), 5.5, Palette.LENS, Palette.GOGGLE, 3)
	DrawUtil.circle(self, c + Vector2(8, -11), 5.5, Palette.LENS, Palette.GOGGLE, 3)
	draw_circle(c + Vector2(-3.5, -12.5), 1.6, Palette.WHITE)
	draw_circle(c + Vector2(6.5, -12.5), 1.6, Palette.WHITE)
	# Face.
	var eye := c + Vector2(9, -1)
	if pose == Pose.HAPPY:
		draw_arc(eye, 4, PI * 1.1, PI * 1.9, 8, Palette.OUTLINE, 2.5, true)
		draw_arc(c + Vector2(9, 6), 5, 0.2, PI - 0.2, 10, Palette.OUTLINE, 2.5, true)
	elif _blink > 0.0:
		draw_line(eye + Vector2(-3, 0), eye + Vector2(3, 0), Palette.OUTLINE, 2.5)
	else:
		draw_circle(eye, 4.2, Palette.WHITE)
		draw_circle(eye + Vector2(1.5, 0.5), 2.4, Palette.OUTLINE)
	if pose == Pose.SAD or stunned:
		draw_arc(c + Vector2(9, 10), 4, PI + 0.3, TAU - 0.3, 8, Palette.OUTLINE, 2.5, true)
		draw_line(eye + Vector2(-4, -6), eye + Vector2(3, -4), Palette.OUTLINE, 2.0)
	elif pose == Pose.FLY:
		draw_arc(c + Vector2(9, 5), 4, 0.3, PI - 0.6, 8, Palette.OUTLINE, 2.5, true)


func _draw_scarf() -> void:
	var speed := clampf(absf(velocity.x) / 300.0, 0.2, 1.2)
	var pts := PackedVector2Array()
	var root := Vector2(-6, -4)
	for i in 6:
		var k := float(i)
		pts.append(root + Vector2(-k * 7.0 * speed - k * 2.0, sin(_t * 12.0 - k * 0.9) * k * 1.2 + k * (1.0 - speed) * 2.5))
	draw_polyline(pts, Palette.OUTLINE, 9.0, true)
	draw_polyline(pts, Palette.SCARF, 5.0, true)


func _draw_stars() -> void:
	for i in 3:
		var a := _t * 6.0 + TAU * i / 3.0
		var p := Vector2(3, -42) + Vector2(cos(a) * 16.0, sin(a) * 5.0)
		_star(p, 5.0, Palette.GOGGLE)


func _star(p: Vector2, r: float, color: Color) -> void:
	var pts := PackedVector2Array()
	for i in 10:
		var a := -PI / 2 + TAU * i / 10.0
		var rr := r if i % 2 == 0 else r * 0.45
		pts.append(p + Vector2(cos(a), sin(a)) * rr)
	DrawUtil.polygon(self, pts, color, Palette.OUTLINE, 1.5)
