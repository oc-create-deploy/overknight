extends CharacterBody2D


const SPEED = 130.0
const JUMP_VELOCITY = -300.0
const SWORD_RANGE = 34.0
const SWORD_HEIGHT = 22.0
const SWORD_COOLDOWN = 0.22

# Get the gravity from the project settings to be synced with RigidBody nodes.
var gravity = ProjectSettings.get_setting("physics/2d/default_gravity")
var facing = 1
var sword_cooldown = 0.0

@onready var animated_sprite = $AnimatedSprite2D

func _physics_process(delta):
	if sword_cooldown > 0:
		sword_cooldown -= delta

	# Add the gravity.
	if not is_on_floor():
		velocity.y += gravity * delta

	# Handle jump.
	if Input.is_action_just_pressed("jump") and is_on_floor():
		velocity.y = JUMP_VELOCITY

	if Input.is_action_just_pressed("attack") and sword_cooldown <= 0:
		swing_sword()

	# Get the input direction: -1, 0, 1
	var direction = Input.get_axis("move_left", "move_right")
	
	# Flip the Sprite
	if direction > 0:
		facing = 1
		animated_sprite.flip_h = false
	elif direction < 0:
		facing = -1
		animated_sprite.flip_h = true
	
	# Play animations
	if is_on_floor():
		if direction == 0:
			animated_sprite.play("idle")
		else:
			animated_sprite.play("run")
	else:
		animated_sprite.play("jump")
	
	# Apply movement
	if direction:
		velocity.x = direction * SPEED
	else:
		velocity.x = move_toward(velocity.x, 0, SPEED)

	move_and_slide()

func swing_sword():
	sword_cooldown = SWORD_COOLDOWN
	for slime in get_tree().get_nodes_in_group("slimes"):
		if not is_instance_valid(slime):
			continue

		var offset = slime.global_position - global_position
		var in_front = sign(offset.x) == facing or abs(offset.x) < 4
		var in_range = abs(offset.x) <= SWORD_RANGE and abs(offset.y) <= SWORD_HEIGHT

		if in_front and in_range:
			slime.defeat()
