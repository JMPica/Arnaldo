class_name DamageModel
extends RefCounted
## Pure functions that turn physical events into integrity loss.
## Kept separate so balancing can be unit-tested and reasoned about.

## Integrity lost by an impact of `impact_speed` (px/s, normal component).
## surface: multiplier of the hit surface (awning 0.3, building 1, girder 1.3...).
## level_fragility: per-level multiplier (the tutorial is gentler).
static func impact_damage(impact_speed: float, cargo: CargoType, surface := 1.0,
		level_fragility := 1.0) -> float:
	var over := impact_speed - cargo.impact_threshold
	if over <= 0.0:
		return 0.0
	return over * cargo.damage_per_speed * cargo.fragility * surface * level_fragility


## Integrity lost while the cargo is tilted past its limit during dt seconds.
static func tilt_damage(tilt_deg: float, dt: float, cargo: CargoType, level_fragility := 1.0) -> float:
	if not cargo.is_tilt_sensitive():
		return 0.0
	var over := absf(tilt_deg) - cargo.tilt_limit_deg
	if over <= 0.0:
		return 0.0
	# Linear ramp: full rate at 20 degrees past the limit, capped at 2x.
	var factor := minf(over / 20.0, 2.0)
	return cargo.tilt_damage_rate * factor * dt * level_fragility


## Integrity lost while dragged along a surface at `slide_speed` px/s for dt.
static func scrape_damage(slide_speed: float, dt: float, cargo: CargoType, surface := 1.0,
		level_fragility := 1.0) -> float:
	if slide_speed < 90.0:
		return 0.0
	return cargo.scrape_rate * cargo.fragility * (slide_speed / 300.0) * surface * dt * level_fragility
