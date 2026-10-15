extends TestCase
## Data, save, analytics, ads, art and text.


func test_data_is_valid() -> void:
	var d := GameDB.new()
	assert_true(d.load_all(), "data errors: %s" % ", ".join(d.errors))
	assert_eq(d.rune_ids("forms").size(), 3, "3 forms")
	assert_eq(d.rune_ids("elements").size(), 3, "3 elements")
	assert_eq(d.rune_ids("catalysts").size(), 3, "3 catalysts")
	assert_eq(d.rooms["templates"].size() - 1, 6, "6 room templates + the boss arena")


func test_param_reads_levels() -> void:
	var def := {"a": [1, 2, 3], "b": 7}
	assert_eq(GameDB.param(def, "a", 2), 2, "per level")
	assert_eq(GameDB.param(def, "a", 9), 3, "clamped level")
	assert_eq(GameDB.param(def, "b", 3), 7, "flat value")


func test_room_obstacles_leave_the_start_free() -> void:
	var start: Array = db().rooms["player_start"]
	for id in db().rooms["templates"].keys():
		for o in db().rooms["templates"][id]["obstacles"]:
			var r := Rect2(o[0], o[1], o[2], o[3]).grow(10)
			assert_false(r.has_point(Vector2(start[0], start[1])), "%s: start is not inside an obstacle" % id)


func test_progression_saves_and_survives_corruption() -> void:
	var path := "user://test_prog.json"
	Progression.save_path = path
	Progression.reset_all()
	var found := Progression.record_run(false, 4, 12, ["orb/fire/echo", "orb/-/-"])
	assert_eq(found.size(), 1, "only complete spells enter the compendium")
	Progression.record_run(true, 9, 40, ["orb/fire/echo"])
	Progression.load_or_reset()
	assert_eq(int(Progression.data["fragments"]), 52, "fragments persisted")
	assert_eq(int(Progression.data["best_room"]), 9, "best room")
	assert_eq(Progression.compendium_count(), 1, "compendium persisted, no duplicates")
	var f := FileAccess.open(path, FileAccess.WRITE)
	f.store_string("{broken")
	f.close()
	Progression.load_or_reset()
	assert_eq(int(Progression.data["fragments"]), 0, "corrupt save falls back to a fresh one")
	assert_true(FileAccess.file_exists(path + ".corrupt"), "and keeps the broken file")
	for p in [path, path + ".corrupt"]:
		DirAccess.remove_absolute(ProjectSettings.globalize_path(p))
	Progression.save_path = "user://test_save.json"


func test_no_permanent_damage_multipliers() -> void:
	# GDD 15: permanent progression is unlocks only.
	for k in Progression.default_data().keys():
		assert_false(k.contains("damage") or k.contains("power"), "no permanent power key: " + k)


func test_analytics_minimal_and_known_events() -> void:
	var mem = Analytics.MemoryBackend.new()
	Analytics.backends.append(mem)
	Analytics.track("run_started", {"seed": 1})
	Analytics.backends.erase(mem)
	assert_eq(mem.records.size(), 1, "recorded")
	for key in mem.records[0].keys():
		assert_true(key in ["event", "ts", "session", "session_time", "props"], "no extra fields: " + key)
	for e in ["first_session_started", "run_started", "room_entered", "room_completed", "rune_selected",
			"spell_configuration_changed", "player_damaged", "player_died", "boss_defeated", "run_completed",
			"second_run_started"]:
		assert_true(e in Analytics.EVENTS, "GDD event declared: " + e)


func test_ads_never_interrupt_play() -> void:
	var p := AdPolicy.new()
	for i in 6:
		p.on_delivery_finished()
	assert_false(p.can_show_interstitial(9999.0, "gameplay"), "never during play")
	assert_false(p.can_show_interstitial(30.0, "results"), "not in the first minutes")
	assert_true(p.can_show_interstitial(9999.0, "results"), "only after a run")
	assert_false(Ads.maybe_show_interstitial(), "the prototype ships with no ads")


func test_sprites_are_well_formed() -> void:
	for name in SpriteData.SPRITES.keys():
		var rows: Array = SpriteData.SPRITES[name]
		var w := String(rows[0]).length()
		for r in rows:
			assert_eq(String(r).length(), w, name + " rows have equal width")
		assert_true(PixelArt.tex(name) != null, name + " builds a texture")
	assert_eq(PixelArt.tex("boss").get_width(), 32, "boss is 32x32 (64 px on screen)")


func test_text_only_uses_glyphs_the_font_has() -> void:
	var font := UiTheme.get_font()
	var missing := {}
	for dir in ["res://scripts/ui", "res://scripts/view", "res://scripts/core"]:
		for f in DirAccess.get_files_at(dir):
			if not f.ends_with(".gd"):
				continue
			for line in FileAccess.get_file_as_string(dir.path_join(f)).split("\n"):
				if line.strip_edges().begins_with("#"):
					continue
				for ch in line:
					if ch.unicode_at(0) > 127 and not font.has_char(ch.unicode_at(0)):
						missing[ch] = f
	for fam in ["forms", "elements", "catalysts"]:
		for id in db().runes[fam].keys():
			for ch in str(db().runes[fam][id]["name"]) + str(db().runes[fam][id]["short"]):
				if not font.has_char(ch.unicode_at(0)):
					missing[ch] = id
	assert_eq(missing.size(), 0, "characters missing from the pixel font: %s" % str(missing))


func test_simulation_is_fast_enough_for_phones() -> void:
	var w := make_world("orbit", "storm", "rebound")
	w.invulnerable = true
	for i in 40:
		var e := w.spawn_enemy(["crawler", "archer", "charger", "guardian"][i % 4], Vector2(20 + (i * 37) % 300, 30 + (i * 53) % 200))
		e.hp = 99999.0
		e.max_hp = 99999.0
	for i in 120:
		w.fire_enemy_shot(Vector2(168, 100), Vector2.from_angle(i), 10.0, 1.0)
	var t0 := Time.get_ticks_usec()
	for i in 120:
		w.step(1.0 / 60.0, Vector2.RIGHT)
	var per_step := (Time.get_ticks_usec() - t0) / 120.0 / 1000.0
	note("40 enemies + 120 shots: %.2f ms per step on this machine" % per_step)
	assert_lt(per_step, 4.0, "a crowded room costs well under a frame")


func test_all_sounds_and_music_load() -> void:
	for s in Sfx.SOUNDS:
		assert_true(Sfx._streams.has(s), "sound '%s' loaded" % s)
	for m in Sfx.MUSIC:
		assert_true(ResourceLoader.exists("res://assets/audio/music_%s.ogg" % m), "music '%s' present" % m)
