extends Node2D

const SPEED = 60
const COIN_SCENE = preload("res://scenes/coin.tscn")
const DEATH_SOUND = preload("res://assets/sounds/explosion.wav")

var direction = 1
var defeated = false

@onready var ray_cast_right = $RayCastRight
@onready var ray_cast_left = $RayCastLeft
@onready var animated_sprite = $AnimatedSprite2D

func _ready():
	add_to_group("slimes")

# Called every frame. 'delta' is the elapsed time since the previous frame.
func _process(delta):
	if defeated:
		return

	if ray_cast_right.is_colliding():
		direction = -1
		animated_sprite.flip_h = true
	if ray_cast_left.is_colliding():
		direction = 1
		animated_sprite.flip_h = false
	
	position.x += direction * SPEED * delta

func defeat():
	if defeated:
		return

	defeated = true
	drop_coin()
	spawn_death_effect()
	play_death_sound()
	queue_free()

func drop_coin():
	var coin = COIN_SCENE.instantiate()
	coin.global_position = global_position + Vector2(0, -12)

	var coin_parent = get_tree().current_scene.get_node_or_null("Coins")
	if coin_parent == null:
		coin_parent = get_parent()

	coin_parent.add_child(coin)

func spawn_death_effect():
	var parent = get_parent()
	if parent == null:
		return

	var particles = CPUParticles2D.new()
	particles.global_position = global_position + Vector2(0, -10)
	particles.amount = 18
	particles.lifetime = 0.34
	particles.one_shot = true
	particles.explosiveness = 1.0
	particles.direction = Vector2(0, -1)
	particles.spread = 180.0
	particles.gravity = Vector2(0, 120)
	particles.initial_velocity_min = 45.0
	particles.initial_velocity_max = 85.0
	particles.scale_amount_min = 1.2
	particles.scale_amount_max = 2.4
	particles.color = Color(0.45, 1.0, 0.28, 0.95)
	parent.add_child(particles)
	particles.emitting = true

	var cleanup = get_tree().create_timer(particles.lifetime + 0.1)
	cleanup.timeout.connect(particles.queue_free)

func play_death_sound():
	var parent = get_parent()
	if parent == null:
		return

	var sound = AudioStreamPlayer2D.new()
	sound.stream = DEATH_SOUND
	sound.volume_db = -10.0
	sound.bus = &"SFX"
	sound.global_position = global_position
	parent.add_child(sound)
	sound.play()
	sound.finished.connect(sound.queue_free)
