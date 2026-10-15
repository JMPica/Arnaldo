class_name AdPolicy
extends RefCounted
## Decides WHEN an interstitial ad would be acceptable. No ad SDK is involved:
## this is the player-respecting rule set the future AdMob integration must
## obey. Rules:
##  - never during gameplay, only at natural breaks (results screen),
##  - no ads during the first minutes of a session (grace period),
##  - a minimum time between interstitials,
##  - at most one every N finished deliveries,
##  - never right after the player starts playing.

var grace_period_sec := 180.0
var min_interval_sec := 150.0
var deliveries_between := 3
var enabled := true

var _deliveries_since_last := 0
var _last_shown_at := -INF


func on_delivery_finished() -> void:
	_deliveries_since_last += 1


## context: "results" (natural break), "gameplay", "menu_start"...
func can_show_interstitial(session_time_sec: float, context: String) -> bool:
	if not enabled:
		return false
	if context != "results":
		return false
	if session_time_sec < grace_period_sec:
		return false
	if session_time_sec - _last_shown_at < min_interval_sec:
		return false
	return _deliveries_since_last >= deliveries_between


func mark_shown(session_time_sec: float) -> void:
	_last_shown_at = session_time_sec
	_deliveries_since_last = 0
