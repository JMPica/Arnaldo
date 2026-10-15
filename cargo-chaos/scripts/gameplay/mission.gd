class_name Mission
extends RefCounted
## Rules of a delivery: when it starts, when it is won and why it is lost.
## Pure logic (no nodes) so every win/lose condition is unit-testable.

signal state_changed(state: int)
signal finished(success: bool, reason: String)

enum State { READY, RUNNING, BRAKING, SUCCESS, FAILED }

var level: LevelData
var cargo_name := ""
var state := State.READY
var elapsed := 0.0
var settle_time_required := 0.35
var settle_speed := 70.0
var brake_distance := 320.0
var brake_decel := 180.0
var result_reason := ""
var _settle_timer := 0.0


func _init(level_data: LevelData, cargo_display_name: String, world: Dictionary = {}) -> void:
	level = level_data
	cargo_name = cargo_display_name
	settle_time_required = float(world.get("delivery_settle_time", settle_time_required))
	settle_speed = float(world.get("delivery_settle_speed", settle_speed))
	brake_distance = float(world.get("brake_distance", brake_distance))


func is_playing() -> bool:
	return state == State.RUNNING or state == State.BRAKING


func is_over() -> bool:
	return state == State.SUCCESS or state == State.FAILED


func start() -> void:
	if state != State.READY:
		return
	elapsed = 0.0
	_set_state(State.RUNNING)


func time_left() -> float:
	if level.time_limit <= 0.0:
		return INF
	return maxf(level.time_limit - elapsed, 0.0)


## Horizontal speed the courier should aim for at x. Cruise speed until the
## delivery zone, then a constant-deceleration stop centred on the pad.
func target_speed_at(courier_x: float) -> float:
	if state == State.READY or is_over():
		return 0.0
	var dist := level.pad_center_x - courier_x
	if dist > brake_distance:
		return level.cruise_speed
	# v = sqrt(2 a d) gives a smooth, readable stop exactly over the pad.
	return minf(level.cruise_speed, sqrt(2.0 * brake_decel * maxf(dist, 0.0)))


## Advances the rules by dt.
## ctx keys: courier_x (float), integrity (CargoIntegrity),
## cargo_on_pad (bool), cargo_speed (float), cargo_tilt_ok (bool)
func tick(dt: float, ctx: Dictionary) -> void:
	if not is_playing():
		return
	elapsed += dt
	var integrity: CargoIntegrity = ctx["integrity"]
	if integrity.is_destroyed():
		_fail(_destroyed_reason(integrity))
		return
	if level.time_limit > 0.0 and elapsed >= level.time_limit:
		_fail("Time's up! The customer couldn't wait any longer.")
		return
	if state == State.RUNNING and level.pad_center_x - float(ctx["courier_x"]) <= brake_distance:
		_set_state(State.BRAKING)
	if state == State.BRAKING:
		var resting: bool = ctx.get("cargo_on_pad", false) and float(ctx.get("cargo_speed", 999.0)) < settle_speed \
				and ctx.get("cargo_tilt_ok", true)
		_settle_timer = _settle_timer + dt if resting else 0.0
		if _settle_timer >= settle_time_required:
			result_reason = "Delivered with %d%% integrity." % roundi(integrity.value)
			_set_state(State.SUCCESS)
			finished.emit(true, result_reason)


func _destroyed_reason(integrity: CargoIntegrity) -> String:
	match integrity.last_kind:
		"tilt":
			return "The %s tipped over. Keep it level!" % cargo_name
		"scrape":
			return "The %s was dragged along %s until it fell apart." % [cargo_name, integrity.last_source]
		_:
			return "The %s smashed into %s." % [cargo_name, integrity.last_source]


func _fail(reason: String) -> void:
	result_reason = reason
	_set_state(State.FAILED)
	finished.emit(false, reason)


func _set_state(s: int) -> void:
	state = s
	state_changed.emit(s)


## 1 to 3 stars from the final integrity.
static func stars_for(integrity_value: float) -> int:
	if integrity_value >= 90.0:
		return 3
	if integrity_value >= 60.0:
		return 2
	return 1


## Coins earned: the level reward scaled by integrity (never zero on success).
static func coins_for(reward: int, integrity_value: float) -> int:
	return maxi(1, roundi(reward * clampf(integrity_value / 100.0, 0.2, 1.0)))
