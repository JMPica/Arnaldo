extends TestCase
## Run structure: guided forge, cards, challenge, victory/defeat, determinism.


func _session(seed_v := 5) -> RunSession:
	var s := RunSession.new()
	s.start(seed_v)
	return s


func _clear_room(s: RunSession) -> void:
	# Kill everything instantly and let the room finish.
	var guard := 0
	while s.phase != RunSession.Phase.REWARD and not s.is_over() and guard < 5000:
		guard += 1
		s.world.invulnerable = true
		for e in s.world.enemies:
			if e.alive:
				s.world.damage_enemy(e, 99999.0, {"kind": "test", "depth": 1})
		s.step(1.0 / 60.0, Vector2.ZERO)


func test_run_has_eight_rooms_and_a_boss() -> void:
	var s := _session()
	assert_eq(s.room_count(), 9, "8 rooms + boss")
	assert_true(db().rooms["run"][8].get("boss", false), "the last room is the boss")


func test_first_rooms_guide_the_three_rune_families() -> void:
	var s := _session()
	_clear_room(s)
	assert_eq(s.offers.size(), 3, "three cards")
	for c in s.offers:
		assert_eq(c.get("family", ""), "element", "room 1 offers elements")
	s.choose(0)
	_clear_room(s)
	for c in s.offers:
		assert_eq(c.get("family", ""), "catalyst", "room 2 offers catalysts")
	s.choose(1)
	assert_true(s.run.spell.is_complete(), "after two rooms the spell has all three runes")
	_clear_room(s)
	var forms := 0
	for c in s.offers:
		if c.get("family", "") == "form":
			forms += 1
	assert_eq(forms, 3, "room 3 offers form changes or a form upgrade")


func test_cards_change_the_spell() -> void:
	var s := _session()
	var run := s.run
	RewardManager.apply(run, {"type": "rune", "family": "element", "id": "storm"})
	assert_eq(run.spell.element, "storm", "element set")
	RewardManager.apply(run, {"type": "upgrade", "family": "form", "id": "orb"})
	assert_eq(int(run.spell.levels["form"]), 2, "form upgraded")
	var hp := run.max_hp
	RewardManager.apply(run, {"type": "stat", "id": "stat_hp"})
	assert_eq(run.max_hp, hp + 20.0, "max hp up")
	run.hp = 10.0
	RewardManager.apply(run, {"type": "heal", "id": "heal"})
	assert_gt(run.hp, 10.0, "healed")


func test_standard_offers_are_distinct_and_valid() -> void:
	var s := _session(9)
	s.run.spell.element = "fire"
	s.run.spell.catalyst = "echo"
	s.run.room_index = 4
	for i in 30:
		var offers := RewardManager.offers(s.run, {"reward": "standard"})
		assert_eq(offers.size(), 3, "three cards")
		var keys := {}
		for c in offers:
			keys["%s:%s" % [c["type"], c["id"]]] = true
			assert_true(c.has("title") and c.has("desc") and c.has("icon"), "card has text and icon")
			assert_true(SpriteData.SPRITES.has(str(c["icon"])), "icon exists: " + str(c["icon"]))
		assert_eq(keys.size(), 3, "no duplicate cards")


func test_challenge_adds_an_elite_and_a_second_pick() -> void:
	var s := _session(3)
	_clear_room(s)
	s.offers[0] = {"type": "challenge", "id": "challenge", "title": "x", "desc": "x", "icon": "challenge"}
	s.choose(0)
	assert_eq(s.run.room_index, 1, "next room")
	var elites := 0
	for wave in s.room.waves:
		for g in wave:
			if g.size() > 2:
				elites += 1
	assert_gt(float(elites), 0.0, "the challenged room has an extra elite")
	_clear_room(s)
	assert_eq(s.picks_left, 2, "and then two rewards")


func test_death_ends_the_run() -> void:
	var s := _session()
	s.step(2.0, Vector2.ZERO)
	s.world.player.hp = 1.0
	s.world.hurt_player(50.0, "crawler")
	s.step(1.0 / 60.0, Vector2.ZERO)
	assert_eq(s.phase, RunSession.Phase.DEFEAT, "defeat")


func test_beating_the_boss_wins_the_run() -> void:
	var s := _session()
	for i in 8:
		_clear_room(s)
		s.choose(0)
	assert_true(s.is_boss_room(), "boss room reached")
	_clear_room(s)
	assert_eq(s.phase, RunSession.Phase.VICTORY, "victory")
	assert_gt(float(s.run.fragments), 30.0, "boss pays seal fragments")


func test_same_seed_same_run() -> void:
	var a := Bot.play_run(42, {"form": "cone", "element": "storm", "catalyst": "rupture"}, 0.8)
	var b := Bot.play_run(42, {"form": "cone", "element": "storm", "catalyst": "rupture"}, 0.8)
	assert_eq(str(a), str(b), "deterministic: reproducible runs for debugging")


func test_bot_runs_end_and_rooms_last_a_reasonable_time() -> void:
	var rooms: Array[float] = []
	var finished := 0
	var wins := 0
	for sd in [101, 202, 303]:
		var r := Bot.play_run(sd, {}, 0.8)
		if r["victory"] or r["died_in_room"] > 0:
			finished += 1
		if r["victory"]:
			wins += 1
		for x in r["room_seconds"]:
			rooms.append(x)
		note("seed %d: %s, %d rooms, %.0fs, %s" % [sd, "WIN" if r["victory"] else "lost in room %d" % r["died_in_room"], r["rooms_cleared"], r["run_seconds"], r["name"]])
	assert_eq(finished, 3, "every run ends (no stalemate room)")
	rooms.sort()
	var median := rooms[rooms.size() / 2]
	note("bot room median %.1fs" % median)
	assert_true(median > 10.0 and median < 70.0, "rooms last a plausible time (median %.1fs)" % median)
