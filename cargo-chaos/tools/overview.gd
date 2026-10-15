extends Node
## Renders a whole level into one wide image, with the autopilot reference path
## (yellow) and the trajectories actually flown by the bot: courier (cyan) and
## cargo (magenta). The level-design companion of the completability tests.
## Args (after --): --level=0 --out=res://tests/output/overview

var _level := 0
var _out := "res://tests/output/overview"
var _sv: SubViewport
var _gs: GameScene
var _courier_line: Line2D
var _cargo_line: Line2D
var _frame := 0
var _done_at := -1.0
var _t := 0.0
var _result := "timeout"


func _ready() -> void:
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--level="):
			_level = int(arg.get_slice("=", 1))
		elif arg.begins_with("--out="):
			_out = arg.get_slice("=", 1)
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(_out))
	var lv: LevelData = Game.data.levels[_level]
	_sv = SubViewport.new()
	_sv.size = Vector2i(int(lv.length) + 100, 720)
	_sv.render_target_update_mode = SubViewport.UPDATE_DISABLED
	add_child(_sv)
	_gs = GameScene.new()
	_gs.data = Game.data
	_gs.level_index = _level
	_gs.test_mode = true
	_gs.autopilot = Autopilot.new(lv)
	_sv.add_child(_gs)
	_gs.camera.enabled = false
	_gs.finished.connect(func(ok: bool, reason: String) -> void:
		_result = ("SUCCESS " if ok else "FAILED ") + reason
		_done_at = _t + 1.2)
	_gs.rig.integrity.damaged.connect(func(amount: float, source: String, kind: String) -> void:
		if kind == "impact" or amount > 0.5:
			print("  dmg %5.1f %-7s %-18s at x=%5.0f t=%5.2f" % [amount, kind, source, _gs.rig.model.cargo_pos.x, _gs.mission.elapsed]))
	var path := Line2D.new()
	path.points = lv.autopilot_path
	path.width = 3
	path.default_color = Color(1, 0.9, 0.1, 0.9)
	path.z_index = 40
	_gs.add_child(path)
	_courier_line = _trail(Color(0.1, 0.9, 1.0, 0.9))
	_cargo_line = _trail(Color(1.0, 0.2, 0.8, 0.9))


func _trail(c: Color) -> Line2D:
	var l := Line2D.new()
	l.width = 3
	l.default_color = c
	l.z_index = 41
	_gs.add_child(l)
	return l


func _physics_process(delta: float) -> void:
	_t += delta
	_frame += 1
	if _frame % 3 == 0:
		_courier_line.add_point(_gs.rig.model.courier_pos)
		if _gs.rig.model.cargo_attached:
			_cargo_line.add_point(_gs.rig.model.cargo_pos)
	if (_done_at > 0.0 and _t >= _done_at) or _t > 120.0:
		set_physics_process(false)
		_save()


func _save() -> void:
	_sv.render_target_update_mode = SubViewport.UPDATE_ONCE
	await RenderingServer.frame_post_draw
	await RenderingServer.frame_post_draw
	var img := _sv.get_texture().get_image()
	var path := "%s/level%02d_overview.png" % [_out, _level + 1]
	img.save_png(ProjectSettings.globalize_path(path))
	print("RESULT level %d: %s | integrity %.1f | time %.2fs" % [_level + 1, _result, _gs.rig.integrity.value, _gs.mission.elapsed])
	print("saved ", path)
	get_tree().quit()
