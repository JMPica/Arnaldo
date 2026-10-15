class_name StarMeter
extends Control
## Draws stars as shapes (the game font has no star glyph, and web builds have
## no system fallback fonts). `filled` of `total` stars are yellow.

var filled := 0
var total := 3
var star_radius := 11.0


func _init(filled_count := 0, total_count := 3, radius := 11.0) -> void:
	filled = filled_count
	total = total_count
	star_radius = radius
	custom_minimum_size = Vector2(total * radius * 2.4, radius * 2.4)
	mouse_filter = Control.MOUSE_FILTER_IGNORE


func _draw() -> void:
	var step := star_radius * 2.4
	var start_x := (size.x - step * total) * 0.5 + step * 0.5
	for i in total:
		var c := Vector2(start_x + i * step, size.y * 0.5)
		var pts := PackedVector2Array()
		for k in 10:
			var a := -PI / 2 + TAU * k / 10.0
			pts.append(c + Vector2(cos(a), sin(a)) * (star_radius if k % 2 == 0 else star_radius * 0.45))
		DrawUtil.polygon(self, pts, Palette.GOGGLE if i < filled else Color(0.3, 0.27, 0.45),
				Palette.OUTLINE, 2.5)
