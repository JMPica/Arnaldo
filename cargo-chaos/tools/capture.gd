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


func _ready() -> void:
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
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(_out))
	if menu:
		_prefix = "menu"
		_scene = load("res://scenes/main/main_menu.tscn").instantiate()
	else:
		_prefix = "level%02d" % (_level + 1)
		var gs := GameScene.new()
		gs.data = Game.data
		gs.level_index = _level
		gs.autopilot = Autopilot.new(Game.data.levels[_level])
		_scene = gs
	add_child(_scene)
	if _times.is_empty():
		_times = [1.0]


func _process(delta: float) -> void:
	_t += delta
	if not _times.is_empty() and _t >= _times[0]:
		var when: float = _times.pop_front()
		await RenderingServer.frame_post_draw
		var img := get_viewport().get_texture().get_image()
		var path := "%s/%s_t%05.1f.png" % [_out, _prefix, when]
		img.save_png(ProjectSettings.globalize_path(path))
		print("saved ", path)
	if _times.is_empty():
		get_tree().quit()
