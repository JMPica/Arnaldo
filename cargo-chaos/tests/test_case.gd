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

static var _data: GameData


static func game_data() -> GameData:
	if _data == null:
		_data = GameData.new()
		_data.load_all()
	return _data


static func cargo(id: String) -> CargoType:
	return game_data().cargo_types[id]


static func flight() -> FlightParams:
	return game_data().flight
