extends Node
## Game flow (autoload "Game"): loads the data, tracks the current mission and
## moves between screens with a short fade.

const MENU_SCENE := "res://scenes/main/main_menu.tscn"
const GAME_SCENE := "res://scenes/main/game.tscn"

var data: GameData
var current_level_index := 0
var retries_in_a_row := 0
var _fade_layer: CanvasLayer
var _fade: ColorRect
var _changing := false


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	_register_input()
	UiKit.init()
	data = GameData.new()
	if not data.load_all():
		push_error("Game: data errors: %s" % ", ".join(data.errors))
	_fade_layer = CanvasLayer.new()
	_fade_layer.layer = 100
	_fade = ColorRect.new()
	_fade.color = Color(0.06, 0.04, 0.12, 0.0)
	_fade.set_anchors_preset(Control.PRESET_FULL_RECT)
	_fade.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_fade_layer.add_child(_fade)
	add_child(_fade_layer)


static func _register_input() -> void:
	var actions := {
		"thrust": [KEY_SPACE, KEY_UP, KEY_W],
		"pause": [KEY_ESCAPE, KEY_P],
		"restart": [KEY_R],
	}
	for action in actions.keys():
		if not InputMap.has_action(action):
			InputMap.add_action(action)
		for key in actions[action]:
			var ev := InputEventKey.new()
			ev.physical_keycode = key
			InputMap.action_add_event(action, ev)


func level_count() -> int:
	return data.levels.size()


func current_level() -> LevelData:
	return data.levels[clampi(current_level_index, 0, data.levels.size() - 1)]


func has_next_level() -> bool:
	return current_level_index + 1 < data.levels.size()


## The mission the PLAY button should open: the first unfinished unlocked one.
func suggested_level_index() -> int:
	for i in data.levels.size():
		if Progress.is_unlocked(i) and Progress.best_stars(data.levels[i].id) == 0:
			return i
	return 0


func start_level(index: int) -> void:
	if index != current_level_index:
		retries_in_a_row = 0
	current_level_index = clampi(index, 0, data.levels.size() - 1)
	change_scene(GAME_SCENE)


func restart_level() -> void:
	retries_in_a_row += 1
	Analytics.track("retry_selected", {"level": current_level().id, "retries_in_a_row": retries_in_a_row})
	change_scene(GAME_SCENE)


func next_level() -> void:
	if has_next_level():
		start_level(current_level_index + 1)
	else:
		go_to_menu()


func go_to_menu() -> void:
	change_scene(MENU_SCENE)


func change_scene(path: String) -> void:
	if _changing:
		return
	_changing = true
	var tw := create_tween()
	tw.tween_property(_fade, "color:a", 1.0, 0.18)
	await tw.finished
	get_tree().paused = false
	get_tree().change_scene_to_file(path)
	await get_tree().process_frame
	var tw2 := create_tween()
	tw2.tween_property(_fade, "color:a", 0.0, 0.22)
	_changing = false
