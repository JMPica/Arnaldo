extends Node
## Permanent progression (autoload "Progression"), saved locally:
## Seal Fragments, the combination compendium, best results and settings.
## Atomic writes (temp file + rename); a corrupt save is kept aside, never fatal.
## By design there are no permanent damage multipliers (GDD section 15).

signal changed

const SAVE_VERSION := 1

var save_path := "user://rune_shift_save.json"
var data: Dictionary = {}


func _ready() -> void:
	load_or_reset()


static func default_data() -> Dictionary:
	return {
		"version": SAVE_VERSION,
		"fragments": 0,
		"runs": 0,
		"victories": 0,
		"best_room": 0,
		"boss_kills": 0,
		"compendium": {},
		"settings": {"sfx": true, "music": true},
		"first_session_done": false,
	}


func load_or_reset() -> void:
	data = default_data()
	if not FileAccess.file_exists(save_path):
		return
	var parsed = JSON.parse_string(FileAccess.get_file_as_string(save_path))
	if not parsed is Dictionary or not parsed.get("fragments") is float or not parsed.get("compendium") is Dictionary:
		push_warning("Progression: invalid save, keeping a copy and starting fresh")
		DirAccess.copy_absolute(ProjectSettings.globalize_path(save_path), ProjectSettings.globalize_path(save_path + ".corrupt"))
		return
	for k in parsed.keys():
		data[k] = parsed[k]
	for k in ["fragments", "runs", "victories", "best_room", "boss_kills"]:
		data[k] = int(data[k])


func save() -> bool:
	var tmp := save_path + ".tmp"
	var f := FileAccess.open(tmp, FileAccess.WRITE)
	if f == null:
		push_error("Progression: cannot write %s" % tmp)
		return false
	f.store_string(JSON.stringify(data, "\t"))
	f.close()
	var err := DirAccess.rename_absolute(ProjectSettings.globalize_path(tmp), ProjectSettings.globalize_path(save_path))
	if err != OK:
		push_error("Progression: rename failed (%s)" % error_string(err))
		return false
	changed.emit()
	return true


func record_run(victory: bool, rooms_cleared: int, fragments: int, combos: Array) -> Array[String]:
	data["runs"] = int(data["runs"]) + 1
	data["fragments"] = int(data["fragments"]) + fragments
	data["best_room"] = maxi(int(data["best_room"]), rooms_cleared)
	if victory:
		data["victories"] = int(data["victories"]) + 1
		data["boss_kills"] = int(data["boss_kills"]) + 1
	var discovered: Array[String] = []
	for c in combos:
		# Only complete spells (form + element + catalyst) enter the compendium.
		if c.count("-") == 0 and not data["compendium"].has(c):
			data["compendium"][c] = true
			discovered.append(c)
	save()
	return discovered


func compendium_count() -> int:
	return data["compendium"].size()


func setting(key: String) -> bool:
	return bool(data["settings"].get(key, true))


func set_setting(key: String, value: bool) -> void:
	data["settings"][key] = value
	save()


func reset_all() -> void:
	data = default_data()
	save()
