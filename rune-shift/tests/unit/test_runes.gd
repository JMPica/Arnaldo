extends TestCase
## The Runic Forge: every one of the 27 combinations works, each rune leaves its
## own fingerprint, and the safety limits hold.

const SIGNATURE := {
	"fire": "burn_ticks", "ice": "slows", "storm": "discharges",
	"echo": "echoes", "rupture": "explosions", "rebound": "rebounds",
}


func _run_combo(form: String, element: String, catalyst: String, hp := 40.0, seconds := 8.0) -> Dictionary:
	var w := make_world(form, element, catalyst)
	# Two clusters so Rebound and storm chains have somewhere to jump.
	var near := w.player.pos + Vector2(0, -60 if form != "orbit" else -30)
	add_dummies(w, 6, hp, near, 22.0)
	add_dummies(w, 4, hp, near + Vector2(50, -20), 18.0)
	run_world(w, seconds)
	return w.spell.stats.duplicate()


func test_all_27_combinations_work() -> void:
	for f in db().rune_ids("forms"):
		for el in db().rune_ids("elements"):
			for ca in db().rune_ids("catalysts"):
				var s := _run_combo(f, el, ca)
				var name := "%s/%s/%s" % [f, el, ca]
				assert_gt(s["damage"], 0.0, name + " deals damage")
				assert_gt(s["casts"], 0.0, name + " casts")
				assert_gt(float(s[SIGNATURE[el]]), 0.0, "%s: element effect '%s' happens" % [name, SIGNATURE[el]])
				assert_gt(float(s[SIGNATURE[ca]]), 0.0, "%s: catalyst effect '%s' happens" % [name, SIGNATURE[ca]])


func test_each_rune_leaves_only_its_own_fingerprint() -> void:
	for f in db().rune_ids("forms"):
		for el in db().rune_ids("elements"):
			for ca in db().rune_ids("catalysts"):
				var s := _run_combo(f, el, ca, 40.0, 5.0)
				for other in SIGNATURE.keys():
					if other != el and other != ca:
						assert_eq(int(s[SIGNATURE[other]]), 0, "%s/%s/%s must not show '%s'" % [f, el, ca, SIGNATURE[other]])


func test_forms_hit_differently() -> void:
	# Same element and catalyst, three forms: different damage profiles.
	var profiles := {}
	for f in db().rune_ids("forms"):
		var s := _run_combo(f, "fire", "echo", 400.0, 6.0)
		profiles[f] = s
		note("%s/fire/echo: %d hits, %.0f damage, %d casts" % [f, s["hits"], s["damage"], s["casts"]])
	assert_true(profiles["cone"]["hits"] > profiles["cone"]["casts"], "cone hits several enemies per cast")
	assert_true(profiles["orb"]["hits"] <= profiles["orb"]["casts"] * 2 + 2, "orb hits about one enemy per projectile")


func test_spell_without_element_or_catalyst_still_works() -> void:
	var s := _run_combo("orb", "", "")
	assert_gt(s["damage"], 0.0, "a bare form already fights (first room)")


func test_rupture_explosions_never_chain() -> void:
	var w := make_world("orb", "", "rupture")
	add_dummies(w, 30, 1.0, w.player.pos + Vector2(0, -70), 26.0)
	run_world(w, 6.0)
	var s := w.spell.stats
	assert_gt(s["explosions"], 0.0, "explosions happen")
	# Explosion kills have depth 1: they never explode again. So explosions are
	# at most the kills made by the spell itself, never all 30 in a cascade.
	assert_true(s["explosions"] < 30, "no cascade through the whole cluster (%d explosions)" % s["explosions"])
	assert_lt(float(s["explosions"]), float(s["kills"]) + 0.5, "explosions <= kills")


func test_rebound_does_not_feed_itself() -> void:
	var w := make_world("orb", "", "rebound")
	add_dummies(w, 8, 500.0, w.player.pos + Vector2(0, -60), 30.0)
	run_world(w, 8.0)
	var s := w.spell.stats
	var every := int(GameDB.param(db().rune("catalysts", "rebound"), "every", 1))
	var primary_hits: int = s["hits"] - s["rebounds"]
	assert_lt(float(s["rebounds"]), float(primary_hits) / every + 1.5, "one rebound per %d primary hits" % every)


func test_echo_repeats_casts() -> void:
	var w := make_world("orb", "", "echo")
	add_dummies(w, 3, 500.0, w.player.pos + Vector2(0, -60))
	run_world(w, 8.0)
	var s := w.spell.stats
	var every := int(GameDB.param(db().rune("catalysts", "echo"), "every", 1))
	var expected: float = float(s["casts"] - s["echoes"]) / every
	assert_near(float(s["echoes"]), float(expected), 1.5, "one echo every %d casts" % every)


func test_storm_discharge_happens_on_the_nth_hit() -> void:
	var w := make_world("orb", "storm", "")
	var e := add_dummies(w, 1, 1000.0, w.player.pos + Vector2(0, -60))[0]
	var charges := int(GameDB.param(db().rune("elements", "storm"), "charges", 1))
	run_world(w, 3.0)
	var hits: int = w.spell.stats["hits"]
	assert_eq(int(w.spell.stats["discharges"]), hits / charges, "a discharge every %d hits" % charges)
	assert_lt(float(w.spell.storm_charge), float(charges), "charge resets after discharging")
	assert_true(e.hp < e.max_hp, "the target took the discharge")


func test_ice_slows_and_makes_vulnerable() -> void:
	var w := make_world("orb", "ice", "")
	var e := add_dummies(w, 1, 1000.0, w.player.pos + Vector2(0, -60))[0]
	run_world(w, 1.0)
	assert_gt(e.slow_time, 0.0, "slowed")
	e.speed = 40.0
	assert_lt(e.move_speed(), 40.0, "moves slower")
	var before := e.hp
	w.damage_enemy(e, 10.0, {"kind": "test", "depth": 0})
	assert_gt(before - e.hp, 10.0, "takes extra damage while frozen")


func test_fire_burn_stacks_and_expires() -> void:
	var w := make_world("orb", "fire", "")
	var e := add_dummies(w, 1, 1000.0, w.player.pos + Vector2(0, -60))[0]
	run_world(w, 2.0)
	assert_gt(float(e.burn_stacks), 0.0, "burning")
	assert_lt(float(e.burn_stacks), 3.5, "stacks are capped")
	w.spell.form = "orb"
	w.enemies.clear()
	e.burn_time = 0.1
	w.enemies.append(e)
	w.player.pos = Vector2(168, 460)
	e.pos = Vector2(20, 20)
	w.spell.cooldown = 99.0
	run_world(w, 1.0)
	assert_eq(e.burn_stacks, 0, "burn expires")


func test_upgrades_change_the_spell() -> void:
	var w := make_world("orb")
	add_dummies(w, 1, 1000.0, w.player.pos + Vector2(0, -80))
	w.spell.levels["form"] = 2
	w.spell.cooldown = 0.0
	w.step(1.0 / 60.0, Vector2.ZERO)
	assert_eq(w.projectiles.size(), 2, "orb level 2 fires two projectiles")
	var sp := Spell.new()
	sp.form = "orbit"
	sp.levels["form"] = 3
	assert_eq(int(sp.fp("blades")), 5, "orbit level 3 has 5 blades")


func test_targeting_prefers_immediate_threats() -> void:
	var w := make_world("orb")
	var near := w.spawn_enemy("crawler", w.player.pos + Vector2(0, -90))
	var threat := w.spawn_enemy("charger", w.player.pos + Vector2(0, 110))
	threat.state = "telegraph"
	assert_eq(w.pick_target(300.0), threat, "a telegraphing enemy is targeted first")
	threat.state = "move"
	assert_eq(w.pick_target(300.0), near, "otherwise the closest")


func test_display_names() -> void:
	var sp := Spell.new()
	sp.form = "orb"
	sp.element = "fire"
	sp.catalyst = "echo"
	assert_eq(sp.display_name(), "Orbe de Fuego · Eco", "readable name")
	assert_eq(sp.combo_key(), "orb/fire/echo", "combo key")
