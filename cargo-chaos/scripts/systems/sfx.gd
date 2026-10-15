extends Node
## Sound effects (autoload "Sfx"). Sounds are optional files in assets/audio;
## a missing file is silently skipped so audio can never break gameplay.

const SOUNDS := ["click", "thud", "hit_glass", "hit_piano", "hit_cake", "shatter", "crash_piano",
		"splat", "bonk", "success", "fail", "land", "start"]
const POOL_SIZE := 8

var _streams: Dictionary = {}
var _pool: Array[AudioStreamPlayer] = []
var _next := 0
var _jet: AudioStreamPlayer
var _jet_level := 0.0


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	for n in SOUNDS:
		var path := "res://assets/audio/%s.wav" % n
		if ResourceLoader.exists(path):
			_streams[n] = load(path)
	for i in POOL_SIZE:
		var p := AudioStreamPlayer.new()
		add_child(p)
		_pool.append(p)
	_jet = AudioStreamPlayer.new()
	add_child(_jet)
	var jet_path := "res://assets/audio/jet_loop.wav"
	if ResourceLoader.exists(jet_path):
		var s: AudioStreamWAV = (load(jet_path) as AudioStreamWAV).duplicate()
		s.loop_mode = AudioStreamWAV.LOOP_FORWARD
		s.loop_begin = 0
		s.loop_end = int(s.get_length() * s.mix_rate)
		_jet.stream = s
		_jet.volume_db = -80.0


func _enabled() -> bool:
	var progress := get_node_or_null("/root/Progress")
	return progress == null or progress.sfx_enabled()


func play(sound: String, volume_db := 0.0, pitch := 1.0) -> void:
	if not _enabled() or not _streams.has(sound):
		return
	var p := _pool[_next]
	_next = (_next + 1) % _pool.size()
	p.stream = _streams[sound]
	p.volume_db = volume_db
	p.pitch_scale = pitch * randf_range(0.95, 1.05)
	p.play()


## Jetpack loop: level 0..1 (0 = silent). Called every frame by the game.
func set_jet(level: float) -> void:
	if _jet.stream == null:
		return
	_jet_level = level if _enabled() else 0.0
	if _jet_level > 0.01:
		if not _jet.playing:
			_jet.play()
		_jet.volume_db = linear_to_db(0.12 + 0.5 * _jet_level)
		_jet.pitch_scale = 0.85 + 0.35 * _jet_level
	elif _jet.playing:
		_jet.stop()
