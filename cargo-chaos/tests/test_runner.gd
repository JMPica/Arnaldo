extends Node
## Minimal test runner (no external dependencies).
## Run headless:  godot --headless --path . --fixed-fps 60 res://tests/test_runner.tscn
## Options after "--":  --filter=<substring>  --suite=unit|integration
## Writes tests/output/results.json and exits with code 1 if anything failed.

const SUITES := ["res://tests/unit", "res://tests/integration"]


func _ready() -> void:
	var filter := ""
	var suite := ""
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--filter="):
			filter = arg.get_slice("=", 1)
		elif arg.begins_with("--suite="):
			suite = arg.get_slice("=", 1)
	# Tests must never touch the player's real save or analytics log.
	Progress.save_path = "user://test_save.json"
	Analytics.backends.clear()
	Analytics.backends.append(Analytics.MemoryBackend.new())
	_run(filter, suite)


func _run(filter: String, suite: String) -> void:
	var results: Array[Dictionary] = []
	var passed := 0
	var failed := 0
	var t0 := Time.get_ticks_msec()
	for dir in SUITES:
		if suite != "" and not dir.ends_with(suite):
			continue
		var files := Array(DirAccess.get_files_at(dir))
		files.sort()
		for f in files:
			if not (f.begins_with("test_") and f.ends_with(".gd")):
				continue
			var script: GDScript = load(dir.path_join(f))
			if script == null or not script.can_instantiate():
				results.append({"suite": f, "test": "<load>", "ok": false, "errors": ["script failed to load"]})
				failed += 1
				printerr("FAIL %s: script failed to load" % f)
				continue
			var methods: Array[String] = []
			for m in script.get_script_method_list():
				if m["name"].begins_with("test_") and not methods.has(m["name"]):
					methods.append(m["name"])
			for m in methods:
				if filter != "" and not (f + "::" + m).contains(filter):
					continue
				var inst: TestCase = script.new()
				add_child(inst)
				var start := Time.get_ticks_msec()
				await inst.call(m)
				var ms := Time.get_ticks_msec() - start
				var ok := inst.failures.is_empty()
				results.append({"suite": f.get_basename(), "test": m, "ok": ok, "ms": ms,
						"errors": inst.failures, "notes": inst.notes})
				if ok:
					passed += 1
					print("  PASS  %s::%s (%d ms)" % [f.get_basename(), m, ms])
				else:
					failed += 1
					print("  FAIL  %s::%s" % [f.get_basename(), m])
					for e in inst.failures:
						print("          - " + e)
				for n in inst.notes:
					print("          · " + n)
				inst.queue_free()
				await get_tree().process_frame
	var total_ms := Time.get_ticks_msec() - t0
	print("\n%d passed, %d failed (%.1f s)" % [passed, failed, total_ms / 1000.0])
	var out_dir := ProjectSettings.globalize_path("res://tests/output")
	DirAccess.make_dir_recursive_absolute(out_dir)
	var f := FileAccess.open(out_dir.path_join("results.json"), FileAccess.WRITE)
	if f:
		f.store_string(JSON.stringify({"passed": passed, "failed": failed, "seconds": total_ms / 1000.0,
				"godot": Engine.get_version_info()["string"], "results": results}, "  "))
	DirAccess.remove_absolute(ProjectSettings.globalize_path(Progress.save_path))
	get_tree().quit(1 if failed > 0 else 0)
