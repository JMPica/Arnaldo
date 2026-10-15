class_name RuneElements
extends RefCounted
## Element runes: what a hit does to an enemy, regardless of the form.


static func potency(spell: Spell) -> float:
	return spell.element_mult


static func apply(spell: Spell, world: CombatWorld, e: Enemy, source: Dictionary) -> void:
	if not e.alive:
		return
	match spell.element:
		"fire":
			e.burn_stacks = mini(e.burn_stacks + 1, int(spell.ep("max_stacks", 3)))
			e.burn_time = float(spell.ep("duration", 2.0))
			e.burn_dps = float(spell.ep("burn_dps", 6)) * potency(spell)
			if e.burn_tick <= 0.0:
				e.burn_tick = float(spell.ep("tick", 0.5))
		"ice":
			var slow := minf(0.8, float(spell.ep("slow", 0.45)) * potency(spell))
			if e.is_boss():
				slow *= 0.5  # the boss resists, but still feels it
			e.slow_amount = maxf(e.slow_amount if e.slow_time > 0.0 else 0.0, slow)
			e.slow_time = float(spell.ep("duration", 1.6))
			spell.stats["slows"] += 1
		"storm":
			# The charge builds up in the spell (any enemy counts), so the rule
			# works the same for a single orb or a cone that hits a crowd.
			spell.storm_charge += 1
			if spell.storm_charge >= int(spell.ep("charges", 4)):
				spell.storm_charge = 0
				_discharge(spell, world, e, source)


static func _discharge(spell: Spell, world: CombatWorld, e: Enemy, source: Dictionary) -> void:
	spell.stats["discharges"] += 1
	var dmg := float(spell.ep("discharge", 16)) * potency(spell) * spell.damage_mult
	var src := {"kind": "discharge", "primary": false, "depth": source.get("depth", 0), "blockable": false}
	var chain_to: Enemy = world.nearest_enemy(e.pos, float(spell.ep("chain_radius", 64)), e)
	world.emit({"type": "discharge", "pos": e.pos, "to": chain_to.pos if chain_to else e.pos})
	world.damage_enemy(e, dmg, src)
	if chain_to and chain_to.alive:
		world.damage_enemy(chain_to, dmg * float(spell.ep("chain_ratio", 0.5)), src)


## Burn damage over time, ticked by the world.
static func tick_burn(spell: Spell, world: CombatWorld, e: Enemy, dt: float) -> void:
	if e.burn_time <= 0.0:
		e.burn_stacks = 0
		return
	e.burn_time -= dt
	e.burn_tick -= dt
	if e.burn_tick <= 0.0:
		var tick := float(spell.ep("tick", 0.5)) if spell.element == "fire" else 0.5
		e.burn_tick += tick
		spell.stats["burn_ticks"] += 1
		world.damage_enemy(e, e.burn_dps * e.burn_stacks * tick * spell.damage_mult,
				{"kind": "burn", "primary": false, "depth": 0, "blockable": false})
