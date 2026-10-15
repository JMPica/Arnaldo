class_name OverlayMenus
extends CanvasLayer
## Pause menu and results screen shown over the game.
## process_mode is ALWAYS so it keeps working while the tree is paused.

signal resume_requested
signal restart_requested
signal next_requested
signal menu_requested

var _root: Control
var _dim: ColorRect
var _current: Control


func _ready() -> void:
	layer = 20
	process_mode = Node.PROCESS_MODE_ALWAYS
	_root = Control.new()
	_root.set_anchors_preset(Control.PRESET_FULL_RECT)
	_root.theme = UiKit.theme()
	_root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_root)
	_dim = ColorRect.new()
	_dim.color = Color(0.06, 0.04, 0.12, 0.6)
	_dim.set_anchors_preset(Control.PRESET_FULL_RECT)
	_dim.visible = false
	_root.add_child(_dim)


func is_open() -> bool:
	return _current != null


func close() -> void:
	if _current:
		_current.queue_free()
		_current = null
	_dim.visible = false


func _open_panel(title: String, title_color: Color) -> VBoxContainer:
	close()
	_dim.visible = true
	var center := CenterContainer.new()
	center.set_anchors_preset(Control.PRESET_FULL_RECT)
	_root.add_child(center)
	_current = center
	var p := UiKit.panel()
	center.add_child(p)
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 14)
	v.alignment = BoxContainer.ALIGNMENT_CENTER
	p.add_child(v)
	v.add_child(UiKit.label(title, 60, title_color, 12))
	UiKit.pop_in(p)
	return v


func show_pause() -> void:
	var v := _open_panel("PAUSED", Palette.WHITE)
	var resume := UiKit.button("RESUME", UiKit.BTN_GOOD, Vector2(340, 84))
	resume.pressed.connect(func() -> void: resume_requested.emit())
	v.add_child(resume)
	var restart := UiKit.button("RESTART", UiKit.BTN_PRIMARY, Vector2(340, 84))
	restart.pressed.connect(func() -> void: restart_requested.emit())
	v.add_child(restart)
	var menu := UiKit.button("MENU", UiKit.BTN_SECONDARY, Vector2(340, 84))
	menu.pressed.connect(func() -> void: menu_requested.emit())
	v.add_child(menu)
	resume.grab_focus.call_deferred()


## info: success, reason, integrity, stars, time, coins, has_next, best_stars, is_last
func show_results(info: Dictionary) -> void:
	var success: bool = info["success"]
	var v := _open_panel("DELIVERED!" if success else "DELIVERY FAILED", Palette.GOOD if success else Palette.DANGER)
	var reason := UiKit.label(info["reason"], 26, Palette.WHITE, 6)
	reason.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	reason.custom_minimum_size = Vector2(560, 0)
	v.add_child(reason)
	if success:
		var stars := StarsRow.new()
		stars.count = info["stars"]
		stars.custom_minimum_size = Vector2(300, 80)
		v.add_child(stars)
		var stats := UiKit.label("Integrity %d%%   ·   Time %.1fs   ·   +%d coins" % [
				roundi(info["integrity"]), info["time"], info["coins"]], 24, Color(1, 1, 1, 0.9), 6)
		v.add_child(stats)
		if info.get("is_last", false):
			v.add_child(UiKit.label("All deliveries complete. You're a legend!", 24, Palette.GOGGLE, 6))
	var row := HBoxContainer.new()
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	row.add_theme_constant_override("separation", 16)
	v.add_child(row)
	var retry := UiKit.button("RETRY" if not success else "RESTART",
			UiKit.BTN_PRIMARY if not success else UiKit.BTN_SECONDARY, Vector2(220, 84))
	retry.pressed.connect(func() -> void: restart_requested.emit())
	var menu := UiKit.button("MENU", UiKit.BTN_SECONDARY, Vector2(180, 84))
	menu.pressed.connect(func() -> void: menu_requested.emit())
	row.add_child(menu)
	row.add_child(retry)
	if success and info.get("has_next", false):
		var next := UiKit.button("NEXT DELIVERY", UiKit.BTN_GOOD, Vector2(300, 84))
		next.pressed.connect(func() -> void: next_requested.emit())
		row.add_child(next)
		next.grab_focus.call_deferred()
	else:
		retry.grab_focus.call_deferred()


class StarsRow extends Control:
	var count := 0
	var _t := 0.0

	func _process(delta: float) -> void:
		_t += delta
		queue_redraw()

	func _draw() -> void:
		for i in 3:
			var appear := clampf((_t - 0.25 - i * 0.22) * 5.0, 0.0, 1.0)
			var c := Vector2(size.x * 0.5 + (i - 1) * 90.0, size.y * 0.5 + (0 if i == 1 else 8))
			var r := 34.0 if i == 1 else 28.0
			var filled := i < count
			var s := r * (1.0 if not filled else (0.4 + 0.6 * appear + 0.25 * sin(appear * PI)))
			var pts := PackedVector2Array()
			for k in 10:
				var a := -PI / 2 + TAU * k / 10.0
				pts.append(c + Vector2(cos(a), sin(a)) * (s if k % 2 == 0 else s * 0.45))
			DrawUtil.polygon(self, pts, Palette.GOGGLE if filled and appear > 0.0 else Color(0.3, 0.27, 0.45), Palette.OUTLINE, 4)
