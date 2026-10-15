class_name Autopilot
extends RefCounted
## A simple bot that follows a level's reference path (autopilot_path).
## It is used by automated tests to prove every level is completable with the
## real physics, and by the attract mode on the main menu.
## It only presses the same single button a player has.

var level: LevelData
var lookahead := 90.0          ## px ahead of the courier to read the path
var gain := 3.0                ## desired vertical speed per px of error
var max_climb := 300.0
var max_dive := 260.0
var landing_dive := 110.0      ## gentle final descent onto the pad


func _init(level_data: LevelData) -> void:
	level = level_data


func wants_thrust(courier_pos: Vector2, courier_vel: Vector2, braking: bool) -> bool:
	var target_y := level.path_y_at(courier_pos.x + lookahead)
	if braking:
		target_y = level.path_y_at(courier_pos.x)
	var desired_vy := clampf((target_y - courier_pos.y) * gain, -max_climb,
			landing_dive if braking else max_dive)
	return courier_vel.y > desired_vy
