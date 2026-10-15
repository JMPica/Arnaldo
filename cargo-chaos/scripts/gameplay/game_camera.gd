class_name GameCamera
extends Camera2D
## Side-scrolling camera: follows the courier horizontally (keeping room to see
## what is coming), fixed vertically so the whole playfield is always readable.
## Screen shake is "trauma" based, small and short: it must inform, not hide.

const VIEW_HEIGHT := 720.0
var lead_fraction := 0.32      ## courier sits at 32% of the screen width
var trauma := 0.0
var max_shake := 14.0
var _t := 0.0


func _ready() -> void:
	process_callback = Camera2D.CAMERA2D_PROCESS_PHYSICS
	position_smoothing_enabled = false
	limit_left = 0
	limit_top = -100000
	limit_bottom = 100000


func follow(target_x: float, level_end: float) -> void:
	var width := get_viewport_rect().size.x
	var x := target_x + width * (0.5 - lead_fraction)
	x = clampf(x, width * 0.5, maxf(level_end - width * 0.5, width * 0.5))
	position = Vector2(x, VIEW_HEIGHT * 0.5)


func add_trauma(amount: float) -> void:
	trauma = clampf(trauma + amount, 0.0, 1.0)


func _process(delta: float) -> void:
	_t += delta
	if trauma > 0.0:
		trauma = maxf(0.0, trauma - delta * 2.2)
		var s := trauma * trauma * max_shake
		offset = Vector2(sin(_t * 61.0) * s, cos(_t * 47.0) * s * 0.7)
	else:
		offset = Vector2.ZERO
