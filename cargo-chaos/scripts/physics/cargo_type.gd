class_name CargoType
extends RefCounted
## Physical and damage description of a kind of cargo (data/cargo_types.json).

var id := ""
var display_name := ""
var description := ""
var mass := 0.5
var size := Vector2(56, 56)
var rope_length := 80.0
var rope_frequency := 4.0          ## Hz, natural frequency of the rope "spring"
var rope_damping_ratio := 0.4      ## 0 = bouncy, 1 = critically damped
var air_drag := 0.5                ## linear drag force per px/s (makes light cargo trail behind)
var swing_damping := 1.5          ## 1/s, damps the pendulum swing relative to the courier
var angular_damping := 3.0         ## 1/s
var inertia_scale := 1.0           ## multiplies the inertia of a uniform box
var bridle := 30.0                 ## px, lever of the 4-strap sling that keeps the box aligned with the rope
var restitution := 0.2
var friction := 0.6
var fragility := 1.0               ## damage multiplier
var impact_threshold := 110.0      ## px/s; slower impacts never cause damage (no unfair micro-hits)
var damage_per_speed := 0.18       ## integrity points per px/s above the threshold (before fragility)
var tilt_limit_deg := 0.0          ## 0 = not tilt sensitive
var tilt_damage_rate := 0.0        ## integrity/s at the reference over-tilt (20 degrees past the limit)
var scrape_rate := 10.0            ## integrity/s when dragged along a surface at 300 px/s
var hud_color := Color.WHITE
var art := "glass_box"


static func from_dict(id_value: String, d: Dictionary) -> CargoType:
	var c := CargoType.new()
	c.id = id_value
	for key in d.keys():
		if not key in c:
			push_warning("CargoType '%s': unknown key '%s' ignored" % [id_value, key])
			continue
		var current = c.get(key)
		var value = d[key]
		if current is Vector2 and value is Array and value.size() == 2:
			c.set(key, Vector2(float(value[0]), float(value[1])))
		elif current is Color and value is String:
			c.set(key, Color(value))
		elif current is float:
			c.set(key, float(value))
		else:
			c.set(key, value)
	return c


## Moment of inertia of the cargo box around its centre.
func inertia() -> float:
	return mass * (size.x * size.x + size.y * size.y) / 12.0 * inertia_scale


func is_tilt_sensitive() -> bool:
	return tilt_limit_deg > 0.0 and tilt_damage_rate > 0.0
