class_name DrawUtil
extends RefCounted
## Small helpers for the cartoon look: thick dark outlines and rounded shapes.

static var _box_cache: Dictionary = {}


static func rounded_rect(ci: CanvasItem, rect: Rect2, fill: Color, radius := 6.0,
		outline := Palette.OUTLINE, outline_width := 3.0) -> void:
	var key := "%s|%s|%d|%d" % [fill.to_html(), outline.to_html(), int(radius), int(outline_width)]
	var sb: StyleBoxFlat = _box_cache.get(key)
	if sb == null:
		sb = StyleBoxFlat.new()
		sb.bg_color = fill
		sb.set_corner_radius_all(int(radius))
		sb.border_color = outline
		sb.set_border_width_all(int(outline_width))
		sb.anti_aliasing = true
		sb.corner_detail = 6
		_box_cache[key] = sb
	sb.draw(ci.get_canvas_item(), rect)


static func circle(ci: CanvasItem, center: Vector2, radius: float, fill: Color,
		outline := Palette.OUTLINE, outline_width := 3.0) -> void:
	if outline_width > 0.0:
		ci.draw_circle(center, radius + outline_width, outline)
	ci.draw_circle(center, radius, fill)


static func polygon(ci: CanvasItem, points: PackedVector2Array, fill: Color,
		outline := Palette.OUTLINE, outline_width := 3.0) -> void:
	ci.draw_colored_polygon(points, fill)
	if outline_width > 0.0:
		var closed := points.duplicate()
		closed.append(points[0])
		ci.draw_polyline(closed, outline, outline_width, true)


static func ellipse_points(center: Vector2, radii: Vector2, segments := 20) -> PackedVector2Array:
	var pts := PackedVector2Array()
	for i in segments:
		var a := TAU * i / segments
		pts.append(center + Vector2(cos(a) * radii.x, sin(a) * radii.y))
	return pts


static func text(ci: CanvasItem, pos: Vector2, s: String, size: int, color: Color,
		width := -1.0, align := HORIZONTAL_ALIGNMENT_CENTER, outline := 0, outline_color := Palette.OUTLINE) -> void:
	var font := ThemeDB.fallback_font
	if UiKit.font != null:
		font = UiKit.font
	if outline > 0:
		ci.draw_string_outline(font, pos, s, align, width, size, outline, outline_color)
	ci.draw_string(font, pos, s, align, width, size, color)
