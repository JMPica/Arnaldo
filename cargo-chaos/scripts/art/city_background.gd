class_name CityBackground
extends Node2D
## Parallax city: sky gradient, sun/moon, clouds and two skyline layers.
## Everything is generated procedurally from a seed (light and original).

var theme_name := "day"
var seed_value := 1


func build(theme: String, seed_v: int) -> void:
	theme_name = theme
	seed_value = seed_v
	var t := Palette.theme(theme)

	var sky_layer := CanvasLayer.new()
	sky_layer.layer = -20
	var sky := SkyDraw.new()
	sky.colors = t
	sky.set_anchors_preset(Control.PRESET_FULL_RECT)
	sky.mouse_filter = Control.MOUSE_FILTER_IGNORE
	sky_layer.add_child(sky)
	add_child(sky_layer)

	_add_layer(0.06, 1700.0, "clouds", t)
	_add_layer(0.18, 1300.0, "far", t)
	_add_layer(0.42, 1500.0, "mid", t)


func _add_layer(scroll: float, width: float, kind: String, t: Dictionary) -> void:
	var p := Parallax2D.new()
	p.scroll_scale = Vector2(scroll, 1.0)
	p.repeat_size = Vector2(width, 0)
	p.repeat_times = 3
	var art := SkylineDraw.new()
	art.kind = kind
	art.width = width
	art.colors = t
	art.seed_value = seed_value + hash(kind)
	p.add_child(art)
	add_child(p)


class SkyDraw extends Control:
	var colors: Dictionary

	func _draw() -> void:
		var r := get_rect()
		var top: Color = colors["sky_top"]
		var bottom: Color = colors["sky_bottom"]
		draw_polygon(PackedVector2Array([Vector2.ZERO, Vector2(r.size.x, 0), r.size, Vector2(0, r.size.y)]),
				PackedColorArray([top, top, bottom, bottom]))
		var sun_pos := Vector2(r.size.x * 0.78, r.size.y * 0.2)
		if colors["night"]:
			var rng := RandomNumberGenerator.new()
			rng.seed = 7
			for i in 70:
				var p := Vector2(rng.randf() * r.size.x, rng.randf() * r.size.y * 0.6)
				draw_circle(p, rng.randf_range(0.8, 2.0), Color(1, 1, 1, rng.randf_range(0.3, 0.9)))
			draw_circle(sun_pos, 34, colors["sun"])
			draw_circle(sun_pos + Vector2(12, -8), 30, top)
		else:
			draw_circle(sun_pos, 70, Color(colors["sun"], 0.25))
			draw_circle(sun_pos, 48, colors["sun"])


class SkylineDraw extends Node2D:
	var kind := "far"
	var width := 1300.0
	var colors: Dictionary
	var seed_value := 1

	func _draw() -> void:
		var rng := RandomNumberGenerator.new()
		rng.seed = seed_value
		if kind == "clouds":
			var x := 80.0
			while x < width - 200.0:
				_cloud(Vector2(x, rng.randf_range(70, 240)), rng.randf_range(0.7, 1.3), rng)
				x += rng.randf_range(260, 480)
			return
		var base_y := 660.0
		var col: Color = colors["far"] if kind == "far" else colors["mid"]
		var min_h := 140.0 if kind == "far" else 90.0
		var max_h := 380.0 if kind == "far" else 300.0
		var x2 := 0.0
		while x2 < width - 30.0:
			var w := rng.randf_range(50, 120)
			w = minf(w, width - x2)
			var h := rng.randf_range(min_h, max_h)
			var r := Rect2(x2, base_y - h, w, h + 500)
			draw_rect(r, col)
			if rng.randf() < 0.3:
				draw_rect(Rect2(x2 + w * 0.3, base_y - h - 24, w * 0.4, 26), col)
			if kind == "mid":
				var wc: Color = colors["mid_window"]
				var yy := base_y - h + 14
				while yy < base_y - 10:
					var xx := x2 + 8
					while xx < x2 + w - 12:
						if rng.randf() < 0.35:
							draw_rect(Rect2(xx, yy, 6, 9), Color(wc, 0.7))
						xx += 14
					yy += 20
			x2 += w + rng.randf_range(4, 26)

	func _cloud(p: Vector2, s: float, rng: RandomNumberGenerator) -> void:
		var c: Color = colors["cloud"]
		for i in 5:
			var off := Vector2((i - 2) * 30.0 * s, -absf(2 - i) * -8.0 * s - 10.0 * s * float(i % 2))
			draw_circle(p + off, (30.0 - absf(2 - i) * 6.0) * s, c)
		draw_rect(Rect2(p + Vector2(-70 * s, 0), Vector2(140 * s, 22 * s)), c)
