class_name Obstacle
extends AnimatableBody2D
## A static or moving piece of level geometry. Its gameplay properties
## (surface hardness, label used in failure messages) come from
## data/obstacle_types.json. Moving obstacles follow a smooth back-and-forth
## path driven by the mission clock, so runs are deterministic.

var kind := "building"
var label := "a building"
var surface := 1.0
var scrape := 1.0                     ## multiplier for drag damage (0 on the landing pad)
var restitution_scale := 1.0
var size := Vector2(100, 100)
var motion := Vector2.ZERO
var period := 3.0
var phase := 0.0
var base_position := Vector2.ZERO
var motion_velocity := Vector2.ZERO   ## read by the rig to compute relative impact speeds
var art: Node2D


func configure(def: Dictionary, type_info: Dictionary) -> void:
	kind = def["type"]
	label = type_info.get("label", kind)
	surface = float(type_info.get("surface", 1.0))
	scrape = float(type_info.get("scrape", surface))
	restitution_scale = float(type_info.get("restitution_scale", 1.0))
	var rect: Rect2 = def["rect"]
	size = rect.size
	motion = def.get("motion", Vector2.ZERO)
	period = def.get("period", 3.0)
	phase = def.get("phase", 0.0)
	base_position = rect.get_center()
	position = base_position
	sync_to_physics = false
	collision_layer = 1
	collision_mask = 0

	var shape := RectangleShape2D.new()
	shape.size = size
	var cs := CollisionShape2D.new()
	cs.shape = shape
	add_child(cs)

	if kind == "crane":
		# The cable is solid too, so what you see is what you hit.
		var cable := RectangleShape2D.new()
		var cable_len := base_position.y + absf(motion.y) + 200.0
		cable.size = Vector2(6, cable_len)
		var cc := CollisionShape2D.new()
		cc.shape = cable
		cc.position = Vector2(0, -size.y * 0.5 - cable_len * 0.5)
		add_child(cc)

	art = ObstacleArt.new()
	art.setup(kind, size, int(def.get("variant", 0)), motion != Vector2.ZERO)
	add_child(art)


func is_moving() -> bool:
	return motion != Vector2.ZERO


## Moves the obstacle to its position at mission time t (seconds).
func advance(t: float, dt: float) -> void:
	if not is_moving():
		return
	var w := TAU / period
	var s := 0.5 - 0.5 * cos(w * t + phase)
	var new_pos := base_position + motion * s
	motion_velocity = (new_pos - position) / maxf(dt, 0.0001)
	position = new_pos
