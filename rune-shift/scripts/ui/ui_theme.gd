class_name UiTheme
extends RefCounted
## Pixel UI style shared by every screen (no rounded corners, 2 px borders).

const BG := Color("0e0b17")
const PANEL := Color("1b2140")
const PANEL_DARK := Color("141a33")
const BORDER := Color("0b0a12")
const EDGE := Color("4b2a73")
const TEXT := Color("f4f1ff")
const MUTED := Color("a9a3c9")
const VIOLET := Color("7e4fc2")
const GLOW := Color("c9a6ff")
const GREEN := Color("6fae7a")
const RED := Color("ff5a4e")
const YELLOW := Color("ffe14d")

static var font: Font
static var _theme: Theme


static func get_font() -> Font:
	if font == null:
		font = load("res://assets/fonts/PixelifySans.ttf")
	return font


static func theme() -> Theme:
	if _theme:
		return _theme
	var t := Theme.new()
	t.default_font = get_font()
	t.default_font_size = 16
	t.set_color("font_color", "Label", TEXT)
	t.set_color("font_outline_color", "Label", BORDER)
	t.set_constant("outline_size", "Label", 4)
	t.set_stylebox("normal", "Button", box(VIOLET, BORDER, 2, Color("a77bff")))
	t.set_stylebox("hover", "Button", box(Color("8f5fd6"), BORDER, 2, Color("c9a6ff")))
	t.set_stylebox("pressed", "Button", box(Color("4b2a73"), BORDER, 2, Color("7e4fc2")))
	t.set_stylebox("disabled", "Button", box(Color("3a3d4f"), BORDER, 2, Color("5a5e74")))
	t.set_stylebox("focus", "Button", StyleBoxEmpty.new())
	for s in ["font_color", "font_hover_color", "font_pressed_color", "font_focus_color"]:
		t.set_color(s, "Button", TEXT)
	t.set_color("font_outline_color", "Button", BORDER)
	t.set_constant("outline_size", "Button", 4)
	t.set_font_size("font_size", "Button", 16)
	_theme = t
	return t


## A flat pixel box with a dark border and a 2 px light top edge (bevel).
static func box(bg: Color, border := BORDER, border_w := 2, top := Color(0, 0, 0, 0)) -> StyleBoxFlat:
	var sb := StyleBoxFlat.new()
	sb.bg_color = bg
	sb.border_color = border
	sb.set_border_width_all(border_w)
	sb.content_margin_left = 10
	sb.content_margin_right = 10
	sb.content_margin_top = 6
	sb.content_margin_bottom = 6
	sb.anti_aliasing = false
	if top.a > 0.0:
		sb.border_width_top = border_w + 2
		sb.border_color = border
		sb.expand_margin_top = 0
		sb.shadow_color = top
		sb.shadow_size = 0
	return sb


static func label(text: String, size := 16, color := TEXT, align := HORIZONTAL_ALIGNMENT_CENTER) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", color)
	l.horizontal_alignment = align
	l.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	return l


static func button(text: String, min_size := Vector2(200, 44), color := VIOLET) -> Button:
	var b := Button.new()
	b.text = text
	b.custom_minimum_size = min_size
	if color != VIOLET:
		b.add_theme_stylebox_override("normal", box(color, BORDER, 2))
		b.add_theme_stylebox_override("hover", box(color.lightened(0.12), BORDER, 2))
		b.add_theme_stylebox_override("pressed", box(color.darkened(0.2), BORDER, 2))
	b.button_down.connect(func() -> void:
		var sfx := b.get_node_or_null("/root/Sfx")
		if sfx:
			sfx.play("click"))
	return b


static func panel(bg := PANEL) -> PanelContainer:
	var p := PanelContainer.new()
	var sb := box(bg, BORDER, 2)
	sb.content_margin_left = 12
	sb.content_margin_right = 12
	sb.content_margin_top = 10
	sb.content_margin_bottom = 10
	p.add_theme_stylebox_override("panel", sb)
	return p


## A rune/upgrade icon as a TextureRect at an integer scale.
static func icon(name: String, px_scale := 3) -> TextureRect:
	var tr := TextureRect.new()
	tr.texture = PixelArt.tex(name)
	tr.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	tr.custom_minimum_size = Vector2(tr.texture.get_width(), tr.texture.get_height()) * px_scale
	tr.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	tr.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	tr.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return tr
