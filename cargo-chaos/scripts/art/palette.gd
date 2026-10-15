class_name Palette
extends RefCounted
## The game's colour palette. Every art script reads from here so the look can
## be re-skinned in one place.

const OUTLINE := Color("1d1630")
const SHADOW := Color(0.11, 0.08, 0.2, 0.25)
const WHITE := Color("fff8ef")

# Courier ("Zippy")
const SUIT := Color("23b5a5")
const SUIT_DARK := Color("178276")
const CAP := Color("ff7a2f")
const CAP_DARK := Color("d4551a")
const SKIN := Color("ffd2a6")
const SKIN_DARK := Color("e9a878")
const GOGGLE := Color("ffd23f")
const LENS := Color("7fe7ff")
const JETPACK := Color("ef4652")
const JETPACK_DARK := Color("ab2a39")
const METAL := Color("c9d3e6")
const METAL_DARK := Color("8792ad")
const BOOTS := Color("3b2f4a")
const SCARF := Color("ffd23f")
const FLAME_CORE := Color("fff6c8")
const FLAME_MID := Color("ffd23f")
const FLAME_OUT := Color("ff7a2f")

# Cargo
const GLASS := Color(0.55, 0.9, 1.0, 0.55)
const GLASS_EDGE := Color("bff4ff")
const TAPE := Color("e83b4f")
const PIANO := Color("2b1f33")
const PIANO_LIGHT := Color("4a3a57")
const PIANO_TRIM := Color("f2c14e")
const CAKE_PINK := Color("ff8fc4")
const CAKE_CREAM := Color("fff1d6")
const CAKE_PLATE := Color("d8deea")
const BERRY := Color("e5354c")

# World
const STREET := Color("3a3550")
const SIDEWALK := Color("8f8aa6")
const LANE := Color("ffd23f")
const STEEL := Color("f2b134")
const STEEL_DARK := Color("b87a1e")
const DRONE := Color("4e5d78")
const DANGER := Color("ff4d5e")
const GOOD := Color("4ee08a")
const WARN := Color("ffc93c")

const BUILDING_COLORS := [
	Color("e07a5f"), Color("7c6bb0"), Color("4f9d9a"), Color("d9a441"),
	Color("c05f86"), Color("5b84c4"), Color("8a9a5b"),
]

const THEMES := {
	"day": {
		"sky_top": Color("4fb8ff"), "sky_bottom": Color("c9f1ff"),
		"far": Color("9cc9e8"), "mid": Color("7aa6cf"), "mid_window": Color("b9dcf5"),
		"cloud": Color(1, 1, 1, 0.85), "sun": Color("fff3b0"), "window": Color("bfe9ff"),
		"window_lit": Color("ffe58a"), "night": false,
	},
	"sunset": {
		"sky_top": Color("6a4fb3"), "sky_bottom": Color("ffb27a"),
		"far": Color("b97aa8"), "mid": Color("8a5a99"), "mid_window": Color("ffcf8a"),
		"cloud": Color(1.0, 0.85, 0.8, 0.8), "sun": Color("ffdf7a"), "window": Color("6d5a8f"),
		"window_lit": Color("ffd27a"), "night": false,
	},
	"night": {
		"sky_top": Color("0f1033"), "sky_bottom": Color("3b2a6e"),
		"far": Color("2a2456"), "mid": Color("221d47"), "mid_window": Color("ffd27a"),
		"cloud": Color(0.6, 0.6, 0.9, 0.35), "sun": Color("f4f1ff"), "window": Color("2c2a52"),
		"window_lit": Color("ffe07a"), "night": true,
	},
}


static func theme(name: String) -> Dictionary:
	return THEMES.get(name, THEMES["day"])
