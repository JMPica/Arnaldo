class_name CargoIntegrity
extends RefCounted
## Integrity of the cargo (0..100) and its readable state.

signal damaged(amount: float, source: String, kind: String)
signal state_changed(new_state: int)
signal destroyed(source: String, kind: String)

enum State { INTACT, DAMAGED, CRITICAL, DESTROYED }

const MAX := 100.0
const DAMAGED_BELOW := 70.0
const CRITICAL_BELOW := 35.0

var value := MAX
var state := State.INTACT
var last_source := ""
var last_kind := ""
var total_hits := 0


static func state_for(v: float) -> int:
	if v <= 0.0:
		return State.DESTROYED
	if v < CRITICAL_BELOW:
		return State.CRITICAL
	if v < DAMAGED_BELOW:
		return State.DAMAGED
	return State.INTACT


static func state_name(s: int) -> String:
	match s:
		State.INTACT: return "Intact"
		State.DAMAGED: return "Damaged"
		State.CRITICAL: return "Critical"
		_: return "Destroyed"


func fraction() -> float:
	return value / MAX


func is_destroyed() -> bool:
	return state == State.DESTROYED


## Applies damage. kind is "impact", "tilt" or "scrape". Returns damage applied.
func apply(amount: float, source: String, kind: String) -> float:
	if amount <= 0.0 or is_destroyed():
		return 0.0
	var applied := minf(amount, value)
	value -= applied
	last_source = source
	last_kind = kind
	if kind == "impact":
		total_hits += 1
	damaged.emit(applied, source, kind)
	var new_state := state_for(value)
	if new_state != state:
		state = new_state
		state_changed.emit(state)
		if state == State.DESTROYED:
			destroyed.emit(source, kind)
	return applied
