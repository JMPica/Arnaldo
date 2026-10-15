class_name LevelWorld
extends Node2D
## Builds the physical level (street, ceiling, obstacles, delivery pad) from a
## LevelData, and drives the moving obstacles with the mission clock.

var level: LevelData
var obstacles: Array[Obstacle] = []
var movers: Array[Obstacle] = []
var pad: Obstacle
var ground_y := 650.0
var ceiling_y := 0.0


func build(level_data: LevelData, data: GameData) -> void:
	level = level_data
	ground_y = float(data.world.get("ground_y", 650))
	ceiling_y = float(data.world.get("ceiling_y", 0))
	var span_start := -800.0
	var span_end := level.length + 1600.0

	# Street (solid ground) and an invisible ceiling.
	_add({"type": "street", "rect": Rect2(span_start, ground_y, span_end - span_start, 600.0)},
			data.obstacle_types["street"])
	_add({"type": "ceiling", "rect": Rect2(span_start, ceiling_y - 400.0, span_end - span_start, 400.0)},
			{"label": "the sky", "surface": 1.0})
	# A wall far after the pad so nothing can fly off the map.
	_add({"type": "ceiling", "rect": Rect2(level.length + 200.0, ceiling_y - 400.0, 400.0, ground_y + 800.0)},
			{"label": "a wall", "surface": 1.0})

	for def in level.obstacles:
		var ob := _add(def, data.obstacle_types[def["type"]])
		if ob.is_moving():
			movers.append(ob)

	var pad_rect := Rect2(level.pad_center_x - level.pad_width * 0.5, level.pad_top,
			level.pad_width, ground_y - level.pad_top)
	pad = _add({"type": "pad", "rect": pad_rect}, data.obstacle_types["pad"])


func _add(def: Dictionary, type_info: Dictionary) -> Obstacle:
	var ob := Obstacle.new()
	ob.configure(def, type_info)
	add_child(ob)
	obstacles.append(ob)
	return ob


func advance_movers(t: float, dt: float) -> void:
	for m in movers:
		m.advance(t, dt)
