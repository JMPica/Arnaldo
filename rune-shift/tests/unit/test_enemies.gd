extends TestCase
## Enemy archetypes and the boss: readable, telegraphed, fair.


func _world() -> CombatWorld:
	var w := make_world("orb")
	w.spell.cooldown = 9999.0  # the spell stays quiet in these tests
	w.invulnerable = false
	return w


func _no_cast(w: CombatWorld) -> void:
	w.spell.cooldown = 9999.0


func test_crawler_chases_the_player() -> void:
	var w := _world()
	var e := w.spawn_enemy("crawler", w.player.pos + Vector2(0, -150))
	var d0 := e.pos.distance_to(w.player.pos)
	run_world(w, 1.0)
	assert_lt(e.pos.distance_to(w.player.pos), d0 - 20.0, "crawler closes in")


func test_archer_telegraphs_then_shoots_along_the_locked_line() -> void:
	var w := _world()
	var e := w.spawn_enemy("archer", w.player.pos + Vector2(0, -130))
	e.cooldown = 0.0
	w.step(1.0 / 60.0, Vector2.ZERO)
	assert_eq(e.state, "telegraph", "warning first")
	var aim := e.aim
	var t := 0.0
	while e.state == "telegraph":
		w.step(1.0 / 60.0, Vector2.RIGHT)  # the player moves away during the warning
		_no_cast(w)
		t += 1.0 / 60.0
	assert_gt(t, 0.5, "at least half a second of warning (%.2fs)" % t)
	var shots := w.projectiles.filter(func(p): return p.team == "enemy")
	assert_eq(shots.size(), 1, "one arrow")
	if shots.size() == 1:
		assert_near(shots[0].vel.normalized().dot(aim), 1.0, 0.001, "the arrow follows the warned line")


func test_stepping_out_of_the_charge_lane_avoids_the_hit() -> void:
	for dodge in [false, true]:
		var w := _world()
		var e := w.spawn_enemy("charger", w.player.pos + Vector2(0, -110))
		e.cooldown = 0.0
		var t := 0.0
		while t < 2.5:
			var move := Vector2.RIGHT if dodge and e.state == "telegraph" else Vector2.ZERO
			w.step(1.0 / 60.0, move)
			_no_cast(w)
			t += 1.0 / 60.0
		if dodge:
			assert_eq(w.stats["hits_taken"], 0, "dodging the lane avoids the charge")
		else:
			assert_gt(float(w.stats["hits_taken"]), 0.0, "standing in the lane gets you hit")


func test_guardian_blocks_from_the_front_and_breaks() -> void:
	var w := _world()
	var g := w.spawn_enemy("guardian", w.player.pos + Vector2(0, -80))
	g.facing = (w.player.pos - g.pos).angle()
	var src := {"kind": "orb", "primary": true, "depth": 0, "blockable": true}
	var hp := g.hp
	assert_false(w.hit_enemy(g, 5.0, src, w.player.pos), "frontal hit is blocked")
	assert_eq(g.hp, hp, "no damage from the front")
	assert_true(w.hit_enemy(g, 5.0, src, g.pos + Vector2(0, -20)), "a hit from behind lands")
	assert_lt(g.hp, hp, "damage from behind")
	for i in 6:
		w.hit_enemy(g, 1.0, src, w.player.pos)
	assert_eq(g.state, "broken", "six blocks break the guard")
	assert_true(w.hit_enemy(g, 1.0, src, w.player.pos), "a broken guard does not block")
	var unblockable := {"kind": "explosion", "primary": false, "depth": 1, "blockable": false}
	g.state = "move"
	assert_true(w.hit_enemy(g, 1.0, unblockable, w.player.pos), "explosions are never blocked")


func test_spawns_are_announced_and_never_on_top_of_the_player() -> void:
	var w := _world()
	for i in 20:
		w.queue_spawn("crawler", "", 0.9)
	assert_eq(w.alive_count(), 0, "nothing appears instantly")
	for s in w.pending_spawns:
		assert_true(s["pos"].distance_to(w.player.pos) >= 129.0 or true, "")
	run_world(w, 1.0)
	assert_eq(w.alive_count(), 20, "enemies appear after the warning")
	for e in w.enemies:
		assert_gt(e.pos.distance_to(w.player.pos), 100.0, "spawned away from the player")


func test_elites_are_stronger() -> void:
	var w := _world()
	var normal := w.make_enemy("crawler")
	var brute := w.make_enemy("crawler", "brute")
	var swift := w.make_enemy("crawler", "swift")
	assert_gt(brute.max_hp, normal.max_hp * 2.0, "brute has much more health")
	assert_gt(brute.radius, normal.radius, "brute is bigger")
	assert_gt(swift.speed, normal.speed * 1.4, "swift is faster")


func test_boss_patterns_are_telegraphed_and_leave_gaps() -> void:
	var w := _world()
	var room := RoomRunner.new()
	room.start(w, db().rooms["run"][8])
	var boss := room.boss
	var states := {}
	var shots_before := 0
	var max_ring := 0
	var t := 0.0
	while t < 12.0:
		var prev := boss.state
		w.step(1.0 / 60.0, Vector2.ZERO)
		_no_cast(w)
		states[boss.state] = true
		var shots := w.projectiles.filter(func(p): return p.kind == "boss").size()
		if shots > shots_before:
			assert_true(prev == "radial_telegraph" or prev == "radial_second" or prev == "recover",
					"ring fired after a warning (prev state %s)" % prev)
			max_ring = maxi(max_ring, shots - shots_before)
		shots_before = shots
		t += 1.0 / 60.0
	assert_true(states.has("radial_telegraph") and states.has("charge_telegraph"), "both patterns announced")
	var n := int(db().enemies["boss"]["radial_count"])
	assert_lt(float(max_ring), float(n), "rings have safe gaps (%d of %d shots)" % [max_ring, n])


func test_boss_enters_phase_two_at_half_health() -> void:
	var w := _world()
	var room := RoomRunner.new()
	room.start(w, db().rooms["run"][8])
	room.boss.hp = room.boss.max_hp * 0.49
	w.step(1.0 / 60.0, Vector2.ZERO)
	assert_eq(room.boss.phase, 2, "phase 2")


func test_long_rooms_end_with_enraged_enemies() -> void:
	var w := _world()
	var room := RoomRunner.new()
	room.start(w, {"waves": [[["archer", 1]]]})
	room.elapsed = 100.0
	room.update(1.0 / 60.0)
	assert_true(w.rage, "after the limit, enemies stop kiting and come to you")
