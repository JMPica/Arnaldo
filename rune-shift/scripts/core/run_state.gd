class_name RunState
extends RefCounted
## Everything that lives for one run: seed, spell, health, room, earnings.

var seed_value := 0
var rng := RandomNumberGenerator.new()
var spell: Spell
var hp := 100.0
var max_hp := 100.0
var speed_mult := 1.0
var room_index := 0
var fragments := 0
var challenge_next := false
var picks_bonus := 0
var kills := 0
var damage_taken := 0.0
var time := 0.0
var choices: Array[String] = []
var combos_used: Dictionary = {}


func _init(seed_v: int, db: GameDB = null) -> void:
	seed_value = seed_v
	rng.seed = seed_v
	spell = Spell.new(db)
	var pd: Dictionary = spell.db.enemies["player"]
	max_hp = float(pd["hp"])
	hp = max_hp
