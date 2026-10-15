class_name Hud
extends CanvasLayer
## In-game HUD: cargo integrity, distance left, timer, hints and pause button.

signal pause_pressed

var _bar: IntegrityBar
var _distance: Label
var _mission: Label
var _timer: Label
var _prompt: Label
var _hint: Label
var _warning: Label
var _cargo_icon: CargoArt
var _t := 0.0
var _hint_tween: Tween


func build(level: LevelData, cargo: CargoType) -> void:
	layer = 10
	var root := Control.new()
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.theme = UiKit.theme()
	add_child(root)

	# --- Integrity (top-left) ---
	var box := UiKit.panel(Color(0.16, 0.13, 0.28, 0.5))
	box.modulate.a = 0.92
	box.position = Vector2(16, 14)
	box.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(box)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 14)
	row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	box.add_child(row)
	var icon_holder := Control.new()
	icon_holder.custom_minimum_size = Vector2(58, 58)
	icon_holder.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_cargo_icon = CargoArt.new()
	_cargo_icon.setup(cargo)
	var s := 50.0 / maxf(cargo.size.x, cargo.size.y)
	_cargo_icon.scale = Vector2(s, s)
	_cargo_icon.position = Vector2(29, 29)
	icon_holder.add_child(_cargo_icon)
	row.add_child(icon_holder)
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 2)
	col.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row.add_child(col)
	var name_l := UiKit.label(cargo.display_name.to_upper(), 20, cargo.hud_color, 6)
	name_l.horizontal_alignment = HORIZONTAL_ALIGNMENT_LEFT
	col.add_child(name_l)
	_bar = IntegrityBar.new()
	_bar.custom_minimum_size = Vector2(250, 30)
	col.add_child(_bar)
	_warning = UiKit.label("KEEP IT LEVEL!", 22, Palette.DANGER, 7)
	_warning.position = Vector2(30, 112)
	_warning.visible = false
	root.add_child(_warning)

	# --- Distance / mission (top-centre) ---
	var center := VBoxContainer.new()
	center.set_anchors_preset(Control.PRESET_CENTER_TOP)
	center.position = Vector2(-160, 8)
	center.custom_minimum_size = Vector2(320, 0)
	center.mouse_filter = Control.MOUSE_FILTER_IGNORE
	center.add_theme_constant_override("separation", -6)
	root.add_child(center)
	_mission = UiKit.label(level.name.to_upper(), 20, Color(1, 1, 1, 0.85), 6)
	center.add_child(_mission)
	_distance = UiKit.label("--- m", 44)
	center.add_child(_distance)
	_timer = UiKit.label("", 30, Palette.WARN)
	_timer.visible = level.time_limit > 0.0
	center.add_child(_timer)

	# --- Pause (top-right) ---
	var pause := UiKit.button("II", UiKit.BTN_SECONDARY, Vector2(88, 84))
	pause.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	pause.position = Vector2(-104, 16)
	pause.pressed.connect(func() -> void: pause_pressed.emit())
	root.add_child(pause)

	# --- Prompts ---
	_prompt = UiKit.label("HOLD TO FLY", 56, Palette.WHITE, 12)
	_prompt.set_anchors_preset(Control.PRESET_CENTER)
	_prompt.position = Vector2(-300, 60)
	_prompt.custom_minimum_size = Vector2(600, 80)
	_prompt.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(_prompt)
	var sub := UiKit.label("tap, click or press SPACE", 24, Color(1, 1, 1, 0.85), 6)
	sub.position = Vector2(0, 70)
	sub.custom_minimum_size = Vector2(600, 30)
	_prompt.add_child(sub)

	_hint = UiKit.label("", 34, Palette.GOGGLE, 10)
	_hint.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	_hint.position = Vector2(-450, -165)
	_hint.custom_minimum_size = Vector2(900, 60)
	_hint.modulate.a = 0.0
	_hint.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(_hint)


func set_ready_prompt(visible_now: bool) -> void:
	_prompt.visible = visible_now


func show_hint(text: String) -> void:
	_hint.text = text
	if _hint_tween:
		_hint_tween.kill()
	_hint_tween = create_tween()
	_hint_tween.tween_property(_hint, "modulate:a", 1.0, 0.2)
	_hint_tween.tween_interval(2.8)
	_hint_tween.tween_property(_hint, "modulate:a", 0.0, 0.4)


func update_status(integrity: CargoIntegrity, meters_left: float, time_left: float, tilt_warning: bool, delta: float) -> void:
	_t += delta
	_bar.set_value(integrity.fraction(), integrity.state)
	_cargo_icon.integrity = integrity.fraction()
	_cargo_icon.advance(delta)
	_distance.text = "%d m" % maxi(0, ceili(meters_left))
	if _timer.visible:
		_timer.text = "%.1f s" % time_left
		_timer.add_theme_color_override("font_color", Palette.DANGER if time_left < 8.0 else Palette.WARN)
	_warning.visible = tilt_warning and fmod(_t, 0.4) < 0.28
	if _prompt.visible:
		_prompt.scale = Vector2.ONE * (1.0 + 0.04 * sin(_t * 6.0))
		_prompt.pivot_offset = _prompt.size * 0.5


func on_damage() -> void:
	_bar.shake = 1.0
	_cargo_icon.hit_flash()


class IntegrityBar extends Control:
	var value := 1.0
	var shown := 1.0
	var state := 0
	var shake := 0.0

	func set_value(v: float, s: int) -> void:
		value = v
		state = s

	func _process(delta: float) -> void:
		shown = lerpf(shown, value, minf(1.0, delta * 8.0))
		shake = maxf(0.0, shake - delta * 3.0)
		queue_redraw()

	func _draw() -> void:
		var off := Vector2(sin(shake * 40.0) * shake * 5.0, 0)
		var r := Rect2(off, size)
		DrawUtil.rounded_rect(self, r, Color(0.08, 0.06, 0.15), 10, Palette.OUTLINE, 3)
		var col := Palette.GOOD
		if state == CargoIntegrity.State.DAMAGED:
			col = Palette.WARN
		elif state >= CargoIntegrity.State.CRITICAL:
			col = Palette.DANGER
		var fill := Rect2(r.position + Vector2(4, 4), Vector2((r.size.x - 8) * clampf(shown, 0.0, 1.0), r.size.y - 8))
		if fill.size.x > 2:
			DrawUtil.rounded_rect(self, fill, col, 7, col, 0)
			draw_rect(Rect2(fill.position + Vector2(4, 3), Vector2(maxf(fill.size.x - 8, 0), 4)), Color(1, 1, 1, 0.35))
		DrawUtil.text(self, Vector2(r.position.x, r.position.y + 22), "%d%%  %s" % [roundi(value * 100.0),
				CargoIntegrity.state_name(state).to_upper()], 18, Palette.WHITE, size.x, HORIZONTAL_ALIGNMENT_CENTER, 5)
