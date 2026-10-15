extends Node
## Advertising facade (autoload "Ads"). In the prototype the provider is a
## no-op: no ad SDK is bundled and nothing is shown. When gameplay is validated,
## an AdMob provider can implement the same three methods.
##
## Planned uses (all optional for the player):
##  - rewarded: retry a failed delivery from the last moment / double coins,
##  - interstitial: only at natural breaks, gated by AdPolicy.

var policy := AdPolicy.new()
var provider: AdProvider = NullAdProvider.new()
var _session_start_ms := 0


func _ready() -> void:
	_session_start_ms = Time.get_ticks_msec()


func session_time() -> float:
	return (Time.get_ticks_msec() - _session_start_ms) / 1000.0


## Called by the game when a delivery ends (success or failure).
func on_delivery_finished() -> void:
	policy.on_delivery_finished()


## Called when the results screen opens. Returns true if an ad was shown.
func maybe_show_interstitial() -> bool:
	if not provider.is_interstitial_ready():
		return false
	if not policy.can_show_interstitial(session_time(), "results"):
		return false
	policy.mark_shown(session_time())
	provider.show_interstitial()
	return true


func rewarded_available() -> bool:
	return provider.is_rewarded_ready()


class AdProvider extends RefCounted:
	func is_interstitial_ready() -> bool:
		return false

	func show_interstitial() -> void:
		pass

	func is_rewarded_ready() -> bool:
		return false


class NullAdProvider extends AdProvider:
	pass
