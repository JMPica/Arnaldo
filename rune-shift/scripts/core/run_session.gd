class_name RunSession
extends RefCounted
## A whole run as a state machine, with no nodes: the game screen and the
## balancing bot drive the very same object.
##   INTRO (room banner) -> COMBAT -> REWARD (paused forge) -> next room
##   ... -> boss -> VICTORY, or DEFEAT whenever health reaches 0.

signal room_entered(index: int, template: String)
signal room_completed(index: int, seconds: float)
signal rewards_offered(cards: Array)
signal card_chosen(card: Dictionary, result: String)
signal run_finished(victory: bool)

enum Phase { INTRO, COMBAT, REWARD, VICTORY, DEFEAT }

const INTRO_TIME := 1.1

var db: GameDB
var run: RunState
var world: CombatWorld
var room: RoomRunner
var phase := Phase.INTRO
var phase_time := 0.0
var template_id := ""
var offers: Array[Dictionary] = []
var picks_left := 0
var room_seconds: Array[float] = []


func start(seed_v: int, database: GameDB = null) -> void:
	db = database if database else GameDB.get_db()
	run = RunState.new(seed_v, db)
	enter_room(0)


func room_count() -> int:
	return db.rooms["run"].size()


func room_def() -> Dictionary:
	return db.rooms["run"][run.room_index]


func enter_room(index: int) -> void:
	run.room_index = index
	var def := room_def()
	var templates: Array = def.get("templates", ["hall"])
	template_id = templates[run.rng.randi() % templates.size()]
	world = CombatWorld.new()
	world.setup(run.seed_value * 31 + index * 977, run.spell, db.rooms["templates"][template_id]["obstacles"], db)
	world.player.hp = run.hp
	world.player.max_hp = run.max_hp
	world.player.speed_mult = run.speed_mult
	run.spell.reset_runtime()
	room = RoomRunner.new()
	room.start(world, def, run.challenge_next)
	if run.challenge_next:
		run.challenge_next = false
		run.picks_bonus = 1
	phase = Phase.INTRO
	phase_time = 0.0
	room_entered.emit(index, template_id)


func is_boss_room() -> bool:
	return room_def().get("boss", false)


func step(dt: float, move: Vector2) -> void:
	phase_time += dt
	match phase:
		Phase.INTRO:
			# Enemies are already announced; nobody moves yet.
			if phase_time >= INTRO_TIME:
				phase = Phase.COMBAT
				phase_time = 0.0
		Phase.COMBAT:
			run.time += dt
			world.step(dt, move)
			room.update(dt)
			run.hp = world.player.hp
			if world.player.is_dead():
				_finish(false)
			elif room.cleared:
				_room_cleared()


func _room_cleared() -> void:
	run.kills += world.stats["kills"]
	run.damage_taken += world.stats["damage_taken"]
	run.combos_used[run.spell.combo_key()] = true
	room_seconds.append(room.elapsed)
	var f: Dictionary = db.rooms["fragments"]
	run.fragments += int(f["per_room"])
	room_completed.emit(run.room_index, room.elapsed)
	if is_boss_room():
		run.fragments += int(f["boss"]) + int(f["victory_bonus"])
		_finish(true)
		return
	offers = RewardManager.offers(run, room_def())
	picks_left = 1 + run.picks_bonus
	run.picks_bonus = 0
	phase = Phase.REWARD
	phase_time = 0.0
	rewards_offered.emit(offers)


## Picks one of the offered cards. With picks left (challenge bonus) new offers
## are made; otherwise the next room starts.
func choose(index: int) -> void:
	if phase != Phase.REWARD or index < 0 or index >= offers.size():
		return
	var card := offers[index]
	var result := RewardManager.apply(run, card)
	card_chosen.emit(card, result)
	picks_left -= 1
	if picks_left > 0:
		offers = RewardManager.offers(run, {"reward": "standard"})
		rewards_offered.emit(offers)
		return
	enter_room(run.room_index + 1)


func _finish(victory: bool) -> void:
	phase = Phase.VICTORY if victory else Phase.DEFEAT
	phase_time = 0.0
	run_finished.emit(victory)


func is_over() -> bool:
	return phase == Phase.VICTORY or phase == Phase.DEFEAT
