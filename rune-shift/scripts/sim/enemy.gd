class_name Enemy
extends RefCounted
## One enemy (or the boss) inside the combat simulation.

var id := 0
var kind := "crawler"
var elite := ""
var pos := Vector2.ZERO
var vel := Vector2.ZERO
var radius := 6.0
var hp := 10.0
var max_hp := 10.0
var speed := 30.0
var contact := 8.0
var facing := 0.0           ## radians, used by the guardian's shield and the boss
var state := "move"         ## AI state: move / telegraph / dash / recover / ...
var timer := 0.0            ## generic AI timer
var cooldown := 0.0
var aim := Vector2.RIGHT    ## locked attack direction during telegraphs
var def: Dictionary = {}
var alive := true
var flash := 0.0            ## hit flash for the view
var anim := 0.0

# Status effects (runes)
var burn_stacks := 0
var burn_time := 0.0
var burn_tick := 0.0
var burn_dps := 0.0
var slow_time := 0.0
var slow_amount := 0.0
var charge := 0
var orbit_hit: Dictionary = {}
var blocks := 0                 ## guardian: blocked hits since the last guard break  ## blade index -> time of last hit (per enemy)

# Boss
var phase := 1
var pattern_index := 0


func is_boss() -> bool:
	return kind == "boss"


func move_speed() -> float:
	var s := speed
	if slow_time > 0.0:
		s *= (1.0 - slow_amount)
	return s


func is_telegraphing() -> bool:
	return state == "telegraph" or state == "radial_telegraph" or state == "charge_telegraph"
