extends Node
## Real screenshots of the running game (needs a display: tools/capture.sh).
## Args: --times=1,5,9 --seed=7 --form=orb --element=fire --catalyst=echo --menu --out=res://tests/output/shots --prefix=x

var _times: Array[float] = []
var _out := "res://tests/output/shots"
var _prefix := "run"
var _t := 0.0
var _app: Node


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	var seed_v := 7
	var menu := false
	var prefs := {}
	for a in OS.get_cmdline_user_args():
		var v := a.get_slice("=", 1)
		if a.begins_with("--times="):
			for x in v.split(","): _times.append(float(x))
		elif a.begins_with("--seed="): seed_v = int(v)
		elif a.begins_with("--out="): _out = v
		elif a.begins_with("--prefix="): _prefix = v
		elif a.begins_with("--form="): prefs["form"] = v
		elif a.begins_with("--element="): prefs["element"] = v
		elif a.begins_with("--catalyst="): prefs["catalyst"] = v
		elif a == "--menu": menu = true
	Progression.save_path = "user://capture_save.json"
	Progression.load_or_reset()
	Analytics.enabled = false
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(_out))
	_app = load("res://scenes/main.tscn").instantiate()
	add_child(_app)
	if not menu:
		var bot := Bot.new(seed_v, 0.8)
		bot.preferred = prefs
		_app.autopilot = bot
		_app.auto_choose_delay = 2.5
		_app.start_run(seed_v)


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
