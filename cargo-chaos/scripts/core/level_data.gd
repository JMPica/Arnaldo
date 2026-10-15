class_name LevelData
extends RefCounted
## A mission definition, parsed and validated from data/levels/*.json.
## New missions are added by writing a JSON file and listing it in
## data/levels/index.json: no code changes needed.

var id := ""
var name := ""
var subtitle := ""
var teaches := ""
var cargo_id := ""
var fragility_multiplier := 1.0
var cruise_speed := 270.0
var time_limit := 0.0              ## seconds, 0 = none
var reward_coins := 0
var difficulty := 1
var theme := "day"
var start := Vector2(200, 300)
var is_tutorial := false
var obstacles: Array[Dictionary] = []   ## normalised: {type, rect: Rect2, motion: Vector2, period, phase}
var pad_center_x := 0.0
var pad_width := 240.0
var pad_top := 560.0
var hints: Array[Dictionary] = []       ## {x, text}
var autopilot_path := PackedVector2Array()
var length := 0.0                       ## derived: end of the level in px


## Builds a LevelData from a parsed JSON dictionary. Errors are appended to
## `errors`; the returned object is only safe to use when errors is empty.
static func from_dict(d: Dictionary, world: Dictionary, obstacle_types: Dictionary,
		errors: Array[String]) -> LevelData:
	var lv := LevelData.new()
	var ground_y := float(world.get("ground_y", 650))
	var ceiling_y := float(world.get("ceiling_y", 0))

	for key in ["id", "name", "cargo", "cruise_speed", "delivery"]:
		if not d.has(key):
			errors.append("missing required field '%s'" % key)
	if not errors.is_empty():
		return lv

	lv.id = str(d["id"])
	lv.name = str(d["name"])
	lv.subtitle = str(d.get("subtitle", ""))
	lv.teaches = str(d.get("teaches", ""))
	lv.cargo_id = str(d["cargo"])
	lv.fragility_multiplier = float(d.get("fragility_multiplier", 1.0))
	lv.cruise_speed = float(d["cruise_speed"])
	lv.time_limit = float(d.get("time_limit", 0.0))
	lv.reward_coins = int(d.get("reward_coins", 0))
	lv.difficulty = int(d.get("difficulty", 1))
	lv.theme = str(d.get("theme", "day"))
	lv.is_tutorial = bool(d.get("tutorial", false))
	var s = d.get("start", [200, 300])
	lv.start = Vector2(float(s[0]), float(s[1]))

	if lv.cruise_speed < 100.0 or lv.cruise_speed > 600.0:
		errors.append("cruise_speed %.0f out of range [100, 600]" % lv.cruise_speed)
	if lv.fragility_multiplier <= 0.0:
		errors.append("fragility_multiplier must be > 0")

	var i := 0
	for o in d.get("obstacles", []):
		var ob := _normalise_obstacle(o, ground_y, ceiling_y, obstacle_types, errors, i)
		if not ob.is_empty():
			lv.obstacles.append(ob)
		i += 1

	var dl: Dictionary = d["delivery"]
	lv.pad_center_x = float(dl.get("x", 0))
	lv.pad_width = float(dl.get("width", 240))
	lv.pad_top = float(dl.get("top", ground_y - 90))
	if lv.pad_center_x <= lv.start.x + 400.0:
		errors.append("delivery.x must be well after the start")
	if lv.pad_top >= ground_y or lv.pad_top < ceiling_y + 250.0:
		errors.append("delivery.top %.0f must be between ceiling+250 and the ground" % lv.pad_top)
	lv.length = lv.pad_center_x + lv.pad_width * 0.5 + 500.0

	for h in d.get("hints", []):
		lv.hints.append({"x": float(h.get("x", 0)), "text": str(h.get("text", ""))})

	for p in d.get("autopilot_path", []):
		lv.autopilot_path.append(Vector2(float(p[0]), float(p[1])))
	if lv.autopilot_path.size() < 2:
		errors.append("autopilot_path needs at least 2 points (used to prove the level is completable)")
	return lv


static func _normalise_obstacle(o: Dictionary, ground_y: float, ceiling_y: float,
		obstacle_types: Dictionary, errors: Array[String], index: int) -> Dictionary:
	var type := str(o.get("type", ""))
	if not obstacle_types.has(type):
		errors.append("obstacle #%d: unknown type '%s'" % [index, type])
		return {}
	var rect := Rect2()
	if o.has("rect"):
		var r: Array = o["rect"]
		rect = Rect2(float(r[0]), float(r[1]), float(r[2]), float(r[3]))
	elif o.has("height"):
		# Grows up from the ground.
		var h := float(o["height"])
		rect = Rect2(float(o.get("x", 0)), ground_y - h, float(o.get("width", 100)), h)
	elif o.has("bottom"):
		# Hangs down from the ceiling.
		var b := float(o["bottom"])
		rect = Rect2(float(o.get("x", 0)), ceiling_y, float(o.get("width", 100)), b - ceiling_y)
	else:
		errors.append("obstacle #%d (%s): needs 'rect', 'height' or 'bottom'" % [index, type])
		return {}
	if rect.size.x <= 0.0 or rect.size.y <= 0.0:
		errors.append("obstacle #%d (%s): empty size" % [index, type])
		return {}
	var motion := Vector2.ZERO
	if o.has("move"):
		motion = Vector2(float(o["move"][0]), float(o["move"][1]))
	return {
		"type": type,
		"rect": rect,
		"motion": motion,
		"period": maxf(float(o.get("period", 3.0)), 0.5),
		"phase": float(o.get("phase", 0.0)),
		"variant": int(o.get("variant", index)),
	}


## Height of the autopilot reference path at x (linear interpolation).
func path_y_at(x: float) -> float:
	if autopilot_path.is_empty():
		return start.y
	if x <= autopilot_path[0].x:
		return autopilot_path[0].y
	for i in range(1, autopilot_path.size()):
		var a := autopilot_path[i - 1]
		var b := autopilot_path[i]
		if x <= b.x:
			var t := (x - a.x) / maxf(b.x - a.x, 0.001)
			return lerpf(a.y, b.y, t)
	return autopilot_path[autopilot_path.size() - 1].y
