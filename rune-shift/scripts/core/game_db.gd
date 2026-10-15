class_name GameDB
extends RefCounted
## Loads the editable data (data/*.json) once. Runes, enemies and rooms are
## defined there: balancing never requires touching code.

static var _instance: GameDB

var runes: Dictionary = {}
var enemies: Dictionary = {}
var rooms: Dictionary = {}
var errors: Array[String] = []


static func get_db() -> GameDB:
	if _instance == null:
		_instance = GameDB.new()
		_instance.load_all()
	return _instance


static func read_json(path: String) -> Variant:
	var text := FileAccess.get_file_as_string(path)
	if text == "":
		push_error("GameDB: cannot read %s" % path)
		return null
	var json := JSON.new()
	if json.parse(text) != OK:
		push_error("GameDB: %s line %d: %s" % [path, json.get_error_line(), json.get_error_message()])
		return null
	return json.data


func load_all() -> bool:
	errors.clear()
	runes = _load("res://data/runes.json")
	enemies = _load("res://data/enemies.json")
	rooms = _load("res://data/rooms.json")
	_validate()
	for e in errors:
		push_error("GameDB: " + e)
	return errors.is_empty()


func _load(path: String) -> Dictionary:
	var d = read_json(path)
	if d is Dictionary:
		return d
	errors.append("%s could not be loaded" % path)
	return {}


func _validate() -> void:
	for family in ["forms", "elements", "catalysts"]:
		if not runes.has(family) or runes[family].size() != 3:
			errors.append("runes.json: '%s' must define 3 runes" % family)
	for kind in ["crawler", "archer", "charger", "guardian", "boss", "player"]:
		if not enemies.has(kind):
			errors.append("enemies.json: missing '%s'" % kind)
	var run: Array = rooms.get("run", [])
	if run.size() != 9:
		errors.append("rooms.json: a run must have 8 rooms + boss (found %d)" % run.size())
	for i in run.size():
		for t in run[i].get("templates", []):
			if not rooms.get("templates", {}).has(t):
				errors.append("rooms.json: room %d uses unknown template '%s'" % [i + 1, t])
		for wave in run[i].get("waves", []):
			for group in wave:
				if not enemies.has(group[0]):
					errors.append("rooms.json: room %d unknown enemy '%s'" % [i + 1, group[0]])
				if group.size() > 2 and not enemies["elites"].has(group[2]):
					errors.append("rooms.json: room %d unknown elite '%s'" % [i + 1, group[2]])


func rune(family: String, id: String) -> Dictionary:
	return runes.get(family, {}).get(id, {})


## Reads a rune parameter; arrays are per level (1-based, clamped).
static func param(def: Dictionary, name: String, level := 1, fallback = 0.0):
	var v = def.get(name, fallback)
	if v is Array:
		return v[clampi(level - 1, 0, v.size() - 1)]
	return v


func rune_ids(family: String) -> Array:
	var ids: Array = runes.get(family, {}).keys()
	ids.sort()
	return ids
