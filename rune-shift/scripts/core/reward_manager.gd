class_name RewardManager
extends RefCounted
## Builds the forge cards offered between rooms and applies the chosen one.
## The first three rooms are guided (element, then catalyst, then form) so every
## player meets the three rune families early.

const STAT_CARDS := {
	"stat_damage": {"title": "Filo Rúnico", "desc": "+20% de daño de todo el hechizo.", "icon": "stat_damage"},
	"stat_rate": {"title": "Pulso Rápido", "desc": "+15% de frecuencia de ataque.", "icon": "stat_rate"},
	"stat_speed": {"title": "Pies Ligeros", "desc": "+10% de velocidad de movimiento.", "icon": "stat_speed"},
	"stat_hp": {"title": "Corazón de Piedra", "desc": "+20 de salud máxima (y la recuperas).", "icon": "stat_hp"},
	"stat_element": {"title": "Esencia Pura", "desc": "+30% de eficacia del elemento.", "icon": "stat_element"},
	"stat_catalyst": {"title": "Catalizador Fino", "desc": "El catalizador se activa más a menudo.", "icon": "stat_catalyst"},
}


static func offers(run: RunState, room_def: Dictionary) -> Array[Dictionary]:
	var spell := run.spell
	var db := spell.db
	var out: Array[Dictionary] = []
	match room_def.get("reward", "standard"):
		"element":
			for id in db.rune_ids("elements"):
				out.append(_rune_card("element", id, db, spell))
			return out
		"catalyst":
			for id in db.rune_ids("catalysts"):
				out.append(_rune_card("catalyst", id, db, spell))
			return out
		"form":
			for id in db.rune_ids("forms"):
				if id != spell.form:
					out.append(_rune_card("form", id, db, spell))
			out.append(_upgrade_card("form", spell))
			return out
	# Standard rooms: a weighted, seeded pool.
	var pool: Array[Dictionary] = []
	for fam in ["form", "element", "catalyst"]:
		if _family_level(spell, fam) > 0 and _family_level(spell, fam) < 3:
			pool.append(_upgrade_card(fam, spell))
			pool.append(_upgrade_card(fam, spell))  # upgrades are common
	for fam_pair in [["element", "elements"], ["catalyst", "catalysts"], ["form", "forms"]]:
		for id in db.rune_ids(fam_pair[1]):
			if id != _current(spell, fam_pair[0]):
				pool.append(_rune_card(fam_pair[0], id, db, spell))
	for id in STAT_CARDS.keys():
		if id == "stat_element" and spell.element == "":
			continue
		if id == "stat_catalyst" and spell.catalyst == "":
			continue
		pool.append(_stat_card(id))
	if run.hp < run.max_hp * 0.8:
		pool.append({"type": "heal", "id": "heal", "title": "Fuente de los Sellos",
			"desc": "Recuperas el 40% de tu salud.", "icon": "heal"})
		pool.append(pool[pool.size() - 1])
	if run.room_index < 7:
		pool.append({"type": "challenge", "id": "challenge", "title": "Desafío del Sello",
			"desc": "La próxima sala trae un enemigo de élite. Después eliges 2 recompensas.", "icon": "challenge"})
	# Pick 3 distinct cards, at least one rune card.
	var picked_keys := {}
	var guard := 0
	while out.size() < 3 and guard < 200:
		guard += 1
		var c: Dictionary = pool[run.rng.randi() % pool.size()]
		var key := "%s:%s" % [c["type"], c["id"]]
		if picked_keys.has(key):
			continue
		picked_keys[key] = true
		out.append(c)
	var has_rune := false
	for c in out:
		if c["type"] in ["rune", "upgrade"]:
			has_rune = true
	if not has_rune and spell.levels["form"] < 3:
		out[0] = _upgrade_card("form", spell)
	return out


static func _current(spell: Spell, family: String) -> String:
	match family:
		"form": return spell.form
		"element": return spell.element
		_: return spell.catalyst


static func _family_level(spell: Spell, family: String) -> int:
	if _current(spell, family) == "":
		return 0
	return int(spell.levels[family])


static func _rune_card(family: String, id: String, db: GameDB, spell: Spell) -> Dictionary:
	var plural: String = {"form": "forms", "element": "elements", "catalyst": "catalysts"}[family]
	var def: Dictionary = db.rune(plural, id)
	var cur := _current(spell, family)
	var verb := "Nueva runa" if cur == "" else "Cambiar runa"
	return {"type": "rune", "family": family, "id": id, "title": str(def["name"]),
		"desc": str(def["short"]), "icon": id, "tag": verb}


static func _upgrade_card(family: String, spell: Spell) -> Dictionary:
	var id := _current(spell, family)
	var plural: String = {"form": "forms", "element": "elements", "catalyst": "catalysts"}[family]
	var def: Dictionary = spell.db.rune(plural, id)
	var lvl := int(spell.levels[family]) + 1
	return {"type": "upgrade", "family": family, "id": id, "title": "%s nivel %d" % [def.get("name", id), lvl],
		"desc": _upgrade_text(family, id, lvl), "icon": id, "tag": "Mejora"}


static func _upgrade_text(family: String, id: String, lvl: int) -> String:
	match id:
		"orb": return "Más daño. " + ("Dos proyectiles a la vez." if lvl == 2 else "Atraviesa a un enemigo.")
		"orbit": return "Más daño y una cuchilla más."
		"cone": return "Más daño y un arco más amplio."
		"fire": return "La quemadura hace más daño."
		"ice": return "Ralentiza más, más tiempo y el frío hace más vulnerable."
		"storm": return "Descargas más fuertes" + (" y cada 3 impactos." if lvl == 3 else ".")
		"echo": return "El eco llega antes." if lvl == 3 else "El eco se mantiene y gana fuerza."
		"rupture": return "Explosiones más grandes y dañinas."
		"rebound": return "El rebote salta más a menudo."
	return "Más poder."


static func _stat_card(id: String) -> Dictionary:
	var c: Dictionary = STAT_CARDS[id].duplicate()
	c["type"] = "stat"
	c["id"] = id
	c["tag"] = "Mejora"
	return c


## Applies a card. Returns a short text describing what changed.
static func apply(run: RunState, card: Dictionary) -> String:
	var spell := run.spell
	run.choices.append("%s:%s" % [card["type"], card["id"]])
	match card["type"]:
		"rune":
			match card["family"]:
				"form":
					spell.form = card["id"]
					spell.levels["form"] = 1
				"element":
					spell.element = card["id"]
					spell.levels["element"] = 1
				"catalyst":
					spell.catalyst = card["id"]
					spell.levels["catalyst"] = 1
			return spell.display_name()
		"upgrade":
			spell.levels[card["family"]] = mini(3, int(spell.levels[card["family"]]) + 1)
			return str(card.get("title", ""))
		"stat":
			match card["id"]:
				"stat_damage": spell.damage_mult *= 1.2
				"stat_rate": spell.rate_mult *= 1.15
				"stat_speed": run.speed_mult *= 1.1
				"stat_hp":
					run.max_hp += 20.0
					run.hp = minf(run.max_hp, run.hp + 20.0)
				"stat_element": spell.element_mult *= 1.3
				"stat_catalyst": spell.catalyst_bonus += 1
			return str(card.get("title", ""))
		"heal":
			run.hp = minf(run.max_hp, run.hp + run.max_hp * 0.4)
			return str(card.get("title", ""))
		"challenge":
			run.challenge_next = true
			return str(card.get("title", ""))
	return ""
