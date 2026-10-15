class_name PixelArt
extends RefCounted
## Builds textures from SpriteData (character-map pixel art) at runtime, plus a
## few procedural pieces (boss, crypt floor). Everything is cached.

static var _cache: Dictionary = {}


static func tex(name: String, variant := "") -> Texture2D:
	var key := name + "|" + variant
	if _cache.has(key):
		return _cache[key]
	var t: Texture2D
	if name == "boss":
		t = ImageTexture.create_from_image(_boss_image(variant))
	else:
		var rows: Array = SpriteData.SPRITES.get(name, [])
		if rows.is_empty():
			push_warning("PixelArt: unknown sprite '%s'" % name)
			rows = ["k"]
		t = ImageTexture.create_from_image(_image_from_rows(rows, variant))
	_cache[key] = t
	return t


## variant: "" normal, "white" (hit flash silhouette), or a color hex to tint.
static func _image_from_rows(rows: Array, variant: String) -> Image:
	var h := rows.size()
	var w := String(rows[0]).length()
	var img := Image.create(w, h, false, Image.FORMAT_RGBA8)
	for y in h:
		var row: String = rows[y]
		for x in w:
			var ch := row[x]
			if ch == ".":
				continue
			var c: Color = SpriteData.PALETTE.get(ch, Color.MAGENTA)
			img.set_pixel(x, y, _variant_color(c, ch, variant))
	return img


static func _variant_color(c: Color, ch: String, variant: String) -> Color:
	if variant == "white":
		return Color(1, 1, 1) if ch != "k" else Color(0.85, 0.85, 1.0)
	if variant != "" and ch != "k":
		return c.lerp(Color(variant), 0.45)
	return c


## "El Guardián de los Sellos": a 32x32 stone colossus with a violet seal.
static func _boss_image(variant: String) -> Image:
	var img := Image.create(32, 32, false, Image.FORMAT_RGBA8)
	var P: Dictionary = SpriteData.PALETTE
	var k: Color = P["k"]
	var put := func(x: int, y: int, c: Color) -> void:
		if x >= 0 and x < 32 and y >= 0 and y < 32:
			img.set_pixel(x, y, _variant_color(c, "k" if c == k else "x", variant))
	# Body: a rounded block, built half and mirrored.
	for y in range(3, 30):
		for x in range(16):
			var dx := 15.5 - x
			var dy := float(y - 17)
			var inside := (dx * dx) / 160.0 + (dy * dy) / 210.0 <= 1.0
			if not inside:
				continue
			var c: Color = P["g"]
			if y < 9:
				c = P["G"]
			if (x + y) % 7 == 0:
				c = P["G"]
			if x < 4 and y > 12:
				c = P["n"]
			put.call(x, y, c)
			put.call(31 - x, y, c)
	# Outline.
	var base := img.duplicate()
	for y in 32:
		for x in 32:
			if base.get_pixel(x, y).a > 0.0:
				continue
			for d in [Vector2i(1, 0), Vector2i(-1, 0), Vector2i(0, 1), Vector2i(0, -1)]:
				var q: Vector2i = Vector2i(x, y) + d
				if q.x >= 0 and q.x < 32 and q.y >= 0 and q.y < 32 and base.get_pixel(q.x, q.y).a > 0.0 \
						and base.get_pixel(q.x, q.y) != k:
					put.call(x, y, k)
					break
	# Shoulders / horns.
	for i in 4:
		put.call(4 + i, 4 - i, P["h"])
		put.call(27 - i, 4 - i, P["h"])
	# Eyes and the seal on the chest.
	for x in [11, 12, 19, 20]:
		put.call(x, 11, P["y"])
	for y in range(15, 24):
		put.call(15, y, P["V"])
		put.call(16, y, P["V"])
	for x in range(12, 20):
		put.call(x, 19, P["V"])
	for p in [Vector2i(13, 16), Vector2i(18, 16), Vector2i(13, 22), Vector2i(18, 22)]:
		put.call(p.x, p.y, P["p"])
	put.call(15, 19, P["w"])
	put.call(16, 19, P["w"])
	return img


## The crypt floor for one room: stone tiles, cracks and a few glowing runes.
static func floor_texture(size: Vector2i, seed_v: int) -> Texture2D:
	var key := "floor|%d|%d|%d" % [size.x, size.y, seed_v]
	if _cache.has(key):
		return _cache[key]
	var rng := RandomNumberGenerator.new()
	rng.seed = seed_v
	var img := Image.create(size.x, size.y, false, Image.FORMAT_RGBA8)
	var P: Dictionary = SpriteData.PALETTE
	var tile := 16
	for ty in range(0, size.y, tile):
		for tx in range(0, size.x, tile):
			var shade: Color = P["n"].lerp(P["g"], rng.randf_range(0.10, 0.30)).darkened(0.12)
			for y in range(ty, mini(ty + tile, size.y)):
				for x in range(tx, mini(tx + tile, size.x)):
					var c := shade
					if x == tx or y == ty:
						c = shade.darkened(0.35)
					elif rng.randf() < 0.035:
						c = shade.lightened(0.08)
					img.set_pixel(x, y, c)
			if rng.randf() < 0.12:
				# Crack.
				var px := tx + rng.randi_range(3, 12)
				var py := ty + rng.randi_range(3, 12)
				for i in 5:
					if px < size.x and py < size.y:
						img.set_pixel(px, py, shade.darkened(0.5))
					px += rng.randi_range(-1, 1)
					py += 1
	# Glowing runes: small rings of violet light.
	for r in 5:
		var cx := rng.randi_range(24, size.x - 24)
		var cy := rng.randi_range(24, size.y - 24)
		for a in 16:
			var p := Vector2(cx, cy) + Vector2.from_angle(TAU * a / 16.0) * 5.0
			if int(p.x) >= 0 and int(p.x) < size.x and int(p.y) >= 0 and int(p.y) < size.y:
				img.set_pixel(int(p.x), int(p.y), P["v"])
		img.set_pixel(cx, cy, P["V"])
	var t := ImageTexture.create_from_image(img)
	_cache[key] = t
	return t
