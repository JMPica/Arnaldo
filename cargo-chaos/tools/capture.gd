extends Node
## Renders real frames of a mission flown by the autopilot and saves PNGs.
## Needs a display (use xvfb-run). See tools/capture.sh.
## Args (after --): --level=0 --times=1,3,5 --out=res://tests/output/shots --menu

var _times: Array[float] = []
var _out := "res://tests/output/shots"
var _level := 0
var _t := 0.0
var _scene: Node
var _prefix := ""
var _destroy_at := -1.0
var _pause_at := -1.0
var _manual := false


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	var menu := false
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--level="):
			_level = int(arg.get_slice("=", 1))
		elif arg.begins_with("--times="):
			for s in arg.get_slice("=", 1).split(","):
				_times.append(float(s))
		elif arg.begins_with("--out="):
			_out = arg.get_slice("=", 1)
		elif arg == "--menu":
			menu = true
		elif arg.begins_with("--destroy-at="):
			_destroy_at = float(arg.get_slice("=", 1))
		elif arg.begins_with("--pause-at="):
			_pause_at = float(arg.get_slice("=", 1))
		elif arg == "--no-bot":
			_manual = true
	# Never touch the developer's real save or analytics log.
	Progress.save_path = "user://capture_save.json"
	Analytics.enabled = false
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(_out))
	if menu:
		_prefix = "menu"
		_scene = load("res://scenes/main/main_menu.tscn").instantiate()
	else:
		_prefix = "level%02d" % (_level + 1)
		var gs := GameScene.new()
		gs.data = Game.data
		gs.level_index = _level
		if not _manual:
			gs.autopilot = Autopilot.new(Game.data.levels[_level])
		_scene = gs
	_scene.process_mode = Node.PROCESS_MODE_PAUSABLE
	add_child(_scene)
	if _times.is_empty():
		_times = [1.0]


func _process(delta: float) -> void:
	_t += delta
	var gs := _scene as GameScene
	if gs and _destroy_at > 0.0 and _t >= _destroy_at:
		_destroy_at = -1.0
		gs.rig.integrity.apply(200.0, "a billboard", "impact")
	if gs and _pause_at > 0.0 and _t >= _pause_at:
		_pause_at = -1.0
		gs._toggle_pause()
	if not _times.is_empty() and _t >= _times[0]:
		var when: float = _times.pop_front()
		await RenderingServer.frame_post_draw
		var img := get_viewport().get_texture().get_image()
		var path := "%s/%s_t%05.1f.png" % [_out, _prefix, when]
		img.save_png(ProjectSettings.globalize_path(path))
		print("saved ", path)
	if _times.is_empty():
		get_tree().quit()
