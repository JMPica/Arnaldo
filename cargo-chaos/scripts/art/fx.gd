class_name Fx
extends RefCounted
## One-shot visual effects (particles and floating text). Each effect frees
## itself when done. Particle counts are kept low for mid-range phones.


static func burst(parent: Node, pos: Vector2, color: Color, amount := 14, speed := 220.0,
		size := 6.0, lifetime := 0.6, gravity := 600.0) -> void:
	var p := CPUParticles2D.new()
	p.position = pos
	p.one_shot = true
	p.explosiveness = 0.95
	p.amount = amount
	p.lifetime = lifetime
	p.direction = Vector2(0, -1)
	p.spread = 180.0
	p.initial_velocity_min = speed * 0.4
	p.initial_velocity_max = speed
	p.gravity = Vector2(0, gravity)
	p.angular_velocity_min = -360.0
	p.angular_velocity_max = 360.0
	p.scale_amount_min = size * 0.6
	p.scale_amount_max = size
	var curve := Curve.new()
	curve.add_point(Vector2(0, 1))
	curve.add_point(Vector2(1, 0))
	p.scale_amount_curve = curve
	p.color = color
	p.finished.connect(p.queue_free)
	parent.add_child(p)
	p.emitting = true


static func dust(parent: Node, pos: Vector2) -> void:
	burst(parent, pos, Color(0.95, 0.92, 1.0, 0.8), 8, 120.0, 7.0, 0.45, -80.0)


static func confetti(parent: Node, pos: Vector2) -> void:
	for c in [Palette.GOGGLE, Palette.CAKE_PINK, Palette.SUIT, Palette.LENS, Palette.CAP]:
		burst(parent, pos, c, 8, 520.0, 7.0, 1.4, 500.0)


static func debris(parent: Node, pos: Vector2, cargo_art: String) -> void:
	match cargo_art:
		"heavy_piano":
			burst(parent, pos, Palette.PIANO_LIGHT, 18, 420.0, 10.0, 1.1, 900.0)
			burst(parent, pos, Palette.WHITE, 12, 380.0, 6.0, 1.0, 900.0)
		"birthday_cake":
			burst(parent, pos, Palette.CAKE_PINK, 18, 380.0, 10.0, 1.0, 900.0)
			burst(parent, pos, Palette.CAKE_CREAM, 14, 340.0, 8.0, 1.0, 900.0)
		_:
			burst(parent, pos, Palette.GLASS_EDGE, 26, 460.0, 7.0, 1.0, 900.0)


## Rising text ("-24%", "BONK!"): explains what happened, then fades.
static func floating_text(parent: Node, pos: Vector2, text: String, color: Color, size := 30) -> void:
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", color)
	l.add_theme_color_override("font_outline_color", Palette.OUTLINE)
	l.add_theme_constant_override("outline_size", 8)
	if UiKit.font:
		l.add_theme_font_override("font", UiKit.font)
	l.position = pos - Vector2(60, 20)
	l.size = Vector2(120, 40)
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	l.z_index = 50
	l.pivot_offset = Vector2(60, 20)
	l.scale = Vector2(0.4, 0.4)
	parent.add_child(l)
	var tw := l.create_tween()
	tw.set_parallel(true)
	tw.tween_property(l, "scale", Vector2.ONE, 0.18).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	tw.tween_property(l, "position:y", l.position.y - 70.0, 0.9).set_ease(Tween.EASE_OUT)
	tw.tween_property(l, "modulate:a", 0.0, 0.35).set_delay(0.6)
	tw.chain().tween_callback(l.queue_free)
