class_name TouchStick
extends Control
## Dynamic one-finger joystick: it appears where the finger lands and follows
## the finger if it goes past the edge, so it never "runs out". Also maps
## WASD / arrow keys and mouse drag for desktop testing.

const RADIUS := 34.0
const DEADZONE := 0.12

var direction := Vector2.ZERO
var excluded: Array[Rect2] = []   ## screen rects owned by buttons (pause...)
var enabled := true

var _active := false
var _touch_index := -1
var _base := Vector2.ZERO
var _knob := Vector2.ZERO


func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE


func release() -> void:
	_active = false
	_touch_index = -1
	direction = Vector2.ZERO
	queue_redraw()


func _is_excluded(p: Vector2) -> bool:
	for r in excluded:
		if r.has_point(p):
			return true
	return false


func _input(event: InputEvent) -> void:
	if not enabled or not is_visible_in_tree():
		return
	if event is InputEventScreenTouch:
		if event.pressed and not _active and not _is_excluded(event.position):
			_start(event.position, event.index)
		elif not event.pressed and event.index == _touch_index:
			release()
	elif event is InputEventScreenDrag and _active and event.index == _touch_index:
		_drag(event.position)
	elif event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT \
			and event.device != InputEvent.DEVICE_ID_EMULATION:
		if event.pressed and not _active and not _is_excluded(event.position):
			_start(event.position, -2)
		elif not event.pressed and _touch_index == -2:
			release()
	elif event is InputEventMouseMotion and _active and _touch_index == -2 \
			and event.device != InputEvent.DEVICE_ID_EMULATION:
		_drag(event.position)


func _start(p: Vector2, index: int) -> void:
	_active = true
	_touch_index = index
	_base = p
	_knob = p
	direction = Vector2.ZERO
	queue_redraw()


func _drag(p: Vector2) -> void:
	var off := p - _base
	if off.length() > RADIUS:
		_base = p - off.normalized() * RADIUS   # the base follows the finger
		off = p - _base
	_knob = _base + off
	var v := off / RADIUS
	direction = v if v.length() > DEADZONE else Vector2.ZERO
	queue_redraw()


## Final movement input: touch/mouse joystick, else keyboard.
func get_vector() -> Vector2:
	if _active:
		return direction
	var k := Vector2(Input.get_axis("ui_left", "ui_right"), Input.get_axis("ui_up", "ui_down"))
	if Input.is_physical_key_pressed(KEY_A): k.x -= 1.0
	if Input.is_physical_key_pressed(KEY_D): k.x += 1.0
	if Input.is_physical_key_pressed(KEY_W): k.y -= 1.0
	if Input.is_physical_key_pressed(KEY_S): k.y += 1.0
	return k.limit_length(1.0)


func _draw() -> void:
	if not _active:
		return
	draw_arc(_base, RADIUS, 0, TAU, 24, Color(0.79, 0.65, 1.0, 0.35), 2.0)
	draw_circle(_base, 3.0, Color(0.79, 0.65, 1.0, 0.35))
	draw_circle(_knob, 12.0, Color(0.05, 0.04, 0.08, 0.5))
	draw_circle(_knob, 10.0, Color(0.49, 0.31, 0.76, 0.75))
