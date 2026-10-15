extends Node
## Sound effects and music loops (autoload "Sfx"). Missing files are skipped.

const SOUNDS := ["cast_orb", "cast_cone", "orbit_hit", "hit", "kill", "player_hit", "block", "explosion",
		"discharge", "spawn", "pick", "room_clear", "boss_roar", "victory", "defeat", "click"]
const MUSIC := ["menu", "combat", "boss"]
const POOL_SIZE := 10

var _streams: Dictionary = {}
var _pool: Array[AudioStreamPlayer] = []
var _next := 0
var _music: AudioStreamPlayer
var _music_name := ""
var _last_played: Dictionary = {}


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
	_music = AudioStreamPlayer.new()
	_music.volume_db = -9.0
	add_child(_music)


func _setting(key: String) -> bool:
	var prog := get_node_or_null("/root/Progression")
	return prog == null or prog.setting(key)


func play(sound: String, volume_db := 0.0, pitch := 1.0, min_gap := 0.04) -> void:
	if not _setting("sfx") or not _streams.has(sound):
		return
	var now := Time.get_ticks_msec() / 1000.0
	if now - float(_last_played.get(sound, -1.0)) < min_gap:
		return  # avoid machine-gun stacking of the same sound
	_last_played[sound] = now
	var p := _pool[_next]
	_next = (_next + 1) % _pool.size()
	p.stream = _streams[sound]
	p.volume_db = volume_db
	p.pitch_scale = pitch * randf_range(0.94, 1.06)
	p.play()


func music(track: String) -> void:
	if track == _music_name and _music.playing:
		return
	_music_name = track
	var path := "res://assets/audio/music_%s.ogg" % track
	if not _setting("music") or not ResourceLoader.exists(path):
		_music.stop()
		return
	var s: AudioStreamOggVorbis = (load(path) as AudioStreamOggVorbis).duplicate()
	s.loop = true
	_music.stream = s
	_music.play()


func stop_music() -> void:
	_music_name = ""
	_music.stop()
