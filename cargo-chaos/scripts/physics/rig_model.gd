class_name RigModel
extends RefCounted
## Deterministic simulation of the courier + rope + cargo system.
##
## This class owns the physical state and the force model but knows nothing
## about nodes or collisions. The CourierRig node integrates positions with
## move_and_collide and feeds collision results back through
## apply_courier_contact() / apply_cargo_contact(). Tests can run it alone with
## integrate_free() at any timestep.

var flight: FlightParams
var cargo: CargoType

var courier_pos := Vector2.ZERO
var courier_vel := Vector2.ZERO
var cargo_pos := Vector2.ZERO
var cargo_vel := Vector2.ZERO
var cargo_angle := 0.0     ## radians, 0 = upright, positive = clockwise (Godot convention)
var cargo_ang_vel := 0.0
var thrust_level := 0.0    ## 0..1 after spool-up
var stun_time := 0.0       ## > 0 while recovering from a bonk (no forward drive)
var cargo_attached := true ## false once the cargo is destroyed (rope cut)
var landing_mode := false  ## over the delivery pad: the jetpack limits the fall speed

var rope_k := 0.0
var rope_c := 0.0
var cargo_inertia := 1.0
var last_rope_tension := 0.0


func _init(flight_params: FlightParams, cargo_type: CargoType) -> void:
	flight = flight_params
	cargo = cargo_type
	# The rope behaves like a spring tuned per cargo with a target frequency and
	# damping ratio. Using the reduced mass keeps it equally stable for a glass
	# box and a piano.
	var mu := flight.courier_mass * cargo.mass / (flight.courier_mass + cargo.mass)
	var omega := TAU * cargo.rope_frequency
	rope_k = mu * omega * omega
	rope_c = 2.0 * cargo.rope_damping_ratio * mu * omega
	cargo_inertia = cargo.inertia()


## Places the courier and hangs the cargo at rest straight below it.
func place(courier_position: Vector2) -> void:
	courier_pos = courier_position
	courier_vel = Vector2.ZERO
	cargo_angle = 0.0
	cargo_ang_vel = 0.0
	var hang := rope_anchor() + Vector2(0, cargo.rope_length)
	cargo_pos = hang + Vector2(0, cargo.size.y * 0.5)
	cargo_vel = Vector2.ZERO
	thrust_level = 0.0
	stun_time = 0.0
	cargo_attached = true


func rope_anchor() -> Vector2:
	return courier_pos + flight.rope_anchor


func cargo_attach_offset() -> Vector2:
	return Vector2(0, -cargo.size.y * 0.5).rotated(cargo_angle)


func cargo_attach_point() -> Vector2:
	return cargo_pos + cargo_attach_offset()


func rope_length_now() -> float:
	return rope_anchor().distance_to(cargo_attach_point())


## Direction of the rope seen from the cargo, as an angle (0 = straight up).
func rope_angle() -> float:
	var d := rope_anchor() - cargo_attach_point()
	return atan2(d.x, -d.y)


func rope_is_taut() -> bool:
	return rope_length_now() > cargo.rope_length


## Velocity of a point rigidly attached to the cargo.
func cargo_point_velocity(world_point: Vector2) -> Vector2:
	var r := world_point - cargo_pos
	return cargo_vel + Vector2(-cargo_ang_vel * r.y, cargo_ang_vel * r.x)


## Force the rope applies on the cargo (the courier receives the opposite).
## A rope only pulls: no force while slack.
func rope_force_on_cargo() -> Vector2:
	if not cargo_attached:
		return Vector2.ZERO
	var attach := cargo_attach_point()
	var d := rope_anchor() - attach
	var dist := d.length()
	if dist <= cargo.rope_length or dist < 0.0001:
		return Vector2.ZERO
	var dir := d / dist
	var stretch := dist - cargo.rope_length
	var closing_speed := (courier_vel - cargo_point_velocity(attach)).dot(dir)
	var f := rope_k * stretch + rope_c * closing_speed
	return dir * maxf(f, 0.0)


func update_thrust(thrusting: bool, dt: float) -> void:
	if thrusting:
		thrust_level = minf(1.0, thrust_level + dt / maxf(flight.thrust_spool_time, 0.0001))
	else:
		thrust_level = maxf(0.0, thrust_level - dt / maxf(flight.thrust_release_time, 0.0001))


## Target horizontal speed given the cruise speed and the thrust state.
func drive_speed(cruise_speed: float) -> float:
	return cruise_speed * (1.0 + flight.thrust_speed_bonus * thrust_level)


func max_fall() -> float:
	return flight.landing_max_fall_speed if landing_mode else flight.max_fall_speed


## Advances velocities by dt (semi-implicit Euler). Positions are not touched.
## target_speed is the desired horizontal speed (cruise, or braking target).
func step_velocities(dt: float, target_speed: float, drive_enabled := true) -> void:
	var rope_f := rope_force_on_cargo()
	last_rope_tension = rope_f.length()

	# --- Courier ---
	# Swing damping: damps the cargo's motion relative to the courier,
	# perpendicular to the rope. Equal and opposite on both bodies, so it
	# calms the pendulum without changing the system's momentum.
	var swing_f := Vector2.ZERO
	var rope_d := rope_anchor() - cargo_attach_point()
	if cargo_attached and rope_d.length_squared() > 0.0001:
		var dir := rope_d.normalized()
		var v_rel := cargo_vel - courier_vel
		var v_perp := v_rel - dir * v_rel.dot(dir)
		swing_f = -v_perp * cargo.swing_damping * cargo.mass

	var a_courier := Vector2(0, flight.gravity)
	# The jetpack never fully cuts out: idling keeps the load hanging under
	# tension while descending (a true free fall makes the cargo float).
	var lift := lerpf(flight.idle_thrust_accel, flight.thrust_accel, thrust_level)
	a_courier.y -= lift
	a_courier.y -= flight.vertical_damping * courier_vel.y
	a_courier -= (rope_f + swing_f) / flight.courier_mass
	if drive_enabled and stun_time <= 0.0:
		var want := clampf(flight.forward_gain * (target_speed - courier_vel.x),
				-flight.forward_max_accel, flight.forward_max_accel)
		a_courier.x += want
	courier_vel += a_courier * dt
	courier_vel.y = clampf(courier_vel.y, -flight.max_rise_speed, max_fall())
	stun_time = maxf(0.0, stun_time - dt)

	# --- Cargo (translation) ---
	var a_cargo := Vector2(0, flight.gravity)
	a_cargo += (rope_f + swing_f) / cargo.mass
	# Drag is horizontal only (it is what makes light cargo trail behind).
	# Vertically the cargo shares the courier's damping and fall limit, so both
	# fall together: otherwise a light box "kites" above the courier when diving.
	a_cargo.x -= cargo_vel.x * (cargo.air_drag / cargo.mass)
	a_cargo.y -= flight.vertical_damping * cargo_vel.y
	cargo_vel += a_cargo * dt
	if cargo_attached:
		cargo_vel.y = minf(cargo_vel.y, max_fall())

	# --- Cargo (rotation): the rope pulls on the top of the box, which makes
	# it align with the rope and wobble naturally. ---
	var torque := cargo_attach_offset().cross(rope_f)
	# A real load hangs from a 4-strap sling (bridle), not a single point: it
	# strongly couples the box to the rope direction. Without this term the box
	# behaves like a chaotic double pendulum, which feels unfair.
	if last_rope_tension > 0.0:
		torque -= cargo.bridle * last_rope_tension * sin(cargo_angle - rope_angle())
	var alpha := torque / cargo_inertia - cargo.angular_damping * cargo_ang_vel
	cargo_ang_vel += alpha * dt


## Advances positions without collisions (used by tests and previews).
func integrate_free(dt: float) -> void:
	courier_pos += courier_vel * dt
	cargo_pos += cargo_vel * dt
	cargo_angle += cargo_ang_vel * dt


## Convenience: one full collision-free step.
func step_free(dt: float, thrusting: bool, target_speed: float) -> void:
	update_thrust(thrusting, dt)
	step_velocities(dt, target_speed)
	integrate_free(dt)


## Returns the correction needed so the rope never stretches beyond 130% of its
## length (protects against tunnelling and explosions after big impacts).
## Result: [courier_offset, cargo_offset]. Also removes separating velocity.
func rope_limit_correction() -> Array:
	if not cargo_attached:
		return [Vector2.ZERO, Vector2.ZERO]
	var max_len := cargo.rope_length * 1.3
	var attach := cargo_attach_point()
	var d := attach - rope_anchor()
	var dist := d.length()
	if dist <= max_len or dist < 0.0001:
		return [Vector2.ZERO, Vector2.ZERO]
	var dir := d / dist
	var excess := dist - max_len
	var inv_p := 1.0 / flight.courier_mass
	var inv_c := 1.0 / cargo.mass
	var w_p := inv_p / (inv_p + inv_c)
	var w_c := inv_c / (inv_p + inv_c)
	var separating := (cargo_vel - courier_vel).dot(dir)
	if separating > 0.0:
		courier_vel += dir * separating * w_p
		cargo_vel -= dir * separating * w_c
	return [dir * excess * w_p, -dir * excess * w_c]


## Resolves a courier collision. Returns the impact speed (px/s into the surface).
func apply_courier_contact(normal: Vector2, collider_vel: Vector2) -> float:
	var rel := courier_vel - collider_vel
	var vn := rel.dot(normal)
	if vn >= 0.0:
		return 0.0
	var is_wall := absf(normal.x) > 0.6
	var e := flight.wall_bounce if is_wall else 0.0
	courier_vel -= normal * vn * (1.0 + e)
	if is_wall and normal.x < 0.0 and -vn > 120.0:
		stun_time = flight.bonk_stun_time
	return -vn


## Resolves a cargo collision with a rigid-body impulse at the contact point
## (restitution + Coulomb friction). Returns the impact speed into the surface.
func apply_cargo_contact(normal: Vector2, contact_point: Vector2, collider_vel: Vector2,
		restitution_scale := 1.0) -> float:
	var r := contact_point - cargo_pos
	var v_rel := cargo_point_velocity(contact_point) - collider_vel
	var vn := v_rel.dot(normal)
	if vn >= 0.0:
		return 0.0
	var impact := -vn
	# Gentle contacts do not bounce: avoids jitter while resting on a surface.
	var e := cargo.restitution * restitution_scale if impact > 80.0 else 0.0
	var inv_m := 1.0 / cargo.mass
	var inv_i := 1.0 / cargo_inertia
	var rn := r.cross(normal)
	var jn := -(1.0 + e) * vn / (inv_m + rn * rn * inv_i)
	cargo_vel += normal * jn * inv_m
	cargo_ang_vel += rn * jn * inv_i

	# Friction impulse, bounded by the Coulomb cone.
	var tangent := Vector2(-normal.y, normal.x)
	var vt := (cargo_point_velocity(contact_point) - collider_vel).dot(tangent)
	var rt := r.cross(tangent)
	var jt := clampf(-vt / (inv_m + rt * rt * inv_i), -cargo.friction * jn, cargo.friction * jn)
	cargo_vel += tangent * jt * inv_m
	cargo_ang_vel += rt * jt * inv_i
	return impact


## Signed tilt of the cargo in degrees, wrapped to [-180, 180].
func tilt_degrees() -> float:
	return rad_to_deg(wrapf(cargo_angle, -PI, PI))
