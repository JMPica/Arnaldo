class_name PlayerBody
extends RefCounted
## The Forger. Only movement is controlled by the player.

var pos := Vector2.ZERO
var radius := 6.0
var hp := 100.0
var max_hp := 100.0
var base_speed := 92.0
var speed_mult := 1.0
var iframes := 0.0
var iframe_time := 0.75
var facing := Vector2.UP
var moving := false
var hurt_flash := 0.0


func speed() -> float:
	return base_speed * speed_mult


func is_dead() -> bool:
	return hp <= 0.0
