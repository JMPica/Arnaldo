class_name Spell
extends RefCounted
## A spell = Form rune + Element rune + Catalyst rune (element and catalyst are
## optional). The three parts never know about each other: they communicate
## through three common events, so 3 x 3 x 3 = 27 combinations come out of 9
## small, reusable behaviours.
##
##   on_cast(world, is_echo)          - the form fired (Echo listens)
##   on_hit(world, enemy, source)     - something hit an enemy (Element, Rebound)
##   on_kill(world, enemy, source)    - an enemy died to the spell (Rupture)
##
## A damage `source` is a Dictionary: {kind, primary, depth, blockable}.
##   primary: true only for direct hits of the form (Rebound counts these)
##   depth:   0 for the spell itself, 1 for effects caused by catalysts;
##            depth-1 kills never trigger Rupture again (no infinite chains).

var db: GameDB
var form := "orb"
var element := ""
var catalyst := ""
var levels := {"form": 1, "element": 1, "catalyst": 1}

# Run-wide modifiers (upgrade cards)
var damage_mult := 1.0
var rate_mult := 1.0
var element_mult := 1.0
var catalyst_bonus := 0

# Runtime state
var cooldown := 0.3
var orbit_angle := 0.0
var orbit_burst := 0.0
var storm_charge := 0     ## Storm: hits stored towards the next discharge
var _cast_count := 0
var _primary_hits := 0
var _echo_queue: Array[float] = []

var stats := {}


func _init(database: GameDB = null) -> void:
	db = database if database else GameDB.get_db()
	reset_stats()


func reset_stats() -> void:
	stats = {"casts": 0, "echoes": 0, "hits": 0, "kills": 0, "explosions": 0, "rebounds": 0,
		"discharges": 0, "burn_ticks": 0, "slows": 0, "blocked": 0, "damage": 0.0}


## Clears per-room timers (called when entering a new room).
func reset_runtime() -> void:
	cooldown = 0.4
	orbit_burst = 0.0
	storm_charge = 0
	_echo_queue.clear()


func form_def() -> Dictionary:
	return db.rune("forms", form)


func element_def() -> Dictionary:
	return db.rune("elements", element)


func catalyst_def() -> Dictionary:
	return db.rune("catalysts", catalyst)


func fp(name: String, fallback = 0.0):
	return GameDB.param(form_def(), name, levels["form"], fallback)


func ep(name: String, fallback = 0.0):
	return GameDB.param(element_def(), name, levels["element"], fallback)


func cp(name: String, fallback = 0.0):
	return GameDB.param(catalyst_def(), name, levels["catalyst"], fallback)


func combo_key() -> String:
	return "%s/%s/%s" % [form, element if element != "" else "-", catalyst if catalyst != "" else "-"]


func is_complete() -> bool:
	return element != "" and catalyst != ""


## Readable name, e.g. "Orbe de Fuego · Eco".
func display_name() -> String:
	var n: String = form_def().get("name", form)
	if element != "":
		n += " de " + str(element_def().get("name", element))
	if catalyst != "":
		n += " · " + str(catalyst_def().get("name", catalyst))
	return n


func form_damage() -> float:
	return float(fp("damage", 8.0)) * damage_mult


func update(dt: float, world: CombatWorld) -> void:
	cooldown -= dt
	# Pending echoes.
	for i in range(_echo_queue.size() - 1, -1, -1):
		_echo_queue[i] -= dt
		if _echo_queue[i] <= 0.0:
			_echo_queue.remove_at(i)
			if RuneForms.activate(self, world, true):
				stats["echoes"] += 1
	if form == "orbit":
		RuneForms.orbit_tick(self, world, dt)
	if cooldown <= 0.0 and world.has_targets():
		if RuneForms.activate(self, world, false):
			cooldown = float(fp("cooldown", 1.0)) / rate_mult
		else:
			cooldown = 0.1  # nothing in range: check again soon


# ------------------------------------------------------------------ events --

func on_cast(_world: CombatWorld, is_echo: bool) -> void:
	stats["casts"] += 1
	if catalyst == "echo" and not is_echo:
		_cast_count += 1
		var every := maxi(2, int(cp("every", 3)) - catalyst_bonus)
		if _cast_count % every == 0:
			_echo_queue.append(float(cp("delay", 0.2)))


func on_hit(world: CombatWorld, enemy: Enemy, source: Dictionary) -> void:
	stats["hits"] += 1
	if element != "":
		RuneElements.apply(self, world, enemy, source)
	if catalyst == "rebound" and source.get("primary", false):
		_primary_hits += 1
		var every := maxi(2, int(cp("every", 5)) - catalyst_bonus)
		if _primary_hits % every == 0:
			RuneCatalysts.rebound(self, world, enemy)


func on_kill(world: CombatWorld, enemy: Enemy, source: Dictionary) -> void:
	stats["kills"] += 1
	if catalyst == "rupture" and int(source.get("depth", 0)) == 0:
		RuneCatalysts.rupture(self, world, enemy)
