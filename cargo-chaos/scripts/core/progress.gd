extends Node
## Local save (autoload "Progress"): unlocked missions, best results, coins,
## settings. Written atomically (temp file + rename) and validated on load; a
## corrupt save is backed up and replaced instead of crashing the game.

signal changed

const SAVE_VERSION := 1

var save_path := "user://save.json"
var data: Dictionary = {}


func _ready() -> void:
	load_or_reset()


static func default_data() -> Dictionary:
	return {
		"version": SAVE_VERSION,
		"coins": 0,
		"unlocked": 1,
		"levels": {},
		"settings": {"sfx": true},
		"stats": {"deliveries": 0, "failures": 0, "attempts": 0},
	}


func load_or_reset() -> void:
	data = default_data()
	if not FileAccess.file_exists(save_path):
		return
	var text := FileAccess.get_file_as_string(save_path)
	var parsed = JSON.parse_string(text)
	if not parsed is Dictionary or not _is_valid(parsed):
		push_warning("Progress: save file invalid, backing it up and starting fresh")
		DirAccess.copy_absolute(ProjectSettings.globalize_path(save_path),
				ProjectSettings.globalize_path(save_path + ".corrupt"))
		return
	# Merge onto defaults so new fields added in later versions get values.
	for key in parsed.keys():
		data[key] = parsed[key]
	data["coins"] = int(data["coins"])
	data["unlocked"] = int(data["unlocked"])


func _is_valid(d: Dictionary) -> bool:
	return d.get("version") is float and d.get("coins") is float and d.get("unlocked") is float \
			and d.get("levels") is Dictionary and int(d["version"]) <= SAVE_VERSION


func save() -> bool:
	var tmp := save_path + ".tmp"
	var f := FileAccess.open(tmp, FileAccess.WRITE)
	if f == null:
		push_error("Progress: cannot write %s (%s)" % [tmp, error_string(FileAccess.get_open_error())])
		return false
	f.store_string(JSON.stringify(data, "\t"))
	f.close()
	var err := DirAccess.rename_absolute(ProjectSettings.globalize_path(tmp), ProjectSettings.globalize_path(save_path))
	if err != OK:
		push_error("Progress: rename failed (%s)" % error_string(err))
		return false
	changed.emit()
	return true


func is_unlocked(level_index: int) -> bool:
	return level_index < int(data["unlocked"])


func level_record(level_id: String) -> Dictionary:
	return data["levels"].get(level_id, {})


func best_stars(level_id: String) -> int:
	return int(level_record(level_id).get("stars", 0))


func total_stars() -> int:
	var total := 0
	for id in data["levels"].keys():
		total += int(data["levels"][id].get("stars", 0))
	return total


func sfx_enabled() -> bool:
	return bool(data["settings"].get("sfx", true))


func set_sfx_enabled(on: bool) -> void:
	data["settings"]["sfx"] = on
	save()


## Records the outcome of a delivery and unlocks the next mission on success.
func record_result(level_id: String, level_index: int, success: bool, integrity: float,
		stars: int, coins: int, time: float) -> void:
	var stats: Dictionary = data["stats"]
	stats["attempts"] = int(stats.get("attempts", 0)) + 1
	if success:
		stats["deliveries"] = int(stats.get("deliveries", 0)) + 1
		var rec: Dictionary = level_record(level_id).duplicate()
		rec["completed"] = true
		rec["stars"] = maxi(int(rec.get("stars", 0)), stars)
		rec["best_integrity"] = maxf(float(rec.get("best_integrity", 0.0)), integrity)
		if not rec.has("best_time") or time < float(rec["best_time"]):
			rec["best_time"] = snappedf(time, 0.01)
		data["levels"][level_id] = rec
		data["coins"] = int(data["coins"]) + coins
		data["unlocked"] = maxi(int(data["unlocked"]), level_index + 2)
	else:
		stats["failures"] = int(stats.get("failures", 0)) + 1
	save()


func reset_all() -> void:
	data = default_data()
	save()
