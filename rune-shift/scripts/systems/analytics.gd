extends Node
## Analytics facade (autoload "Analytics"). Gameplay calls track(); backends
## decide where events go (today: a local JSON-lines log for debugging).
## Data minimisation: random per-launch session id, no device or user ids.

const EVENTS := ["first_session_started", "run_started", "room_entered", "room_completed",
		"rune_selected", "spell_configuration_changed", "player_damaged", "player_died",
		"boss_defeated", "run_completed", "second_run_started", "session_ended"]

var session_id := ""
var enabled := true
var backends: Array = []
var recent: Array[Dictionary] = []
var _start_ms := 0
var _ended := false


func _ready() -> void:
	session_id = "%08x%08x" % [randi(), randi()]
	_start_ms = Time.get_ticks_msec()
	backends.append(LocalLogBackend.new("user://analytics"))


func track(event: String, props: Dictionary = {}) -> void:
	if not enabled:
		return
	if not event in EVENTS:
		push_warning("Analytics: unknown event '%s'" % event)
	var record := {"event": event, "ts": Time.get_unix_time_from_system(), "session": session_id,
		"session_time": snappedf((Time.get_ticks_msec() - _start_ms) / 1000.0, 0.01), "props": props}
	recent.append(record)
	if recent.size() > 300:
		recent.pop_front()
	for b in backends:
		b.send(record)


func _notification(what: int) -> void:
	if (what == NOTIFICATION_WM_CLOSE_REQUEST or what == NOTIFICATION_APPLICATION_PAUSED) and not _ended:
		_ended = true
		track("session_ended", {"duration": snappedf((Time.get_ticks_msec() - _start_ms) / 1000.0, 0.1)})


class LocalLogBackend extends RefCounted:
	const MAX_FILES := 10
	const MAX_BYTES := 512 * 1024
	var path := ""
	var _file: FileAccess

	func _init(dir: String) -> void:
		DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(dir))
		var logs := Array(DirAccess.get_files_at(dir)).filter(func(f): return f.ends_with(".jsonl"))
		logs.sort()
		while logs.size() >= MAX_FILES:
			DirAccess.remove_absolute(ProjectSettings.globalize_path(dir.path_join(logs.pop_front())))
		path = "%s/session_%s.jsonl" % [dir, Time.get_datetime_string_from_system(false).replace(":", "-")]

	func send(record: Dictionary) -> void:
		if _file == null:
			_file = FileAccess.open(path, FileAccess.WRITE)
			if _file == null:
				return
		if _file.get_length() < MAX_BYTES:
			_file.store_line(JSON.stringify(record))
			_file.flush()


class MemoryBackend extends RefCounted:
	var records: Array[Dictionary] = []

	func send(record: Dictionary) -> void:
		records.append(record)
