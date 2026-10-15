class_name GameData
extends RefCounted
## Loads and validates the JSON data files. All game content lives in data/.

const TUNING_PATH := "res://data/tuning.json"
const CARGO_PATH := "res://data/cargo_types.json"
const OBSTACLES_PATH := "res://data/obstacle_types.json"
const LEVEL_INDEX_PATH := "res://data/levels/index.json"

var flight: FlightParams
var world: Dictionary = {}
var cargo_types: Dictionary = {}     ## id -> CargoType
var obstacle_types: Dictionary = {}  ## id -> Dictionary
var levels: Array[LevelData] = []
var errors: Array[String] = []


static func read_json(path: String) -> Variant:
	if not FileAccess.file_exists(path):
		push_error("GameData: missing file %s" % path)
		return null
	var text := FileAccess.get_file_as_string(path)
	var json := JSON.new()
	var err := json.parse(text)
	if err != OK:
		push_error("GameData: %s line %d: %s" % [path, json.get_error_line(), json.get_error_message()])
		return null
	return json.data


## Loads everything. Returns true when the data is valid.
func load_all() -> bool:
	errors.clear()
	var tuning = read_json(TUNING_PATH)
	if not tuning is Dictionary:
		errors.append("tuning.json could not be read")
		return false
	flight = FlightParams.from_dict(tuning.get("courier", {}))
	world = tuning.get("world", {})

	var cargo_dict = read_json(CARGO_PATH)
	if not cargo_dict is Dictionary:
		errors.append("cargo_types.json could not be read")
		return false
	for id in cargo_dict.keys():
		cargo_types[id] = CargoType.from_dict(id, cargo_dict[id])

	var obs = read_json(OBSTACLES_PATH)
	if not obs is Dictionary:
		errors.append("obstacle_types.json could not be read")
		return false
	obstacle_types = obs

	var index = read_json(LEVEL_INDEX_PATH)
	if not index is Dictionary or not index.get("levels") is Array:
		errors.append("levels/index.json must contain a 'levels' array")
		return false
	for file_name in index["levels"]:
		var path := "res://data/levels/%s" % file_name
		var d = read_json(path)
		if not d is Dictionary:
			errors.append("%s could not be read" % path)
			continue
		var level_errors: Array[String] = []
		var lv := LevelData.from_dict(d, world, obstacle_types, level_errors)
		if lv.cargo_id != "" and not cargo_types.has(lv.cargo_id):
			level_errors.append("unknown cargo '%s'" % lv.cargo_id)
		for e in level_errors:
			errors.append("%s: %s" % [file_name, e])
		if level_errors.is_empty():
			levels.append(lv)
	for e in errors:
		push_error("GameData: " + e)
	return errors.is_empty()


func cargo_for(level: LevelData) -> CargoType:
	return cargo_types.get(level.cargo_id)


func level_index_of(level_id: String) -> int:
	for i in levels.size():
		if levels[i].id == level_id:
			return i
	return -1
