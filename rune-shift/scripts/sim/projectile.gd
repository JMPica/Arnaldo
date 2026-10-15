class_name Projectile
extends RefCounted
## A projectile. team "player" hits enemies, team "enemy" hits the player.

var pos := Vector2.ZERO
var vel := Vector2.ZERO
var radius := 3.0
var team := "player"
var damage := 0.0
var pierce := 0
var ttl := 2.0
var kind := "orb"            ## orb / rebound / arrow / boss
var source: Dictionary = {}  ## damage source passed to the rune engine
var hit_ids: Dictionary = {}
var alive := true
