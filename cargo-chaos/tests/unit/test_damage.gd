extends TestCase
## Damage model and integrity states.


func test_no_damage_below_threshold() -> void:
	for id in ["glass_box", "heavy_piano", "birthday_cake"]:
		var c := cargo(id)
		assert_eq(DamageModel.impact_damage(c.impact_threshold - 1.0, c), 0.0, id + " below threshold")
		assert_eq(DamageModel.impact_damage(40.0, c), 0.0, id + " micro-vibration")


func test_damage_grows_with_speed() -> void:
	var c := cargo("glass_box")
	var d1 := DamageModel.impact_damage(250.0, c)
	var d2 := DamageModel.impact_damage(400.0, c)
	assert_gt(d1, 0.0, "a real hit hurts")
	assert_gt(d2, d1, "faster hits hurt more")


func test_fragility_orders_cargo() -> void:
	var glass := DamageModel.impact_damage(350.0, cargo("glass_box"))
	var cake := DamageModel.impact_damage(350.0, cargo("birthday_cake"))
	var piano := DamageModel.impact_damage(350.0, cargo("heavy_piano"))
	note("damage at 350 px/s: glass %.1f, cake %.1f, piano %.1f" % [glass, cake, piano])
	assert_gt(glass, cake, "glass more fragile than cake")
	assert_gt(cake, piano, "cake more fragile than piano")


func test_surface_and_level_multipliers() -> void:
	var c := cargo("glass_box")
	var hard := DamageModel.impact_damage(300.0, c, 1.0)
	var soft := DamageModel.impact_damage(300.0, c, 0.3)
	assert_near(soft, hard * 0.3, 0.001, "awnings are softer")
	var tutorial := DamageModel.impact_damage(300.0, c, 1.0, 0.5)
	assert_near(tutorial, hard * 0.5, 0.001, "level fragility multiplier")


func test_tilt_damage_only_for_tilt_sensitive_cargo_past_limit() -> void:
	var cake := cargo("birthday_cake")
	assert_eq(DamageModel.tilt_damage(cake.tilt_limit_deg - 1.0, 1.0, cake), 0.0, "within limit")
	assert_gt(DamageModel.tilt_damage(cake.tilt_limit_deg + 10.0, 1.0, cake), 0.0, "past limit")
	assert_eq(DamageModel.tilt_damage(80.0, 1.0, cargo("glass_box")), 0.0, "glass ignores tilt")
	var a := DamageModel.tilt_damage(-(cake.tilt_limit_deg + 10.0), 1.0, cake)
	var b := DamageModel.tilt_damage(cake.tilt_limit_deg + 10.0, 1.0, cake)
	assert_near(a, b, 0.0001, "tilt is symmetric")


func test_scrape_needs_real_sliding() -> void:
	var c := cargo("glass_box")
	assert_eq(DamageModel.scrape_damage(50.0, 1.0, c), 0.0, "slow slide is free")
	assert_gt(DamageModel.scrape_damage(300.0, 1.0, c), 0.0, "fast drag hurts")


func test_integrity_states_and_signals() -> void:
	var integ := CargoIntegrity.new()
	var destroyed_count := [0]
	integ.destroyed.connect(func(_s, _k): destroyed_count[0] += 1)
	assert_eq(integ.state, CargoIntegrity.State.INTACT, "starts intact")
	integ.apply(35.0, "a building", "impact")
	assert_eq(integ.state, CargoIntegrity.State.DAMAGED, "65 = damaged")
	integ.apply(35.0, "a building", "impact")
	assert_eq(integ.state, CargoIntegrity.State.CRITICAL, "30 = critical")
	var applied := integ.apply(500.0, "a girder", "impact")
	assert_near(applied, 30.0, 0.001, "damage clamps to remaining integrity")
	assert_eq(integ.state, CargoIntegrity.State.DESTROYED, "destroyed")
	assert_eq(integ.apply(10.0, "x", "impact"), 0.0, "no damage after destroyed")
	assert_eq(destroyed_count[0], 1, "destroyed emitted once")
	assert_eq(integ.last_source, "a girder", "remembers what broke it")
	assert_eq(integ.total_hits, 3, "hit count")
