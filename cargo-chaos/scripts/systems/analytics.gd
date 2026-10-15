extends Node
## Analytics facade (autoload "Analytics").
##
## Gameplay code only calls Analytics.track(event, props). Where events go is
## decided by pluggable backends: today a local JSON-lines log for debugging;
## later a real analytics SDK can be added as another backend without touching
## gameplay code. No personal data is collected: the session id is random and
## regenerated every launch, and there is no device or user identifier.

const EVENTS := ["game_started", "tutorial_started", "tutorial_completed", "delivery_started",
		"delivery_completed", "delivery_failed", "cargo_damaged", "session_ended", "retry_selected"]

var session_id := ""
var enabled := true
var backends: Array = []
var recent: Array[Dictionary] = []   ## last events, handy for debugging and tests
var _session_start_ms := 0
var _session_ended := false


func _ready() -> void:
	session_id = "%08x%08x" % [randi(), randi()]
	_session_start_ms = Time.get_ticks_msec()
	backends.append(LocalLogBackend.new("user://analytics"))
	track("game_started", {"version": ProjectSettings.get_setting("application/config/version", "dev"),
			"platform": OS.get_name()})


func track(event: String, props: Dictionary = {}) -> void:
	if not enabled:
		return
	if not event in EVENTS:
		push_warning("Analytics: unknown event '%s'" % event)
	var record := {
		"event": event,
		"ts": Time.get_unix_time_from_system(),
		"session": session_id,
		"session_time": snappedf((Time.get_ticks_msec() - _session_start_ms) / 1000.0, 0.01),
		"props": props,
	}
	recent.append(record)
	if recent.size() > 200:
		recent.pop_front()
	for b in backends:
		b.send(record)


func end_session() -> void:
	if _session_ended:
		return
	_session_ended = true
	track("session_ended", {"duration": snappedf((Time.get_ticks_msec() - _session_start_ms) / 1000.0, 0.1)})
	for b in backends:
		b.flush()


func _notification(what: int) -> void:
	if what == NOTIFICATION_WM_CLOSE_REQUEST or what == NOTIFICATION_PREDELETE:
		end_session()
	elif what == NOTIFICATION_APPLICATION_PAUSED:
		# Mobile: the OS may kill a backgrounded app; close the session now.
		end_session()
	elif what == NOTIFICATION_APPLICATION_RESUMED and _session_ended:
		_session_ended = false
		session_id = "%08x%08x" % [randi(), randi()]
		_session_start_ms = Time.get_ticks_msec()
		track("game_started", {"resumed": true})


## Writes one JSON object per line to user://analytics/session_<date>.jsonl.
## Files are capped in size and only the most recent ones are kept.
class LocalLogBackend extends RefCounted:
	const MAX_FILES := 10
	const MAX_BYTES := 512 * 1024
	var dir := ""
	var path := ""
	var _file: FileAccess

	func _init(directory: String) -> void:
		dir = directory
		DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(dir))
		_prune()
		var stamp := Time.get_datetime_string_from_system(false).replace(":", "-")
		path = "%s/session_%s.jsonl" % [dir, stamp]

	func send(record: Dictionary) -> void:
		if _file == null:
			_file = FileAccess.open(path, FileAccess.WRITE)
			if _file == null:
				return
		if _file.get_length() > MAX_BYTES:
			return
		_file.store_line(JSON.stringify(record))
		_file.flush()

	func flush() -> void:
		if _file:
			_file.flush()

	func _prune() -> void:
		var files := DirAccess.get_files_at(dir)
		var logs: Array[String] = []
		for f in files:
			if f.ends_with(".jsonl"):
				logs.append(f)
		logs.sort()
		while logs.size() >= MAX_FILES:
			DirAccess.remove_absolute(ProjectSettings.globalize_path("%s/%s" % [dir, logs.pop_front()]))


## In-memory backend used by tests.
class MemoryBackend extends RefCounted:
	var records: Array[Dictionary] = []

	func send(record: Dictionary) -> void:
		records.append(record)

	func flush() -> void:
		pass
