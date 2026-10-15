class_name RopeArt
extends Node2D
## Draws the rope between the courier and the cargo. Straight when taut, a
## sagging curve when slack, so players can read the tension at a glance.

var _a := Vector2.ZERO
var _b := Vector2.ZERO
var _rest := 80.0


func set_ends(a: Vector2, b: Vector2, rest_length: float) -> void:
	_a = a
	_b = b
	_rest = rest_length
	queue_redraw()


func _draw() -> void:
	var dist := _a.distance_to(_b)
	var pts := PackedVector2Array()
	if dist >= _rest * 0.98:
		pts = PackedVector2Array([_a, _b])
	else:
		var sag := sqrt(maxf(_rest * _rest - dist * dist, 0.0)) * 0.5
		var mid := (_a + _b) * 0.5 + Vector2(0, sag)
		for i in 9:
			var t := i / 8.0
			pts.append(_a.lerp(mid, t).lerp(mid.lerp(_b, t), t))
	draw_polyline(pts, Palette.OUTLINE, 5.0, true)
	draw_polyline(pts, Color("c98a4b"), 2.5, true)
	DrawUtil.circle(self, _b, 4.0, Palette.METAL, Palette.OUTLINE, 2.0)
