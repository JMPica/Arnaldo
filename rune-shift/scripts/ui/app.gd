extends Node
## RUNE SHIFT application: menu -> run (rooms, forge between rooms) -> results.
## The simulation (RunSession) is stepped at a fixed 60 Hz; the forge and the
## pause menu simply stop stepping it (the action is paused during decisions).

const DT := 1.0 / 60.0

var session: RunSession
var view: ArenaView
var joystick: TouchStick
var ui: Control
var hud: Control
var overlay: Control

var _accum := 0.0
var _paused := false
var _results_timer := -1.0
var _hp_bar: ColorRect
var _hp_fill: ColorRect
var _hp_label: Label
var _room_label: Label
var _frag_label: Label
var _spell_label: Label
var _slots: HBoxContainer
var _banner: Label
var _hint: Label
var _pause_btn: Button
var _top_bar: HBoxContainer
var _bottom_bar: VBoxContainer
var _last_damage_event := 0.0
var _arena_origin := Vector2.ZERO
var _music_track := ""

## Tools and tests: when set, the bot plays instead of the joystick and picks
## forge cards after `auto_choose_delay` seconds.
var autopilot: Bot = null
var auto_choose_delay := 1.2
var _auto_choose_t := -1.0


func _ready() -> void:
	RenderingServer.set_default_clear_color(UiTheme.BG)
	view = ArenaView.new()
	add_child(view)
	view.world_event.connect(_on_world_event)
	var layer := CanvasLayer.new()
	layer.layer = 10
	add_child(layer)
	ui = Control.new()
	ui.set_anchors_preset(Control.PRESET_FULL_RECT)
	ui.theme = UiTheme.theme()
	ui.mouse_filter = Control.MOUSE_FILTER_IGNORE
	layer.add_child(ui)
	joystick = TouchStick.new()
	ui.add_child(joystick)
	get_viewport().size_changed.connect(_layout)
	if not Progression.data.get("first_session_done", false):
		Analytics.track("first_session_started", {})
		Progression.data["first_session_done"] = true
		Progression.save()
	show_menu()


# ------------------------------------------------------------------ layout --

func _screen() -> Vector2:
	return get_viewport().get_visible_rect().size


func _layout() -> void:
	var s := _screen()
	var arena := Vector2(336, 480)
	var extra := maxf(0.0, s.y - 640.0)
	_arena_origin = Vector2(floor((s.x - arena.x) * 0.5), 62.0 + floor(extra * 0.5))
	view.position = _arena_origin
	if _top_bar:
		_top_bar.position = Vector2(8, maxf(6.0, _arena_origin.y - 56.0))
		_top_bar.size = Vector2(s.x - 16, 36)
	if _bottom_bar:
		var arena_bottom := _arena_origin.y + arena.y
		_bottom_bar.position = Vector2(0, arena_bottom + 8.0)
		_bottom_bar.size = Vector2(s.x, 64)
	if _banner:
		_banner.position = Vector2(floor((s.x - 340) * 0.5), _arena_origin.y + 170)
		_hint.position = Vector2(floor((s.x - 320) * 0.5), _arena_origin.y + 208)
	if _pause_btn:
		joystick.excluded = [Rect2(_pause_btn.global_position, _pause_btn.size).grow(6)]


# -------------------------------------------------------------------- menu --

func _clear_overlay() -> void:
	if overlay:
		overlay.queue_free()
		overlay = null


func _full_overlay(dim := 0.0) -> Control:
	_clear_overlay()
	overlay = Control.new()
	overlay.set_anchors_preset(Control.PRESET_FULL_RECT)
	if dim > 0.0:
		var bg := ColorRect.new()
		bg.color = Color(UiTheme.BG, dim)
		bg.set_anchors_preset(Control.PRESET_FULL_RECT)
		overlay.add_child(bg)
	ui.add_child(overlay)
	return overlay


func show_menu() -> void:
	session = null
	view.session = null
	view.queue_redraw()
	_set_hud_visible(false)
	joystick.enabled = false
	_music("menu")
	var o := _full_overlay(1.0)
	var v := VBoxContainer.new()
	v.set_anchors_preset(Control.PRESET_FULL_RECT)
	v.alignment = BoxContainer.ALIGNMENT_CENTER
	v.add_theme_constant_override("separation", 10)
	o.add_child(v)
	var hero := UiTheme.icon("hero_0", 6)
	hero.custom_minimum_size = Vector2(72, 72)
	v.add_child(hero)
	v.add_child(UiTheme.label("RUNE SHIFT", 40, UiTheme.GLOW))
	v.add_child(UiTheme.label("Une runas. Forja hechizos.", 16, UiTheme.MUTED))
	var gap := Control.new()
	gap.custom_minimum_size = Vector2(0, 16)
	v.add_child(gap)
	var play := UiTheme.button("JUGAR", Vector2(220, 52))
	play.add_theme_font_size_override("font_size", 24)
	play.pressed.connect(start_run)
	_center(v, play)
	var row := HBoxContainer.new()
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	row.add_theme_constant_override("separation", 6)
	row.add_child(UiTheme.icon("fragment", 2))
	row.add_child(UiTheme.label("%d fragmentos de sello" % int(Progression.data["fragments"]), 16, UiTheme.GLOW))
	v.add_child(row)
	v.add_child(UiTheme.label("Compendio: %d / 27 hechizos" % Progression.compendium_count(), 16, UiTheme.MUTED))
	v.add_child(UiTheme.label("Mejor partida: sala %d / 9" % int(Progression.data["best_room"]), 16, UiTheme.MUTED))
	var gap2 := Control.new()
	gap2.custom_minimum_size = Vector2(0, 10)
	v.add_child(gap2)
	var how := UiTheme.label("Arrastra el dedo para moverte.\nTu hechizo ataca solo.\nEntre salas, combina runas.", 14, UiTheme.MUTED)
	v.add_child(how)
	var toggles := HBoxContainer.new()
	toggles.alignment = BoxContainer.ALIGNMENT_CENTER
	toggles.add_theme_constant_override("separation", 8)
	v.add_child(toggles)
	for key in ["sfx", "music"]:
		var b := UiTheme.button("", Vector2(120, 36), UiTheme.PANEL)
		b.add_theme_font_size_override("font_size", 14)
		var refresh := func() -> void:
			b.text = ("Sonido" if key == "sfx" else "Música") + (": sí" if Progression.setting(key) else ": no")
		refresh.call()
		b.pressed.connect(func() -> void:
			Progression.set_setting(key, not Progression.setting(key))
			refresh.call()
			if key == "music":
				_music_track = ""
				_music("menu"))
		toggles.add_child(b)


func _center(parent: Control, child: Control) -> void:
	var c := CenterContainer.new()
	c.add_child(child)
	parent.add_child(c)


func _music(track: String) -> void:
	if track == _music_track:
		return
	_music_track = track
	Sfx.music(track)


# --------------------------------------------------------------------- run --

func start_run(seed_v := -1) -> void:
	if int(Progression.data["runs"]) == 1:
		Analytics.track("second_run_started", {})
	if seed_v < 0:
		seed_v = int(Time.get_unix_time_from_system()) % 1000000 + randi() % 1000
	session = RunSession.new()
	session.room_entered.connect(_on_room_entered)
	session.room_completed.connect(_on_room_completed)
	session.rewards_offered.connect(_on_rewards)
	session.card_chosen.connect(_on_card_chosen)
	session.run_finished.connect(_on_run_finished)
	_clear_overlay()
	_build_hud()
	_set_hud_visible(true)
	view.session = session
	_layout()
	Analytics.track("run_started", {"seed": seed_v, "run_number": int(Progression.data["runs"]) + 1})
	session.start(seed_v)
	_refresh_slots()
	joystick.enabled = true
	_paused = false
	_results_timer = -1.0


func _physics_process(delta: float) -> void:
	if session == null or _paused:
		return
	if session.phase == RunSession.Phase.REWARD:
		if autopilot and _auto_choose_t >= 0.0:
			_auto_choose_t -= delta
			if _auto_choose_t < 0.0:
				_choose(autopilot.choose(session.offers))
		return
	if session.is_over():
		if _results_timer > 0.0:
			_results_timer -= delta
			if _results_timer <= 0.0:
				_show_results()
		if session.phase == RunSession.Phase.DEFEAT:
			session.world.step(DT, Vector2.ZERO)  # the room keeps moving behind the defeat screen
		return
	var move := autopilot.move(session.world, DT) if autopilot and session.phase == RunSession.Phase.COMBAT else joystick.get_vector()
	session.step(DT, move)
	_update_hud()


func _notification(what: int) -> void:
	if what == NOTIFICATION_APPLICATION_FOCUS_OUT or what == NOTIFICATION_APPLICATION_PAUSED:
		if session and not session.is_over() and not _paused and session.phase != RunSession.Phase.REWARD:
			_toggle_pause()


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and (event.physical_keycode == KEY_ESCAPE or event.physical_keycode == KEY_P):
		if session and not session.is_over() and session.phase != RunSession.Phase.REWARD:
			_toggle_pause()


# --------------------------------------------------------------------- HUD --

func _build_hud() -> void:
	if hud:
		hud.queue_free()
	hud = Control.new()
	hud.set_anchors_preset(Control.PRESET_FULL_RECT)
	hud.mouse_filter = Control.MOUSE_FILTER_IGNORE
	ui.add_child(hud)
	ui.move_child(joystick, ui.get_child_count() - 1)
	var top := HBoxContainer.new()
	_top_bar = top
	top.add_theme_constant_override("separation", 8)
	hud.add_child(top)
	var hp_box := Control.new()
	hp_box.custom_minimum_size = Vector2(130, 36)
	top.add_child(hp_box)
	_hp_bar = ColorRect.new()
	_hp_bar.color = UiTheme.BORDER
	_hp_bar.position = Vector2(0, 8)
	_hp_bar.size = Vector2(130, 18)
	hp_box.add_child(_hp_bar)
	_hp_fill = ColorRect.new()
	_hp_fill.color = UiTheme.RED
	_hp_fill.position = Vector2(2, 10)
	_hp_fill.size = Vector2(126, 14)
	hp_box.add_child(_hp_fill)
	_hp_label = UiTheme.label("100", 14)
	_hp_label.position = Vector2(0, 7)
	_hp_label.size = Vector2(130, 20)
	hp_box.add_child(_hp_label)
	_room_label = UiTheme.label("Sala 1/9", 16)
	_room_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	top.add_child(_room_label)
	_frag_label = UiTheme.label("0", 16, UiTheme.GLOW)
	top.add_child(UiTheme.icon("fragment", 2))
	top.add_child(_frag_label)
	_pause_btn = UiTheme.button("II", Vector2(40, 36), UiTheme.PANEL)
	_pause_btn.pressed.connect(_toggle_pause)
	top.add_child(_pause_btn)
	# Spell bar at the bottom.
	var bottom := VBoxContainer.new()
	_bottom_bar = bottom
	bottom.add_theme_constant_override("separation", 2)
	hud.add_child(bottom)
	_slots = HBoxContainer.new()
	_slots.alignment = BoxContainer.ALIGNMENT_CENTER
	_slots.add_theme_constant_override("separation", 10)
	bottom.add_child(_slots)
	_spell_label = UiTheme.label("", 14, UiTheme.GLOW)
	bottom.add_child(_spell_label)
	_banner = UiTheme.label("", 24, UiTheme.GLOW)
	_banner.size = Vector2(340, 40)
	hud.add_child(_banner)
	_hint = UiTheme.label("", 14, UiTheme.YELLOW)
	_hint.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_hint.size = Vector2(320, 40)
	hud.add_child(_hint)
	call_deferred("_layout")
	_refresh_slots()


func _set_hud_visible(v: bool) -> void:
	if hud:
		hud.visible = v


func _refresh_slots() -> void:
	if _slots == null or session == null or session.run == null:
		return
	for c in _slots.get_children():
		c.queue_free()
	var sp := session.run.spell
	for fam in [["form", sp.form], ["element", sp.element], ["catalyst", sp.catalyst]]:
		var box := PanelContainer.new()
		box.add_theme_stylebox_override("panel", UiTheme.box(UiTheme.PANEL_DARK, UiTheme.EDGE, 2))
		box.custom_minimum_size = Vector2(44, 40)
		if fam[1] == "":
			var q := UiTheme.label("?", 16, UiTheme.MUTED)
			box.add_child(q)
		else:
			var col := VBoxContainer.new()
			col.add_theme_constant_override("separation", 0)
			col.add_child(UiTheme.icon(fam[1], 3))
			box.add_child(col)
		_slots.add_child(box)
	_spell_label.text = sp.display_name() + ("" if sp.is_complete() else "  (faltan runas)")


func _update_hud() -> void:
	if session == null or hud == null:
		return
	var w := session.world
	var frac := clampf(w.player.hp / w.player.max_hp, 0.0, 1.0)
	_hp_fill.size.x = 126.0 * frac
	_hp_label.text = "%d / %d" % [ceili(w.player.hp), int(w.player.max_hp)]
	_room_label.text = ("JEFE" if session.is_boss_room() else "Sala %d/9" % (session.run.room_index + 1))
	_frag_label.text = str(session.run.fragments)
	if session.phase == RunSession.Phase.INTRO:
		_banner.modulate.a = 1.0
	elif _banner.modulate.a > 0.0:
		_banner.modulate.a = maxf(0.0, _banner.modulate.a - DT * 1.5)
		_hint.modulate.a = _banner.modulate.a


# ------------------------------------------------------------ run events --

func _on_room_entered(index: int, template: String) -> void:
	var def := session.room_def()
	var tname: String = GameDB.get_db().rooms["templates"][template]["name"]
	_banner.text = ("Jefe: El Guardián de los Sellos" if def.get("boss", false) else "Sala %d · %s" % [index + 1, tname])
	_banner.modulate.a = 1.0
	_hint.text = def.get("hint", "") if int(Progression.data["runs"]) < 3 or def.get("boss", false) else ""
	_hint.modulate.a = 1.0
	_music("boss" if def.get("boss", false) else "combat")
	if def.get("boss", false):
		Sfx.play("boss_roar")
	Analytics.track("room_entered", {"room": index + 1, "template": template, "hp": int(session.run.hp),
		"spell": session.run.spell.combo_key()})


func _on_room_completed(index: int, seconds: float) -> void:
	Sfx.play("room_clear")
	Analytics.track("room_completed", {"room": index + 1, "seconds": snappedf(seconds, 0.1),
		"hp": int(session.world.player.hp), "spell": session.run.spell.combo_key(),
		"damage_taken": int(session.world.stats["damage_taken"])})
	if session.is_boss_room():
		Analytics.track("boss_defeated", {"seconds": snappedf(seconds, 0.1), "spell": session.run.spell.combo_key(),
			"hp": int(session.world.player.hp)})


func _on_world_event(ev: Dictionary) -> void:
	match ev["type"]:
		"cast":
			Sfx.play("cast_orb" if ev.get("form", "") == "orb" else "cast_cone", -8.0, 1.0, 0.08)
		"cone":
			Sfx.play("cast_cone", -6.0)
		"hit":
			Sfx.play("orbit_hit" if ev.get("kind", "") == "orbit" else "hit", -10.0, 1.0, 0.05)
		"kill":
			Sfx.play("kill", -4.0)
		"explosion":
			Sfx.play("explosion", -3.0)
		"discharge":
			Sfx.play("discharge", -4.0)
		"block":
			Sfx.play("block", -6.0, 1.0, 0.08)
		"guard_break":
			Sfx.play("explosion", -6.0, 1.4)
		"spawn":
			Sfx.play("spawn", -10.0, 1.0, 0.1)
		"boss_phase":
			Sfx.play("boss_roar")
		"player_hit":
			Sfx.play("player_hit")
			# Throttled: at most one event per second keeps the log light.
			if session.world.time - _last_damage_event > 1.0:
				_last_damage_event = session.world.time
				Analytics.track("player_damaged", {"room": session.run.room_index + 1, "amount": ev["amount"],
					"by": ev["by"], "hp": int(session.world.player.hp)})
		"player_dead":
			Analytics.track("player_died", {"room": session.run.room_index + 1, "by": ev["by"],
				"spell": session.run.spell.combo_key(), "run_seconds": snappedf(session.run.time, 0.1)})


# ------------------------------------------------------------------- forge --

func _on_rewards(cards: Array) -> void:
	joystick.release()
	_auto_choose_t = auto_choose_delay
	_refresh_slots()
	var o := _full_overlay(0.82)
	var v := VBoxContainer.new()
	v.set_anchors_preset(Control.PRESET_FULL_RECT)
	v.offset_left = 16
	v.offset_right = -16
	v.alignment = BoxContainer.ALIGNMENT_CENTER
	v.add_theme_constant_override("separation", 8)
	o.add_child(v)
	v.add_child(UiTheme.label("LA FORJA", 32, UiTheme.GLOW))
	var sub := "Elige %d recompensas" % session.picks_left if session.picks_left > 1 else "Elige una recompensa"
	v.add_child(UiTheme.label(sub, 16, UiTheme.MUTED))
	v.add_child(UiTheme.label("Ahora: " + session.run.spell.display_name(), 14, UiTheme.TEXT))
	for i in cards.size():
		v.add_child(_card(cards[i], i))
	var hp_l := UiTheme.label("Salud %d / %d" % [ceili(session.run.hp), int(session.run.max_hp)], 14, UiTheme.MUTED)
	v.add_child(hp_l)


func _card(c: Dictionary, index: int) -> Control:
	var b := Button.new()
	b.custom_minimum_size = Vector2(320, 88)
	var color := UiTheme.PANEL
	if c["type"] == "rune":
		color = Color("2a1d48")
	elif c["type"] == "challenge":
		color = Color("3b1a22")
	elif c["type"] == "heal":
		color = Color("1d3a2a")
	b.add_theme_stylebox_override("normal", UiTheme.box(color, UiTheme.BORDER, 2))
	b.add_theme_stylebox_override("hover", UiTheme.box(color.lightened(0.1), UiTheme.GLOW, 2))
	b.add_theme_stylebox_override("pressed", UiTheme.box(color.darkened(0.2), UiTheme.GLOW, 2))
	b.pressed.connect(func() -> void: _choose(index))
	var row := HBoxContainer.new()
	row.set_anchors_preset(Control.PRESET_FULL_RECT)
	row.offset_left = 10
	row.offset_right = -10
	row.add_theme_constant_override("separation", 10)
	row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	b.add_child(row)
	var ic := UiTheme.icon(str(c.get("icon", "orb")), 4)
	ic.custom_minimum_size = Vector2(48, 48)
	row.add_child(ic)
	var col := VBoxContainer.new()
	col.alignment = BoxContainer.ALIGNMENT_CENTER
	col.add_theme_constant_override("separation", 0)
	col.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	col.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row.add_child(col)
	var tag := UiTheme.label(_family_tag(c), 12, UiTheme.MUTED, HORIZONTAL_ALIGNMENT_LEFT)
	col.add_child(tag)
	col.add_child(UiTheme.label(str(c["title"]), 18, UiTheme.TEXT, HORIZONTAL_ALIGNMENT_LEFT))
	var d := UiTheme.label(str(c["desc"]), 12, UiTheme.MUTED, HORIZONTAL_ALIGNMENT_LEFT)
	d.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	d.custom_minimum_size = Vector2(230, 0)
	col.add_child(d)
	for n in [tag, d]:
		n.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return b


func _family_tag(c: Dictionary) -> String:
	var fam := {"form": "Runa de Forma", "element": "Runa Elemental", "catalyst": "Runa Catalizadora"}
	match c["type"]:
		"rune": return "%s · %s" % [c.get("tag", ""), fam.get(c.get("family", ""), "")]
		"upgrade": return "Mejora · " + str(fam.get(c.get("family", ""), ""))
		"stat": return "Mejora del Forjador"
		"heal": return "Curación"
		"challenge": return "Desafío"
	return ""


func _choose(index: int) -> void:
	Sfx.play("pick")
	session.choose(index)
	if session.phase != RunSession.Phase.REWARD:
		_clear_overlay()
		_refresh_slots()


func _on_card_chosen(card: Dictionary, _result: String) -> void:
	Analytics.track("rune_selected", {"room": session.run.room_index + 1, "type": card["type"], "id": card["id"],
		"family": card.get("family", "")})
	if card["type"] in ["rune", "upgrade"]:
		Analytics.track("spell_configuration_changed", {"spell": session.run.spell.combo_key(),
			"levels": session.run.spell.levels.duplicate()})


# ------------------------------------------------------------------- pause --

func _toggle_pause() -> void:
	if session == null or session.is_over():
		return
	_paused = not _paused
	joystick.release()
	if not _paused:
		_clear_overlay()
		return
	var o := _full_overlay(0.8)
	var v := VBoxContainer.new()
	v.set_anchors_preset(Control.PRESET_FULL_RECT)
	v.alignment = BoxContainer.ALIGNMENT_CENTER
	v.add_theme_constant_override("separation", 12)
	o.add_child(v)
	v.add_child(UiTheme.label("PAUSA", 32, UiTheme.GLOW))
	v.add_child(UiTheme.label(session.run.spell.display_name(), 14, UiTheme.MUTED))
	var resume := UiTheme.button("Continuar", Vector2(220, 48))
	resume.pressed.connect(_toggle_pause)
	_center(v, resume)
	var give_up := UiTheme.button("Abandonar partida", Vector2(220, 44), Color("3b1a22"))
	give_up.pressed.connect(func() -> void:
		_paused = false
		session.run_finished.emit(false)
		session.phase = RunSession.Phase.DEFEAT
		_show_results())
	_center(v, give_up)


# ----------------------------------------------------------------- results --

func _on_run_finished(victory: bool) -> void:
	joystick.release()
	_results_timer = 1.6
	if victory:
		Sfx.play("victory")
	else:
		Sfx.play("defeat")


func _show_results() -> void:
	if session == null:
		return
	_results_timer = -1.0
	var victory := session.phase == RunSession.Phase.VICTORY
	var run := session.run
	var rooms_cleared := session.room_seconds.size()
	var discovered := Progression.record_run(victory, rooms_cleared, run.fragments, run.combos_used.keys())
	Analytics.track("run_completed", {"victory": victory, "rooms_cleared": rooms_cleared,
		"seconds": snappedf(run.time, 0.1), "fragments": run.fragments, "spell": run.spell.combo_key(),
		"choices": run.choices.size()})
	Ads.on_run_finished()
	_music("menu")
	joystick.enabled = false
	var o := _full_overlay(0.88)
	var v := VBoxContainer.new()
	v.set_anchors_preset(Control.PRESET_FULL_RECT)
	v.alignment = BoxContainer.ALIGNMENT_CENTER
	v.add_theme_constant_override("separation", 8)
	o.add_child(v)
	v.add_child(UiTheme.label("¡VICTORIA!" if victory else "HAS CAÍDO", 34, UiTheme.YELLOW if victory else UiTheme.RED))
	if victory:
		v.add_child(UiTheme.label("El Guardián de los Sellos ha caído.", 14, UiTheme.MUTED))
	elif session.world and session.world.stats["last_hit_by"] != "":
		var names := {"crawler": "un Rastrero", "archer": "una flecha", "charger": "un Embestidor",
			"guardian": "un Guardián", "boss": "el Guardián de los Sellos"}
		v.add_child(UiTheme.label("Último golpe: " + str(names.get(session.world.stats["last_hit_by"], "un enemigo")), 14, UiTheme.MUTED))
	v.add_child(UiTheme.label("Salas superadas: %d / 9" % rooms_cleared, 16))
	v.add_child(UiTheme.label("Tiempo: %d:%02d" % [int(run.time) / 60, int(run.time) % 60], 16))
	var frag := HBoxContainer.new()
	frag.alignment = BoxContainer.ALIGNMENT_CENTER
	frag.add_child(UiTheme.icon("fragment", 2))
	frag.add_child(UiTheme.label("+%d fragmentos de sello" % run.fragments, 16, UiTheme.GLOW))
	v.add_child(frag)
	v.add_child(UiTheme.label("Hechizo final:", 14, UiTheme.MUTED))
	v.add_child(UiTheme.label(run.spell.display_name(), 18, UiTheme.TEXT))
	if not discovered.is_empty():
		v.add_child(UiTheme.label("¡%d hechizo(s) nuevo(s) en el compendio!" % discovered.size(), 14, UiTheme.GREEN))
	var again := UiTheme.button("Otra partida", Vector2(220, 48))
	again.pressed.connect(func() -> void: start_run())
	_center(v, again)
	var menu := UiTheme.button("Menú", Vector2(220, 40), UiTheme.PANEL)
	menu.pressed.connect(show_menu)
	_center(v, menu)
