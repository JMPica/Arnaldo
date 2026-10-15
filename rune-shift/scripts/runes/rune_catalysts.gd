class_name RuneCatalysts
extends RefCounted
## Catalyst runes: a second behaviour rule. Echo lives in Spell.on_cast (it
## only needs the cast count); Rebound and Rupture create new damage here.


## Rebound: a bolt jumps from the hit enemy to the nearest other enemy.
## Its hits are not "primary", so a rebound never feeds the rebound counter.
static func rebound(spell: Spell, world: CombatWorld, from: Enemy) -> void:
	var target: Enemy = world.nearest_enemy(from.pos, float(spell.cp("range", 120)), from)
	if target == null:
		return
	spell.stats["rebounds"] += 1
	var p := Projectile.new()
	p.pos = from.pos
	p.vel = (target.pos - from.pos).normalized() * float(spell.cp("speed", 420))
	p.radius = 3.0
	p.team = "player"
	p.damage = float(spell.cp("damage", 10)) * spell.damage_mult
	p.ttl = 0.6
	p.kind = "rebound"
	p.source = {"kind": "rebound", "primary": false, "depth": 0, "blockable": true}
	p.hit_ids[from.id] = true
	world.projectiles.append(p)


## Rupture: the killed enemy explodes. Explosion damage has depth 1, so its
## kills do not explode again.
static func rupture(spell: Spell, world: CombatWorld, dead: Enemy) -> void:
	spell.stats["explosions"] += 1
	var radius := float(spell.cp("radius", 34)) * (1.0 + 0.15 * spell.catalyst_bonus)
	var dmg := float(spell.cp("damage", 10)) * spell.damage_mult
	world.emit({"type": "explosion", "pos": dead.pos, "radius": radius, "element": spell.element})
	var src := {"kind": "explosion", "primary": false, "depth": 1, "blockable": false}
	for e: Enemy in world.enemies.duplicate():
		if e.alive and e != dead and e.pos.distance_to(dead.pos) <= radius + e.radius:
			world.hit_enemy(e, dmg, src, dead.pos)
