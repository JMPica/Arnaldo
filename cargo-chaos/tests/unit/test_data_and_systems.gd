extends TestCase
## Data loading/validation, persistence, analytics and ad policy.


func test_all_shipped_data_is_valid() -> void:
	var d := GameData.new()
	var ok := d.load_all()
	assert_true(ok, "data errors: %s" % ", ".join(d.errors))
	assert_eq(d.cargo_types.size(), 3, "three cargo types")
	assert_gt(d.levels.size(), 0, "levels loaded")
	for lv in d.levels:
		assert_true(d.cargo_types.has(lv.cargo_id), lv.id + " cargo exists")
		assert_gt(lv.autopilot_path.size(), 1.0, lv.id + " has a reference path")


func test_level_validation_reports_errors() -> void:
	var d := game_data()
	var errors: Array[String] = []
	LevelData.from_dict({"id": "x"}, d.world, d.obstacle_types, errors)
	assert_gt(errors.size(), 0.0, "missing fields are reported")
	errors.clear()
	LevelData.from_dict({"id": "x", "name": "X", "cargo": "glass_box", "cruise_speed": 250,
		"delivery": {"x": 3000, "top": 500}, "autopilot_path": [[0, 300], [3000, 400]],
		"obstacles": [{"type": "volcano", "x": 10, "width": 10, "height": 10}]}, d.world, d.obstacle_types, errors)
	assert_eq(errors.size(), 1, "unknown obstacle type reported")
	assert_true(errors[0].contains("volcano"), "error names the problem")


func test_obstacle_anchoring() -> void:
	var d := game_data()
	var errors: Array[String] = []
	var lv := LevelData.from_dict({"id": "x", "name": "X", "cargo": "glass_box", "cruise_speed": 250,
		"delivery": {"x": 3000, "top": 500}, "autopilot_path": [[0, 300], [3000, 400]],
		"obstacles": [{"type": "building", "x": 100, "width": 50, "height": 200},
			{"type": "sign", "x": 300, "width": 80, "bottom": 150}]}, d.world, d.obstacle_types, errors)
	assert_eq(errors.size(), 0, "valid level")
	var ground := float(d.world["ground_y"])
	var b: Rect2 = lv.obstacles[0]["rect"]
	assert_near(b.end.y, ground, 0.01, "buildings stand on the ground")
	assert_near(b.size.y, 200.0, 0.01, "building height")
	var s: Rect2 = lv.obstacles[1]["rect"]
	assert_near(s.position.y, float(d.world["ceiling_y"]), 0.01, "signs hang from the ceiling")
	assert_near(s.end.y, 150.0, 0.01, "sign bottom")
	assert_near(lv.path_y_at(1500.0), 350.0, 0.01, "path interpolation")
	assert_near(lv.path_y_at(-50.0), 300.0, 0.01, "path clamps before start")
	assert_near(lv.path_y_at(9999.0), 400.0, 0.01, "path clamps after end")


func test_progress_save_load_and_unlock() -> void:
	var path := "user://test_progress_a.json"
	Progress.save_path = path
	Progress.reset_all()
	assert_true(Progress.is_unlocked(0), "first mission unlocked")
	assert_false(Progress.is_unlocked(1), "second mission locked")
	Progress.record_result("level_01", 0, true, 95.0, 3, 40, 21.5)
	assert_true(Progress.is_unlocked(1), "success unlocks the next mission")
	Progress.record_result("level_01", 0, true, 50.0, 1, 10, 30.0)
	assert_eq(Progress.best_stars("level_01"), 3, "best stars kept")
	Progress.record_result("level_02", 1, false, 0.0, 0, 0, 5.0)
	assert_false(Progress.is_unlocked(2), "failure does not unlock")
	Progress.load_or_reset()
	assert_eq(Progress.best_stars("level_01"), 3, "stars persisted")
	assert_eq(int(Progress.data["coins"]), 50, "coins persisted")
	assert_eq(int(Progress.data["stats"]["failures"]), 1, "failures counted")
	assert_near(float(Progress.level_record("level_01")["best_time"]), 21.5, 0.001, "best time kept")
	DirAccess.remove_absolute(ProjectSettings.globalize_path(path))


func test_progress_survives_corrupt_save() -> void:
	var path := "user://test_progress_b.json"
	Progress.save_path = path
	var f := FileAccess.open(path, FileAccess.WRITE)
	f.store_string("{ this is not json")
	f.close()
	Progress.load_or_reset()
	assert_eq(int(Progress.data["unlocked"]), 1, "falls back to a fresh save")
	assert_true(FileAccess.file_exists(path + ".corrupt"), "corrupt file kept for diagnosis")
	DirAccess.remove_absolute(ProjectSettings.globalize_path(path))
	DirAccess.remove_absolute(ProjectSettings.globalize_path(path + ".corrupt"))


func test_analytics_events_reach_backends() -> void:
	var mem = Analytics.MemoryBackend.new()
	Analytics.backends.append(mem)
	Analytics.track("delivery_started", {"level": "level_01"})
	Analytics.backends.erase(mem)
	assert_eq(mem.records.size(), 1, "one event recorded")
	var r: Dictionary = mem.records[0]
	assert_eq(r["event"], "delivery_started", "event name")
	assert_eq(r["props"]["level"], "level_01", "props")
	assert_true(r.has("session") and r.has("ts"), "session and timestamp present")
	for key in r.keys():
		assert_true(key in ["event", "ts", "session", "session_time", "props"], "no extra/personal fields: " + key)


func test_ad_policy_respects_the_player() -> void:
	var p := AdPolicy.new()
	for i in 5:
		p.on_delivery_finished()
	assert_false(p.can_show_interstitial(60.0, "results"), "no ads in the first minutes")
	assert_false(p.can_show_interstitial(600.0, "gameplay"), "never during gameplay")
	assert_true(p.can_show_interstitial(600.0, "results"), "allowed at a natural break")
	p.mark_shown(600.0)
	for i in 5:
		p.on_delivery_finished()
	assert_false(p.can_show_interstitial(650.0, "results"), "minimum interval between ads")
	assert_true(p.can_show_interstitial(800.0, "results"), "allowed after the interval")
	p.mark_shown(800.0)
	p.on_delivery_finished()
	assert_false(p.can_show_interstitial(2000.0, "results"), "needs several deliveries in between")


func test_null_ad_provider_never_shows() -> void:
	assert_false(Ads.maybe_show_interstitial(), "prototype ships without ads")
	assert_false(Ads.rewarded_available(), "no rewarded ads yet")


func test_all_sounds_load() -> void:
	for s in Sfx.SOUNDS:
		assert_true(Sfx._streams.has(s), "sound '%s' imported and loaded" % s)
	assert_true(Sfx._jet.stream != null, "jetpack loop loaded")
	assert_eq((Sfx._jet.stream as AudioStreamWAV).loop_mode, AudioStreamWAV.LOOP_FORWARD, "jet loop loops")


func test_ui_text_only_uses_glyphs_the_font_has() -> void:
	# Web builds have no system fallback fonts: a missing glyph shows as a box.
	UiKit.init()
	var missing := {}
	for dir in ["res://scripts/ui", "res://scripts/gameplay", "res://scripts/art"]:
		for f in DirAccess.get_files_at(dir):
			if not f.ends_with(".gd"):
				continue
			for line in FileAccess.get_file_as_string(dir.path_join(f)).split("\n"):
				if line.strip_edges().begins_with("#"):
					continue
				for ch in line:
					if ch.unicode_at(0) > 127 and not UiKit.font.has_char(ch.unicode_at(0)):
						missing[ch] = f
	for lv in game_data().levels:
		for text in [lv.name, lv.subtitle] + lv.hints.map(func(h): return h["text"]):
			for ch in text:
				if not UiKit.font.has_char(ch.unicode_at(0)):
					missing[ch] = lv.id
	assert_eq(missing.size(), 0, "characters missing from the game font: %s" % str(missing))
