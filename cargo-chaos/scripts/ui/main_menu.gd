extends Control
## Title screen: logo, mascot with a dangling parcel, PLAY and mission select.

var _mascot: Node2D
var _courier: CourierArt
var _cargo: CargoArt
var _rope: RopeArt
var _t := 0.0


func _ready() -> void:
	theme = UiKit.theme()
	set_anchors_preset(Control.PRESET_FULL_RECT)
	LevelTheme.current = "sunset"

	var bg := CityBackground.new()
	add_child(bg)
	bg.build("sunset", 42)
	for c in bg.get_children():
		if c is Parallax2D:
			c.autoscroll = Vector2(-40.0 * c.scroll_scale.x * 4.0, 0)
	var street := ColorRect.new()
	street.color = Palette.STREET
	street.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	street.offset_top = -70
	add_child(street)

	_build_mascot()

	var layout := VBoxContainer.new()
	layout.set_anchors_preset(Control.PRESET_FULL_RECT)
	layout.add_theme_constant_override("separation", 6)
	layout.offset_top = 30
	add_child(layout)

	var title := UiKit.label("CARGO CHAOS", 108, Palette.GOGGLE, 22)
	layout.add_child(title)
	var tagline := UiKit.label("Deliver it. Don't destroy it.", 34, Palette.WHITE, 10)
	layout.add_child(tagline)

	var spacer := Control.new()
	spacer.custom_minimum_size = Vector2(0, 40)
	layout.add_child(spacer)

	var play_row := HBoxContainer.new()
	play_row.alignment = BoxContainer.ALIGNMENT_CENTER
	layout.add_child(play_row)
	var play := UiKit.button("PLAY", UiKit.BTN_PRIMARY, Vector2(360, 110))
	play.add_theme_font_size_override("font_size", 52)
	play.pressed.connect(func() -> void: Game.start_level(Game.suggested_level_index()))
	play_row.add_child(play)
	play.grab_focus.call_deferred()

	var spacer2 := Control.new()
	spacer2.custom_minimum_size = Vector2(0, 26)
	layout.add_child(spacer2)

	var cards := HBoxContainer.new()
	cards.alignment = BoxContainer.ALIGNMENT_CENTER
	cards.add_theme_constant_override("separation", 14)
	layout.add_child(cards)
	for i in Game.level_count():
		cards.add_child(_mission_card(i))

	# Footer: coins, stars and the sound toggle.
	var footer := HBoxContainer.new()
	footer.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	footer.offset_top = -64
	footer.offset_bottom = -10
	footer.offset_left = 24
	footer.offset_right = -24
	footer.add_theme_constant_override("separation", 24)
	add_child(footer)
	var stats := UiKit.label("★ %d     ● %d coins" % [Progress.total_stars(), int(Progress.data["coins"])], 28, Palette.GOGGLE, 8)
	stats.horizontal_alignment = HORIZONTAL_ALIGNMENT_LEFT
	stats.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	footer.add_child(stats)
	var sound := UiKit.button(_sound_text(), UiKit.BTN_SECONDARY, Vector2(200, 54))
	sound.add_theme_font_size_override("font_size", 24)
	sound.pressed.connect(func() -> void:
		Progress.set_sfx_enabled(not Progress.sfx_enabled())
		sound.text = _sound_text())
	footer.add_child(sound)

	UiKit.pop_in(play, 0.1)


func _sound_text() -> String:
	return "SOUND: ON" if Progress.sfx_enabled() else "SOUND: OFF"


func _mission_card(i: int) -> Control:
	var lv: LevelData = Game.data.levels[i]
	var unlocked := Progress.is_unlocked(i)
	var stars := Progress.best_stars(lv.id)
	var b := Button.new()
	b.custom_minimum_size = Vector2(214, 132)
	b.disabled = not unlocked
	b.clip_text = true
	var color := UiKit.BTN_SECONDARY if stars == 0 else Color("3d8f7a")
	for state in ["normal", "hover", "pressed", "disabled"]:
		var sb := StyleBoxFlat.new()
		sb.bg_color = color if state == "normal" else (color.lightened(0.12) if state == "hover" else (
				color.darkened(0.15) if state == "pressed" else Color("4a4566")))
		sb.set_corner_radius_all(18)
		sb.border_color = Palette.OUTLINE
		sb.set_border_width_all(4)
		sb.border_width_bottom = 7
		b.add_theme_stylebox_override(state, sb)
	b.pressed.connect(func() -> void: Game.start_level(i))
	var v := VBoxContainer.new()
	v.set_anchors_preset(Control.PRESET_FULL_RECT)
	v.mouse_filter = Control.MOUSE_FILTER_IGNORE
	v.alignment = BoxContainer.ALIGNMENT_CENTER
	v.add_theme_constant_override("separation", 0)
	b.add_child(v)
	var num := UiKit.label("%d" % (i + 1) if unlocked else "LOCKED", 34 if unlocked else 26,
			Palette.GOGGLE if unlocked else Color(1, 1, 1, 0.5), 8)
	num.mouse_filter = Control.MOUSE_FILTER_IGNORE
	v.add_child(num)
	var name_l := UiKit.label(lv.name, 21, Palette.WHITE, 6)
	name_l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	v.add_child(name_l)
	var star_l := UiKit.label("★".repeat(stars) + "☆".repeat(3 - stars), 26, Palette.GOGGLE, 6)
	star_l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	v.add_child(star_l)
	if not unlocked:
		name_l.modulate.a = 0.5
		star_l.visible = false
	return b


func _build_mascot() -> void:
	_mascot = Node2D.new()
	_mascot.scale = Vector2(1.6, 1.6)
	add_child(_mascot)
	var cargo := Game.data.cargo_types["glass_box"] as CargoType
	_rope = RopeArt.new()
	_mascot.add_child(_rope)
	_cargo = CargoArt.new()
	_cargo.setup(cargo)
	_mascot.add_child(_cargo)
	_courier = CourierArt.new()
	_courier.velocity = Vector2(280, 0)
	_mascot.add_child(_courier)


func _process(delta: float) -> void:
	_t += delta
	var vp := get_viewport_rect().size
	_mascot.position = Vector2(vp.x * 0.15, vp.y * 0.36 + sin(_t * 2.0) * 14.0)
	_courier.thrust = 0.6 + 0.4 * sin(_t * 2.0 + 1.2)
	_courier.velocity = Vector2(280, cos(_t * 2.0) * 60.0)
	_courier.advance(delta)
	var swing := sin(_t * 2.0 - 0.8) * 0.12
	var attach := Vector2(0, 22) + Vector2(0, 78).rotated(-swing)
	_cargo.position = attach + Vector2(0, 27).rotated(-swing)
	_cargo.rotation = -swing
	_cargo.advance(delta)
	_rope.set_ends(Vector2(0, 22), attach, 78)
