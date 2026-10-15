extends SceneTree
## Loads every .gd file in the project so parse/compile errors surface at once.
## Run: godot --headless --path . --script res://tools/check_scripts.gd

func _initialize() -> void:
	var failed := 0
	var count := 0
	for path in _scan("res://"):
		count += 1
		var s = load(path)
		if s == null or (s is GDScript and not s.can_instantiate()):
			failed += 1
			printerr("FAILED: ", path)
	print("checked %d scripts, %d failed" % [count, failed])
	quit(1 if failed > 0 else 0)


func _scan(dir: String) -> Array[String]:
	var out: Array[String] = []
	for f in DirAccess.get_files_at(dir):
		if f.ends_with(".gd"):
			out.append(dir.path_join(f))
	for d in DirAccess.get_directories_at(dir):
		if not d.begins_with("."):
			out.append_array(_scan(dir.path_join(d)))
	return out
