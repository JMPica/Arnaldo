class_name CourierRig
extends Node2D
## The courier, the rope and the cargo. Owns a RigModel (forces and state) and
## turns it into moving bodies with move_and_collide, using fixed sub-steps so
## the behaviour is the same at 30, 60 or 120 physics ticks per second.
## The rig node must sit at the world origin (local == global coordinates).

signal cargo_impact(point: Vector2, speed: float, damage: float, label: String)
signal courier_bonk(point: Vector2, speed: float)
signal courier_landed(point: Vector2, speed: float)

const LAYER_WORLD := 1
const LAYER_COURIER := 2
const LAYER_CARGO := 4
const FEEDBACK_IMPACT_SPEED := 70.0   ## harmless bumps above this still give a thud

var model: RigModel
var integrity := CargoIntegrity.new()
var level_fragility := 1.0

var courier: CharacterBody2D
var cargo_body: CharacterBody2D
var courier_art: CourierArt
var cargo_art: CargoArt
var rope_art: RopeArt

## Inputs, set by the game scene before each physics_step().
var thrusting := false
var target_speed := 0.0
var drive_enabled := true
var simulate := false
## Once the delivery is over the cargo can no longer be damaged.
var invulnerable := false

## Contact information gathered during the last physics_step().
var cargo_contact_body: Object = null
var cargo_contact_normal := Vector2.ZERO
var courier_on_floor := false

var _impact_cooldown := 0.0
var _last_impact := 0.0
var _scrape_pending := 0.0
var _scrape_label := ""
var _courier_was_on_floor := false


func setup(flight: FlightParams, cargo_type: CargoType, start_pos: Vector2, fragility := 1.0) -> void:
	model = RigModel.new(flight, cargo_type)
	model.place(start_pos)
	level_fragility = fragility

	rope_art = RopeArt.new()
	add_child(rope_art)

	cargo_body = CharacterBody2D.new()
	cargo_body.name = "Cargo"
	cargo_body.collision_layer = LAYER_CARGO
	cargo_body.collision_mask = LAYER_WORLD
	cargo_body.safe_margin = 0.5
	var cargo_shape := RectangleShape2D.new()
	cargo_shape.size = cargo_type.size
	var cs := CollisionShape2D.new()
	cs.shape = cargo_shape
	cargo_body.add_child(cs)
	cargo_art = CargoArt.new()
	cargo_art.setup(cargo_type)
	cargo_body.add_child(cargo_art)
	add_child(cargo_body)

	courier = CharacterBody2D.new()
	courier.name = "Courier"
	courier.collision_layer = LAYER_COURIER
	courier.collision_mask = LAYER_WORLD
	courier.safe_margin = 0.5
	var capsule := CapsuleShape2D.new()
	capsule.radius = flight.collision_size.x * 0.5
	capsule.height = flight.collision_size.y
	var ccs := CollisionShape2D.new()
	ccs.shape = capsule
	courier.add_child(ccs)
	courier_art = CourierArt.new()
	courier.add_child(courier_art)
	add_child(courier)

	_sync_nodes()
	_update_visuals(0.0)


## Teleports the rig (used when restarting).
func reset_to(start_pos: Vector2) -> void:
	model.place(start_pos)
	integrity = CargoIntegrity.new()
	_sync_nodes()
	_update_visuals(0.0)


func _sync_nodes() -> void:
	courier.global_position = model.courier_pos
	cargo_body.global_position = model.cargo_pos
	cargo_body.rotation = model.cargo_angle


func physics_step(dt: float) -> void:
	cargo_contact_body = null
	courier_on_floor = false
	if simulate:
		var steps := maxi(1, ceili(dt / model.flight.max_substep - 0.0001))
		var h := dt / steps
		for i in steps:
			_substep(h)
		_apply_tilt_damage(dt)
		_flush_scrape()
		if courier_on_floor and not _courier_was_on_floor:
			courier_landed.emit(courier.global_position + Vector2(0, 30), model.courier_vel.length())
		_courier_was_on_floor = courier_on_floor
	_update_visuals(dt)


func _substep(h: float) -> void:
	model.update_thrust(thrusting, h)
	model.step_velocities(h, target_speed, drive_enabled)
	_move_courier(h)
	if model.cargo_attached:
		_move_cargo(h)
		_enforce_rope()
	_impact_cooldown -= h


func _collider_velocity(obj: Object) -> Vector2:
	if obj is Obstacle:
		return (obj as Obstacle).motion_velocity
	return Vector2.ZERO


func _move_courier(h: float) -> void:
	var col := courier.move_and_collide(model.courier_vel * h)
	if col:
		_handle_courier_collision(col)
		var rest := col.get_remainder().slide(col.get_normal())
		if rest.length_squared() > 0.0001:
			var col2 := courier.move_and_collide(rest)
			if col2:
				_handle_courier_collision(col2)
	model.courier_pos = courier.global_position


func _handle_courier_collision(col: KinematicCollision2D) -> void:
	var n := col.get_normal()
	var stun_before := model.stun_time
	var impact := model.apply_courier_contact(n, _collider_velocity(col.get_collider()))
	if n.y < -0.6:
		courier_on_floor = true
		if model.courier_vel.length() < 20.0:
			model.courier_vel = Vector2.ZERO
	if model.stun_time > stun_before:
		courier_bonk.emit(col.get_position(), impact)


func _move_cargo(h: float) -> void:
	model.cargo_angle += model.cargo_ang_vel * h
	cargo_body.rotation = model.cargo_angle
	var col := cargo_body.move_and_collide(model.cargo_vel * h, false, 0.5, true)
	if col:
		_handle_cargo_collision(col, h)
		var rest := col.get_remainder().slide(col.get_normal())
		if rest.length_squared() > 0.0001:
			var col2 := cargo_body.move_and_collide(rest, false, 0.5, true)
			if col2:
				_handle_cargo_collision(col2, h)
	model.cargo_pos = cargo_body.global_position


func _handle_cargo_collision(col: KinematicCollision2D, h: float) -> void:
	var obj := col.get_collider()
	var n := col.get_normal()
	var p := col.get_position()
	var cvel := _collider_velocity(obj)
	var surface := 1.0
	var scrape_mult := 1.0
	var rscale := 1.0
	var label := "something"
	if obj is Obstacle:
		surface = obj.surface
		scrape_mult = obj.scrape
		rscale = obj.restitution_scale
		label = obj.label
	var tangent := Vector2(-n.y, n.x)
	var slide_speed := absf((model.cargo_point_velocity(p) - cvel).dot(tangent))
	var impact := model.apply_cargo_contact(n, p, cvel, rscale)
	cargo_contact_body = obj
	cargo_contact_normal = n
	# Static friction: a slow box lying on a floor comes to rest instead of
	# creeping inside the collision margin (no jitter, no phantom damage).
	if n.y < -0.7 and (model.cargo_vel - cvel).length() < 20.0:
		model.cargo_vel = cvel
		model.cargo_ang_vel *= 0.8

	if invulnerable:
		return
	if impact > 0.0 and (_impact_cooldown <= 0.0 or impact > _last_impact * 1.3):
		var dmg := DamageModel.impact_damage(impact, model.cargo, surface, level_fragility)
		if dmg > 0.0:
			_impact_cooldown = 0.15
			_last_impact = impact
			var applied := integrity.apply(dmg, label, "impact")
			cargo_impact.emit(p, impact, applied, label)
		elif impact > FEEDBACK_IMPACT_SPEED:
			_impact_cooldown = 0.15
			_last_impact = impact
			cargo_impact.emit(p, impact, 0.0, label)

	var scrape := DamageModel.scrape_damage(slide_speed, h, model.cargo, scrape_mult, level_fragility)
	if scrape > 0.0:
		_scrape_pending += scrape
		_scrape_label = label


func _flush_scrape() -> void:
	if _scrape_pending > 0.0 and not invulnerable:
		integrity.apply(_scrape_pending, _scrape_label, "scrape")
		_scrape_pending = 0.0


func _apply_tilt_damage(dt: float) -> void:
	if not model.cargo_attached or invulnerable:
		return
	var d := DamageModel.tilt_damage(model.tilt_degrees(), dt, model.cargo, level_fragility)
	if d > 0.0:
		integrity.apply(d, "too much tilt", "tilt")


func _enforce_rope() -> void:
	var corr := model.rope_limit_correction()
	if corr[0] != Vector2.ZERO:
		courier.move_and_collide(corr[0])
		model.courier_pos = courier.global_position
	if corr[1] != Vector2.ZERO:
		cargo_body.move_and_collide(corr[1])
		model.cargo_pos = cargo_body.global_position


## Cuts the rope (used when the cargo is destroyed).
func detach_cargo() -> void:
	model.cargo_attached = false
	rope_art.visible = false
	cargo_body.visible = false
	cargo_body.collision_layer = 0
	cargo_body.collision_mask = 0


func is_tilt_warning() -> bool:
	return model.cargo.is_tilt_sensitive() and absf(model.tilt_degrees()) > model.cargo.tilt_limit_deg * 0.8


func cargo_speed() -> float:
	return model.cargo_vel.length()


func _update_visuals(dt: float) -> void:
	courier_art.thrust = model.thrust_level
	courier_art.velocity = model.courier_vel
	courier_art.on_floor = courier_on_floor
	courier_art.stunned = model.stun_time > 0.0
	courier_art.advance(dt)
	cargo_art.integrity = integrity.fraction()
	cargo_art.tilt_warning = is_tilt_warning()
	cargo_art.advance(dt)
	rope_art.set_ends(model.rope_anchor(), model.cargo_attach_point(), model.cargo.rope_length)
