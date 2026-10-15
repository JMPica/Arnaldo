class_name UiKit
extends RefCounted
## Builds the game's UI theme and common widgets in code, so every screen
## shares one consistent, touch-friendly style (big rounded buttons).

static var font: Font = null
static var _theme: Theme = null

const BTN_PRIMARY := Color("ff7a2f")
const BTN_SECONDARY := Color("5b5f97")
const BTN_GOOD := Color("2fbf71")
const PANEL := Color("2a2347")
const TEXT := Color("fff8ef")


static func init() -> void:
	if font == null and ResourceLoader.exists("res://assets/fonts/LilitaOne-Regular.ttf"):
		font = load("res://assets/fonts/LilitaOne-Regular.ttf")


static func theme() -> Theme:
	if _theme != null:
		return _theme
	init()
	var t := Theme.new()
	if font:
		t.default_font = font
	t.default_font_size = 28
	t.set_color("font_color", "Label", TEXT)
	t.set_color("font_outline_color", "Label", Palette.OUTLINE)
	t.set_constant("outline_size", "Label", 8)
	_style_button(t, "Button", BTN_PRIMARY)
	_theme = t
	return t


static func _box(color: Color, radius := 22, border_bottom := 7) -> StyleBoxFlat:
	var sb := StyleBoxFlat.new()
	sb.bg_color = color
	sb.set_corner_radius_all(radius)
	sb.border_color = Palette.OUTLINE
	sb.set_border_width_all(4)
	sb.border_width_bottom = border_bottom
	sb.content_margin_left = 26
	sb.content_margin_right = 26
	sb.content_margin_top = 10
	sb.content_margin_bottom = 12
	sb.anti_aliasing = true
	return sb


static func _style_button(t: Theme, type_name: String, color: Color) -> void:
	t.set_stylebox("normal", type_name, _box(color))
	t.set_stylebox("hover", type_name, _box(color.lightened(0.12)))
	t.set_stylebox("pressed", type_name, _box(color.darkened(0.15), 22, 4))
	t.set_stylebox("disabled", type_name, _box(Color("6b6880")))
	t.set_stylebox("focus", type_name, StyleBoxEmpty.new())
	t.set_color("font_color", type_name, TEXT)
	t.set_color("font_hover_color", type_name, TEXT)
	t.set_color("font_pressed_color", type_name, TEXT)
	t.set_color("font_disabled_color", type_name, Color(1, 1, 1, 0.5))
	t.set_color("font_outline_color", type_name, Palette.OUTLINE)
	t.set_constant("outline_size", type_name, 8)
	t.set_font_size("font_size", type_name, 32)


static func button(text: String, color := BTN_PRIMARY, min_size := Vector2(260, 84)) -> Button:
	var b := Button.new()
	b.text = text
	b.custom_minimum_size = min_size
	if color != BTN_PRIMARY:
		b.add_theme_stylebox_override("normal", _box(color))
		b.add_theme_stylebox_override("hover", _box(color.lightened(0.12)))
		b.add_theme_stylebox_override("pressed", _box(color.darkened(0.15), 22, 4))
	b.pivot_offset = min_size * 0.5
	b.button_down.connect(func() -> void:
		var sfx := b.get_node_or_null("/root/Sfx")
		if sfx:
			sfx.play("click"))
	return b


static func label(text: String, size := 28, color := TEXT, outline := 8) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", color)
	l.add_theme_constant_override("outline_size", outline)
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	l.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	return l


static func panel(color := PANEL) -> PanelContainer:
	var p := PanelContainer.new()
	var sb := StyleBoxFlat.new()
	sb.bg_color = color
	sb.set_corner_radius_all(28)
	sb.border_color = Palette.OUTLINE
	sb.set_border_width_all(5)
	sb.content_margin_left = 36
	sb.content_margin_right = 36
	sb.content_margin_top = 26
	sb.content_margin_bottom = 30
	sb.shadow_color = Color(0, 0, 0, 0.35)
	sb.shadow_size = 12
	sb.shadow_offset = Vector2(0, 8)
	p.add_theme_stylebox_override("panel", sb)
	return p


## Pops a control in (scale from 0.6 with a slight overshoot).
static func pop_in(c: Control, delay := 0.0) -> void:
	c.scale = Vector2(0.6, 0.6)
	c.modulate.a = 0.0
	var tw := c.create_tween()
	if delay > 0.0:
		tw.tween_interval(delay)
	# The pivot is set once containers have laid the control out.
	tw.tween_callback(func() -> void: c.pivot_offset = c.size * 0.5)
	tw.tween_property(c, "scale", Vector2.ONE, 0.32).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	tw.parallel().tween_property(c, "modulate:a", 1.0, 0.18)
