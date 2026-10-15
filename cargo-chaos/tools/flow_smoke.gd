extends SceneTree
## Smoke test of real scene changes: menu -> mission -> restart -> next -> menu.
## Run: godot --headless --path . --fixed-fps 60 --script res://tools/flow_smoke.gd

var _fails := 0


func _check(cond: bool, what: String) -> void:
	print(("  ok   " if cond else "  FAIL ") + what)
	if not cond:
		_fails += 1


func _wait(frames: int) -> void:
	for i in frames:
		await process_frame


func _initialize() -> void:
	_run.call_deferred()


func _run() -> void:
	var progress = root.get_node("Progress")
	progress.save_path = "user://smoke_save.json"
	progress.reset_all()
	root.get_node("Analytics").enabled = false
	var game = root.get_node("Game")
	change_scene_to_file(game.MENU_SCENE)
	await _wait(5)
	_check(current_scene.name == "MainMenu", "menu loaded")
	game.start_level(game.suggested_level_index())
	await _wait(40)
	_check(current_scene is GameScene, "PLAY opens a mission")
	_check((current_scene as GameScene).level_index == 0, "first mission")
	var first: Node = current_scene
	# Play a bit, then restart.
	Input.action_press("thrust")
	await _wait(60)
	Input.action_release("thrust")
	_check((current_scene as GameScene).mission.is_playing(), "mission running")
	game.restart_level()
	await _wait(40)
	_check(current_scene is GameScene and current_scene != first, "restart builds a fresh mission")
	_check((current_scene as GameScene).mission.state == Mission.State.READY, "restart waits for the first tap")
	_check(not paused, "tree not paused after restart")
	# Pause then go to the menu from the pause menu: the tree must unpause.
	(current_scene as GameScene)._toggle_pause()
	_check(paused, "paused")
	game.go_to_menu()
	await _wait(40)
	_check(current_scene.name == "MainMenu" and not paused, "menu from pause, unpaused")
	game.start_level(1)
	await _wait(40)
	_check((current_scene as GameScene).level_index == 1, "mission card opens mission 2")
	game.next_level()
	await _wait(40)
	_check((current_scene as GameScene).level_index == 2, "next delivery opens mission 3")
	DirAccess.remove_absolute(ProjectSettings.globalize_path("user://smoke_save.json"))
	print("flow smoke: %s" % ("PASSED" if _fails == 0 else "%d FAILED" % _fails))
	quit(1 if _fails > 0 else 0)
