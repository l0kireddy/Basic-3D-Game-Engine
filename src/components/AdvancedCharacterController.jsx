import React, { useEffect, useRef } from 'react';
import { usePlayStore } from '../store/playStore';
import { useSceneStore } from '../store/sceneStore';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';

/**
 * Advanced Hybrid Character Controller
 * - Physics-based gravity and falling (Y-axis via Cannon.js)
 * - Direct manual control for X/Z movement (no physics slide)
 * - Mouse-locked FPS camera
 * - Ground detection with raycasting
 * - Smooth camera follow with rotation
 */
export default function AdvancedCharacterController() {
  const { isPlaying } = usePlayStore();
  const { scene, physicsWorld } = useSceneStore();
  
  const playerRef = useRef(null);
  const physicsBodyRef = useRef(null);
  const keysRef = useRef({});
  
  // Camera control
  const cameraRef = useRef(null);
  const yawRef = useRef(0); // Horizontal rotation
  const pitchRef = useRef(0); // Vertical rotation (look up/down)
  const cameraDistanceRef = useRef(5);
  
  // Movement state
  const velocityRef = useRef(new THREE.Vector3());
  const isGroundedRef = useRef(false);
  const rayRef = useRef(new THREE.Raycaster());
  
  // Constants
  const MOVE_SPEED = 5;
  const RUN_SPEED = 8;
  const JUMP_FORCE = 6;
  const GRAVITY = -20;
  const CAMERA_SENSITIVITY = 0.002;
  const CAMERA_HEIGHT = 1.6;
  const PITCH_LIMIT = Math.PI / 3; // 60 degrees up/down
  
  // Key mappings
  const W = 'w', A = 'a', S = 's', D = 'd', SHIFT = 'shift', SPACE = ' ';

  // Find player
  const findPlayer = () => {
    if (!scene) return null;
    let player = null;
    scene.traverse((child) => {
      if (!player && child.name && (
        child.name.toLowerCase().includes('droide') || 
        child.name.toLowerCase().includes('soldier')
      )) {
        player = child;
      }
    });
    return player;
  };

  // Ground check using raycast
  const checkGrounded = (position) => {
    if (!scene) return false;
    rayRef.current.set(
      new THREE.Vector3(position.x, position.y + 0.1, position.z),
      new THREE.Vector3(0, -1, 0)
    );
    const hits = rayRef.current.intersectObjects(scene.children, true);
    const filtered = hits.filter(h => 
      h.object.name !== '__wireframeHelper' && 
      h.object.name !== '__physicsHelper' &&
      h.object.type !== 'LineSegments' &&
      h.distance < 0.3
    );
    return filtered.length > 0;
  };

  // Animation helper
  const playAnimation = (player, animName) => {
    if (!player?.userData?.mixer || !player?.userData?.actions) return;
    const actions = player.userData.actions;
    const available = Object.keys(actions);

    if (animName === 'idle' && !actions['idle'] && !actions['Idle']) {
      if (player.userData.currentAction !== 'none') {
        Object.values(actions).forEach(a => { try { a.stop(); } catch {} });
        player.userData.currentAction = 'none';
      }
      return;
    }

    let targetAction = null;
    if (animName === 'idle') targetAction = actions['idle'] || actions['Idle'];
    else if (animName === 'walk') targetAction = actions['walk'] || actions['Walk'] || actions['motion'];
    else if (animName === 'run') targetAction = actions['run'] || actions['Run'] || actions['walk'] || actions['motion'];
    
    if (!targetAction && available.length > 0) targetAction = actions[available[0]];

    const current = actions[player.userData.currentAction];
    if (targetAction) {
      if (animName === 'run') targetAction.timeScale = 1.5;
      else targetAction.timeScale = 1.0;

      if (current && current !== targetAction) current.fadeOut(0.2);
      if (current !== targetAction || player.userData.currentAction === 'none') {
        targetAction.reset().fadeIn(0.2).play();
      }
      player.userData.currentAction = animName;
    }
  };

  // Update loop
  const update = (delta) => {
    if (!isPlaying || !playerRef.current || !cameraRef.current) return;

    const player = playerRef.current;
    const camera = cameraRef.current;
    const body = physicsBodyRef.current;

    // Ground check
    isGroundedRef.current = checkGrounded(player.position);

    // Get input direction
    const moveDir = new THREE.Vector2();
    if (keysRef.current[W]) moveDir.y += 1;
    if (keysRef.current[S]) moveDir.y -= 1;
    if (keysRef.current[A]) moveDir.x -= 1;
    if (keysRef.current[D]) moveDir.x += 1;
    if (moveDir.length() > 0) moveDir.normalize();

    // Calculate movement relative to camera yaw
    const speed = keysRef.current[SHIFT] ? RUN_SPEED : MOVE_SPEED;
    const moveX = (Math.sin(yawRef.current) * moveDir.y + Math.cos(yawRef.current) * moveDir.x) * speed * delta;
    const moveZ = (Math.cos(yawRef.current) * moveDir.y - Math.sin(yawRef.current) * moveDir.x) * speed * delta;

    // Apply direct X/Z movement (no physics slide)
    player.position.x += moveX;
    player.position.z += moveZ;

    // Rotate player to face movement direction
    if (moveDir.length() > 0) {
      const targetAngle = Math.atan2(moveX, moveZ);
      player.rotation.y = THREE.MathUtils.lerp(player.rotation.y, targetAngle, 0.15);
    }

    // Physics gravity for Y (if we have physics body)
    if (body) {
      // Sync physics body X/Z with player (manual WASD control)
      body.position.x = player.position.x;
      body.position.z = player.position.z;
      
      // Physics body Y is controlled by physics (gravity, jumping)
      // Keep it at the mesh bounding box center height
      // The player mesh origin is at feet, offset tells us how much higher the center is
      if (body.userData && body.userData.offset) {
        const offset = body.userData.offset;
        // Body should be at: player feet position + offset to center
        body.position.y = player.position.y + offset.y;
      }
      
      body.velocity.x = 0; // No horizontal physics drift
      body.velocity.z = 0;
      
      // Jump
      if (keysRef.current[SPACE] && isGroundedRef.current) {
        body.velocity.y = JUMP_FORCE;
        keysRef.current[SPACE] = false; // Prevent multi-jump
      }
      
      // Update player Y from physics body (with offset correction)
      // Body is at center, player feet should be below it
      if (body.userData && body.userData.offset) {
        const offset = body.userData.offset;
        player.position.y = body.position.y - offset.y;
      } else {
        player.position.y = body.position.y;
      }
    } else {
      // Fallback: manual gravity if no physics
      if (!isGroundedRef.current) {
        velocityRef.current.y += GRAVITY * delta;
        player.position.y += velocityRef.current.y * delta;
        if (player.position.y < 0) {
          player.position.y = 0;
          velocityRef.current.y = 0;
        }
      } else {
        velocityRef.current.y = 0;
        if (keysRef.current[SPACE]) {
          velocityRef.current.y = JUMP_FORCE;
          keysRef.current[SPACE] = false;
        }
      }
    }

    // Animation
    let animName = 'idle';
    if (moveDir.length() > 0) {
      animName = keysRef.current[SHIFT] ? 'run' : 'walk';
    }
    playAnimation(player, animName);

    // Update mixer
    if (player.userData?.mixer) player.userData.mixer.update(delta);

    // Camera follow
    const camOffset = new THREE.Vector3(
      Math.sin(yawRef.current) * cameraDistanceRef.current,
      CAMERA_HEIGHT,
      Math.cos(yawRef.current) * cameraDistanceRef.current
    );
    camera.position.copy(player.position).add(camOffset);
    
    const lookTarget = new THREE.Vector3(
      player.position.x - Math.sin(yawRef.current) * 2,
      player.position.y + 1.5 + Math.tan(pitchRef.current) * 2,
      player.position.z - Math.cos(yawRef.current) * 2
    );
    camera.lookAt(lookTarget);
  };

  // Mouse movement
  const onMouseMove = (e) => {
    if (!isPlaying || document.pointerLockElement !== document.body) return;
    
    yawRef.current -= e.movementX * CAMERA_SENSITIVITY;
    pitchRef.current -= e.movementY * CAMERA_SENSITIVITY;
    pitchRef.current = THREE.MathUtils.clamp(pitchRef.current, -PITCH_LIMIT, PITCH_LIMIT);
  };

  // Keyboard
  const onKeyDown = (e) => {
    if (!isPlaying) return;
    const key = e.key.toLowerCase();
    if ([W, A, S, D, SHIFT, SPACE].includes(key)) {
      keysRef.current[key] = true;
      console.log(`🎮 Key pressed: ${key}`);
      e.preventDefault();
    }
    // Request pointer lock on any movement key
    if ([W, A, S, D].includes(key) && document.pointerLockElement !== document.body) {
      document.body.requestPointerLock();
    }
  };

  const onKeyUp = (e) => {
    if (!isPlaying) return;
    const key = e.key.toLowerCase();
    if ([W, A, S, D, SHIFT, SPACE].includes(key)) {
      keysRef.current[key] = false;
      e.preventDefault();
    }
  };

  // Pointer lock
  const onPointerLockChange = () => {
    if (document.pointerLockElement === document.body) {
      console.log('🔒 Mouse locked');
    } else {
      console.log('🔓 Mouse unlocked');
    }
  };

  useEffect(() => {
    if (!scene) return;

    if (isPlaying) {
      console.log('🎮 Advanced Character Controller: ON');
      
      const player = findPlayer();
      if (player) {
        console.log(`✅ Found player: ${player.name}`);
        playerRef.current = player;
        
        // Use existing physics body (should be created by playStore on play)
        let body = player.userData.physicsBody;
        if (body) {
          console.log(`🎮 Using existing physics body for character`);
          physicsBodyRef.current = body;
        } else {
          console.warn(`⚠️ No physics body found for character "${player.name}"!`);
          console.warn(`💡 Make sure physics is enabled in inspector for ${player.name}`);
          console.log(`🔍 player.userData:`, player.userData);
          console.log(`🔍 Available userData keys:`, Object.keys(player.userData || {}));
          
          // Try to wait a bit and check again
          setTimeout(() => {
            const delayedBody = player.userData.physicsBody;
            if (delayedBody) {
              console.log(`✅ Found physics body after delay!`);
              physicsBodyRef.current = delayedBody;
            } else {
              console.error(`❌ Still no physics body after delay`);
            }
          }, 100);
        }
        
        playAnimation(player, 'idle');
      } else {
        console.error('❌ No player character found! Looking for "Soldier" or "droide"');
        console.log('Available objects in scene:', scene.children.map(c => c.name || c.type));
      }

      // Get camera
      cameraRef.current = scene.children.find(c => c.isCamera);
      
      // Set initial camera angle
      if (cameraRef.current && playerRef.current) {
        const dir = new THREE.Vector3();
        cameraRef.current.getWorldDirection(dir);
        yawRef.current = Math.atan2(-dir.x, -dir.z);
      }

      // Listeners
      document.addEventListener('keydown', onKeyDown);
      document.addEventListener('keyup', onKeyUp);
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('pointerlockchange', onPointerLockChange);

      // RAF loop
      let rafId = 0;
      let last = performance.now();
      const loop = (now) => {
        const dt = Math.max(0, Math.min((now - last) / 1000, 0.05));
        last = now;
        update(dt);
        if (isPlaying) rafId = requestAnimationFrame(loop);
      };
      rafId = requestAnimationFrame(loop);
      
      console.log('🎮 Character controller ready! Use WASD to move, Shift to run, Space to jump');
      console.log('🖱️ Move mouse after pressing WASD to rotate camera (auto-locks)');

      return () => {
        cancelAnimationFrame(rafId);
        document.removeEventListener('keydown', onKeyDown);
        document.removeEventListener('keyup', onKeyUp);
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('pointerlockchange', onPointerLockChange);
        if (document.pointerLockElement) document.exitPointerLock();
        keysRef.current = {};
        playerRef.current = null;
        physicsBodyRef.current = null;
      };
    } else {
      keysRef.current = {};
      playerRef.current = null;
      if (document.pointerLockElement) document.exitPointerLock();
    }
  }, [isPlaying, scene]);

  return null;
}
