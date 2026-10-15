class_name GameScene
extends Node2D
## A delivery in progress. Builds the level, the rig and the UI, reads the
## single input, runs the mission rules and turns events into feedback.
##
## Physics order each tick (deterministic): movers -> rig -> mission rules.

signal finished(success: bool, reason: String)

const RESULTS_DELAY := 1.5

var data: GameData
var level: LevelData
var level_index := 0
var cargo: CargoType
var world: LevelWorld
var rig: CourierRig
var mission: Mission
var camera: GameCamera
var hud: Hud
var menus: OverlayMenus
var fx_layer: Node2D
var background: CityBackground

## When set, the bot presses the button instead of the player (tests, attract mode).
var autopilot: Autopilot = null
## Tests disable UI, sounds and the results screen.
var test_mode := false

var _pointer_held := false
var _next_hint := 0
var _end_timer := -1.0
var _results_shown := false
var _feedback_cooldown := 0.0
var _px_per_meter := 40.0
var _final_integrity := 100.0


func _ready() -> void:
	# Normally the level comes from the Game autoload; tests set `data` and
	# `level_index` before adding the scene to the tree.
	if data == null:
		var game := get_node("/root/Game")
		data = game.data
		level_index = game.current_level_index
	_build()


func _build() -> void:
	level = data.levels[level_index]
	cargo = data.cargo_for(level)
	_px_per_meter = float(data.world.get("pixels_per_meter", 40))
	LevelTheme.current = level.theme

	background = CityBackground.new()
	add_child(background)
	background.build(level.theme, hash(level.id))

	world = LevelWorld.new()
	add_child(world)
	world.build(level, data)
	world.advance_movers(0.0, 1.0 / 60.0)

	rig = CourierRig.new()
	add_child(rig)
	rig.setup(data.flight, cargo, level.start, level.fragility_multiplier)
	rig.cargo_impact.connect(_on_cargo_impact)
	rig.courier_bonk.connect(_on_bonk)
	rig.courier_landed.connect(_on_landed)
	rig.integrity.damaged.connect(_on_damaged)

	fx_layer = Node2D.new()
	fx_layer.z_index = 20
	add_child(fx_layer)

	camera = GameCamera.new()
	add_child(camera)
	camera.make_current()
	camera.follow(level.start.x, level.length)

	mission = Mission.new(level, cargo.display_name, data.world)
	mission.finished.connect(_on_mission_finished)

	if not test_mode:
		hud = Hud.new()
		add_child(hud)
		hud.build(level, cargo)
		hud.pause_pressed.connect(_toggle_pause)
		menus = OverlayMenus.new()
		add_child(menus)
		menus.resume_requested.connect(_toggle_pause)
		menus.restart_requested.connect(func() -> void: _game().restart_level())
		menus.next_requested.connect(func() -> void: _game().next_level())
		menus.menu_requested.connect(func() -> void: _game().go_to_menu())
		_show_due_hints(level.start.x)


func _game() -> Node:
	return get_node("/root/Game")


func _analytics(event: String, props: Dictionary) -> void:
	var a := get_node_or_null("/root/Analytics")
	if a and not test_mode:
		a.track(event, props)


func _sfx(sound: String, volume_db := 0.0, pitch := 1.0) -> void:
	var s := get_node_or_null("/root/Sfx")
	if s and not test_mode:
		s.play(sound, volume_db, pitch)


# ---------------------------------------------------------------- input ----

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT:
		_pointer_held = event.pressed
	elif event.is_action_pressed("pause"):
		_toggle_pause()
	elif event.is_action_pressed("restart") and not get_tree().paused:
		_game().restart_level()


func _notification(what: int) -> void:
	# Losing focus (phone call, app switch) pauses the delivery: never punish
	# the player for something outside the game.
	if what == NOTIFICATION_APPLICATION_FOCUS_OUT or what == NOTIFICATION_APPLICATION_PAUSED:
		_pointer_held = false
		if mission and mission.is_playing() and not get_tree().paused and not test_mode:
			_toggle_pause()


func thrust_input() -> bool:
	if autopilot:
		return autopilot.wants_thrust(rig.model.courier_pos, rig.model.courier_vel,
				mission.state == Mission.State.BRAKING)
	return _pointer_held or Input.is_action_pressed("thrust")


func _toggle_pause() -> void:
	if menus == null or mission.is_over():
		return
	if get_tree().paused:
		get_tree().paused = false
		menus.close()
	else:
		_pointer_held = false
		get_tree().paused = true
		menus.show_pause()
		_set_jet_sound(0.0)


# -------------------------------------------------------------- physics ----

func _physics_process(delta: float) -> void:
	_feedback_cooldown -= delta
	if mission.state == Mission.State.READY:
		if thrust_input() or autopilot != null:
			_begin()
		else:
			rig.physics_step(delta)
			camera.follow(rig.model.courier_pos.x, level.length)
			return

	world.advance_movers(mission.elapsed + delta, delta)
	var playing := mission.is_playing()
	rig.thrusting = playing and thrust_input()
	rig.target_speed = mission.target_speed_at(rig.model.courier_pos.x)
	rig.model.landing_mode = mission.state != Mission.State.RUNNING
	rig.physics_step(delta)

	var on_pad := rig.cargo_contact_body == world.pad and rig.cargo_contact_normal.y < -0.5
	var tilt_ok := not cargo.is_tilt_sensitive() or absf(rig.model.tilt_degrees()) < cargo.tilt_limit_deg
	mission.tick(delta, {
		"courier_x": rig.model.courier_pos.x,
		"integrity": rig.integrity,
		"cargo_on_pad": on_pad,
		"cargo_speed": rig.cargo_speed(),
		"cargo_tilt_ok": tilt_ok,
	})
	camera.follow(rig.model.courier_pos.x, level.length)
	if playing:
		_show_due_hints(rig.model.courier_pos.x)

	if mission.is_over() and not _results_shown:
		_end_timer -= delta
		if _end_timer <= 0.0:
			_show_results()


func _process(delta: float) -> void:
	if hud:
		var meters := (level.pad_center_x - rig.model.courier_pos.x) / _px_per_meter
		hud.update_status(rig.integrity, meters, mission.time_left(), rig.is_tilt_warning(), delta)
	_set_jet_sound(rig.model.thrust_level if mission.is_playing() else 0.0)


func _set_jet_sound(level_value: float) -> void:
	var s := get_node_or_null("/root/Sfx")
	if s and not test_mode:
		s.set_jet(level_value)


func _begin() -> void:
	mission.start()
	rig.simulate = true
	if hud:
		hud.set_ready_prompt(false)
	_sfx("start")
	_analytics("delivery_started", {"level": level.id, "cargo": cargo.id})
	if level.is_tutorial:
		_analytics("tutorial_started", {"level": level.id})


func _show_due_hints(x: float) -> void:
	while _next_hint < level.hints.size() and x >= level.hints[_next_hint]["x"]:
		if hud:
			hud.show_hint(level.hints[_next_hint]["text"])
		_next_hint += 1


# ------------------------------------------------------------- feedback ----

func _cargo_color() -> Color:
	match cargo.art:
		"heavy_piano": return Palette.PIANO_LIGHT
		"birthday_cake": return Palette.CAKE_PINK
		_: return Palette.GLASS_EDGE


func _on_cargo_impact(point: Vector2, speed: float, damage: float, label: String) -> void:
	if damage > 0.0:
		Fx.burst(fx_layer, point, _cargo_color(), clampi(int(damage), 6, 18), 160.0 + damage * 6.0)
		Fx.floating_text(fx_layer, point + Vector2(0, -30), "-%d%%" % maxi(1, roundi(damage)), Palette.DANGER, 30)
		camera.add_trauma(0.18 + damage / 70.0)
		rig.cargo_art.hit_flash()
		if hud:
			hud.on_damage()
		var hit_sound: String = {"heavy_piano": "hit_piano", "birthday_cake": "hit_cake"}.get(cargo.art, "hit_glass")
		_sfx(hit_sound, linear_to_db(clampf(0.4 + damage / 40.0, 0.4, 1.0)))
		_analytics("cargo_damaged", {"level": level.id, "amount": snappedf(damage, 0.1), "source": label,
				"kind": "impact", "speed": roundi(speed), "x": roundi(point.x), "integrity": roundi(rig.integrity.value)})
	else:
		Fx.dust(fx_layer, point)
		_sfx("thud", -8.0)


func _on_damaged(amount: float, source: String, kind: String) -> void:
	if kind == "impact" or _feedback_cooldown > 0.0:
		return
	# Continuous damage (tilt, scrape): readable feedback without spamming.
	_feedback_cooldown = 0.45
	var p := rig.model.cargo_pos + Vector2(0, -50)
	Fx.floating_text(fx_layer, p, "TILT!" if kind == "tilt" else "SCRAPE!", Palette.WARN, 26)
	rig.cargo_art.hit_flash()
	if hud:
		hud.on_damage()


func _on_bonk(point: Vector2, _speed: float) -> void:
	Fx.floating_text(fx_layer, point + Vector2(-10, -40), "BONK!", Palette.GOGGLE, 32)
	Fx.burst(fx_layer, point, Palette.GOGGLE, 8, 200.0, 5.0, 0.4)
	camera.add_trauma(0.25)
	_sfx("bonk")


func _on_landed(point: Vector2, speed: float) -> void:
	if speed > 150.0:
		Fx.dust(fx_layer, point)
		_sfx("land", -6.0)


func _on_mission_finished(success: bool, reason: String) -> void:
	_end_timer = RESULTS_DELAY
	rig.thrusting = false
	rig.invulnerable = true
	_final_integrity = rig.integrity.value
	if success:
		rig.courier_art.pose = CourierArt.Pose.HAPPY
		rig.cargo_art.delivered = true
		Fx.confetti(fx_layer, rig.model.cargo_pos + Vector2(0, -40))
		Fx.floating_text(fx_layer, rig.model.cargo_pos + Vector2(0, -80), "DELIVERED!", Palette.GOOD, 44)
		_sfx("success")
	else:
		rig.courier_art.pose = CourierArt.Pose.SAD
		if rig.integrity.is_destroyed():
			Fx.debris(fx_layer, rig.model.cargo_pos, cargo.art)
			rig.detach_cargo()
			camera.add_trauma(0.7)
			var crash: String = {"heavy_piano": "crash_piano", "birthday_cake": "splat"}.get(cargo.art, "shatter")
			_sfx(crash)
		_sfx("fail", -4.0)
	finished.emit(success, reason)


func _show_results() -> void:
	_results_shown = true
	var integrity := _final_integrity
	var success := mission.state == Mission.State.SUCCESS
	var stars := Mission.stars_for(integrity) if success else 0
	var coins := Mission.coins_for(level.reward_coins, integrity) if success else 0
	var event_props := {"level": level.id, "cargo": cargo.id, "time": snappedf(mission.elapsed, 0.01),
			"integrity": roundi(integrity), "hits": rig.integrity.total_hits}
	if success:
		event_props["stars"] = stars
		_analytics("delivery_completed", event_props)
		if level.is_tutorial:
			_analytics("tutorial_completed", {"level": level.id, "time": snappedf(mission.elapsed, 0.01)})
	else:
		event_props["reason"] = mission.result_reason
		event_props["cause"] = rig.integrity.last_kind if rig.integrity.is_destroyed() else "timeout"
		event_props["x"] = roundi(rig.model.courier_pos.x)
		_analytics("delivery_failed", event_props)
	if test_mode or menus == null:
		return
	var progress := get_node("/root/Progress")
	progress.record_result(level.id, level_index, success, integrity, stars, coins, mission.elapsed)
	get_node("/root/Ads").on_delivery_finished()
	menus.show_results({
		"success": success, "reason": mission.result_reason, "integrity": integrity, "stars": stars,
		"time": mission.elapsed, "coins": coins, "has_next": _game().has_next_level(),
		"is_last": success and not _game().has_next_level(),
	})
	get_node("/root/Ads").maybe_show_interstitial()
