class_name FlightParams
extends RefCounted
## Tunable parameters of the courier's jetpack flight. Loaded from data/tuning.json
## so designers can tweak the feel without touching code.

var gravity := 1500.0              ## px/s^2, shared by courier and cargo
var courier_mass := 2.0            ## arbitrary mass units (cargo masses are relative to this)
var thrust_accel := 3300.0         ## jetpack acceleration on the courier alone, px/s^2
var idle_thrust_accel := 500.0     ## residual lift while the button is released, px/s^2
var thrust_spool_time := 0.04      ## seconds from 0 to full thrust (tiny: control must feel immediate)
var thrust_release_time := 0.06    ## seconds from full thrust to 0
var vertical_damping := 1.2        ## 1/s, linear damping on vertical speed
var max_rise_speed := 480.0        ## px/s
var max_fall_speed := 720.0        ## px/s
var forward_gain := 4.0            ## 1/s, how hard the auto-pilot holds the cruise speed
var forward_max_accel := 700.0     ## px/s^2
var thrust_speed_bonus := 0.08     ## fraction of cruise speed gained while thrusting
var wall_bounce := 0.3             ## restitution when the courier bonks into a wall
var bonk_stun_time := 0.35         ## seconds without forward drive after a frontal bonk
var collision_size := Vector2(40, 60)
var rope_anchor := Vector2(0, 22)  ## rope attachment relative to the courier centre
var max_substep := 1.0 / 120.0     ## the rig is integrated with fixed sub-steps no longer than this


static func from_dict(d: Dictionary) -> FlightParams:
	var p := FlightParams.new()
	for key in d.keys():
		if not key in p:
			push_warning("FlightParams: unknown key '%s' ignored" % key)
			continue
		var current = p.get(key)
		var value = d[key]
		if current is Vector2 and value is Array and value.size() == 2:
			p.set(key, Vector2(float(value[0]), float(value[1])))
		elif current is float:
			p.set(key, float(value))
		else:
			p.set(key, value)
	return p
