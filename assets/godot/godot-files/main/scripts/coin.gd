extends Area2D

@onready var animation_player = $AnimationPlayer

func _on_body_entered(body):
	var game_manager = get_tree().current_scene.get_node_or_null("%GameManager")
	if game_manager == null:
		return

	game_manager.add_point()
	animation_player.play("pickup")
