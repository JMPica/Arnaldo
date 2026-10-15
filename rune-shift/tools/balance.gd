extends SceneTree
## Balancing probe: the bot plays complete runs for every one of the 27 rune
## combinations and reports how far it gets.
## Run: godot --headless --path . --script res://tools/balance.gd -- [--seeds=3] [--skill=0.8]

func _initialize() -> void:
	var seeds := 3
	var skill := 0.8
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--seeds="): seeds = int(a.get_slice("=", 1))
		if a.begins_with("--skill="): skill = float(a.get_slice("=", 1))
	var db := GameDB.get_db()
	var total_wins := 0
	var total := 0
	var all_rooms: Array[float] = []
	var t0 := Time.get_ticks_msec()
	for f in db.rune_ids("forms"):
		for el in db.rune_ids("elements"):
			for ca in db.rune_ids("catalysts"):
				var wins := 0
				var reached := 0.0
				var secs := 0.0
				for s in seeds:
					var r := Bot.play_run(1000 + s, {"form": f, "element": el, "catalyst": ca}, skill)
					wins += 1 if r["victory"] else 0
					reached += r["rooms_cleared"]
					secs += r["run_seconds"]
					for x in r["room_seconds"]:
						all_rooms.append(x)
					total += 1
				total_wins += wins
				print("%-8s %-6s %-8s  wins %d/%d  avg rooms %.1f/9  avg run %.0fs" % [f, el, ca, wins, seeds, reached / seeds, secs / seeds])
	all_rooms.sort()
	var mean := 0.0
	for x in all_rooms: mean += x
	mean /= maxf(all_rooms.size(), 1)
	print("TOTAL wins %d/%d (%.0f%%) | room seconds: median %.1f, mean %.1f, p10 %.1f, p90 %.1f | %.1fs wall" % [
		total_wins, total, 100.0 * total_wins / total, all_rooms[all_rooms.size() / 2], mean,
		all_rooms[int(all_rooms.size() * 0.1)], all_rooms[int(all_rooms.size() * 0.9)], (Time.get_ticks_msec() - t0) / 1000.0])
	quit()
