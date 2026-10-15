class_name TestCase
extends Node
## Base class for tests. Methods named test_* are run by tests/test_runner.gd.
## Tests may be coroutines (use `await` for physics frames).

var failures: Array[String] = []
var notes: Array[String] = []


func assert_true(cond: bool, msg := "expected true") -> void:
	if not cond:
		failures.append(msg)


func assert_false(cond: bool, msg := "expected false") -> void:
	if cond:
		failures.append(msg)


func assert_eq(actual, expected, msg := "") -> void:
	if typeof(actual) != typeof(expected) or actual != expected:
		failures.append("%s: expected <%s> got <%s>" % [msg, str(expected), str(actual)])


func assert_near(actual: float, expected: float, tolerance: float, msg := "") -> void:
	if absf(actual - expected) > tolerance:
		failures.append("%s: expected %.4f ± %.4f got %.4f" % [msg, expected, tolerance, actual])


func assert_gt(actual: float, limit: float, msg := "") -> void:
	if not actual > limit:
		failures.append("%s: expected > %.4f got %.4f" % [msg, limit, actual])


func assert_lt(actual: float, limit: float, msg := "") -> void:
	if not actual < limit:
		failures.append("%s: expected < %.4f got %.4f" % [msg, limit, actual])


## Records a metric that ends up in the test report (not an assertion).
func note(text: String) -> void:
	notes.append(text)


func physics_frames(n: int) -> void:
	for i in n:
		await get_tree().physics_frame


## Shared fixtures --------------------------------------------------------

static func db() -> GameDB:
	return GameDB.get_db()


## A world with no obstacles and a spell already composed.
static func make_world(form: String, element := "", catalyst := "", seed_v := 1) -> CombatWorld:
	var sp := Spell.new()
	sp.form = form
	sp.element = element
	sp.catalyst = catalyst
	var w := CombatWorld.new()
	w.setup(seed_v, sp, [])
	w.invulnerable = true
	w.player.pos = Vector2(168, 300)
	return w


## Static target dummies (speed 0) around a point.
static func add_dummies(w: CombatWorld, n: int, hp: float, center: Vector2, spread := 30.0) -> Array[Enemy]:
	var out: Array[Enemy] = []
	for i in n:
		var e := w.spawn_enemy("crawler", center + Vector2.from_angle(TAU * i / n) * spread * (0.5 + 0.5 * (i % 2)))
		e.speed = 0.0
		e.contact = 0.0
		e.hp = hp
		e.max_hp = hp
		out.append(e)
	return out


static func run_world(w: CombatWorld, seconds: float, move := Vector2.ZERO) -> void:
	var t := 0.0
	while t < seconds:
		w.step(1.0 / 60.0, move)
		t += 1.0 / 60.0
